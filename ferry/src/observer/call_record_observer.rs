use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicI32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::{Duration, Instant};

use chrono::Utc;
use sea_orm::ActiveValue::{NotSet, Set, Unchanged};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};
use tokio::time;
use uuid::Uuid;

use crate::call::{CallHandle, CallStatus as LiveStatus, EndReason as LiveEndReason};
use crate::config;
use crate::db;
use crate::db::entity::{agents, call_utterances, calls};
use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::services::storage::supabase::SupabaseStorageClient;
use crate::stages::stage::Stage;

/// Persists a call to Postgres without any handler, stage or transport
/// knowing the database exists. Two seams, both of which already existed:
///
///  - **Transcript** rides `FrameObserver`, the same hook `TranscriptLogObserver`
///    uses. One observer per translation direction, sharing a seq counter so
///    the two directions interleave into one ordered conversation.
///  - **Lifecycle** rides `CallHandle::watch_status`, which already broadcasts
///    every transition so transports can react without polling. Subscribing to
///    it is what keeps `dialing -> ringing -> connected -> ended` out of the
///    three separate handlers that drive those transitions.
///
/// The hard rule: `on_push` runs on the audio path and must never touch the
/// database. It only sends into an unbounded channel; one writer task per call
/// drains it and batches the inserts.
const FLUSH_INTERVAL: Duration = Duration::from_secs(2);
const FLUSH_BATCH: usize = 32;

enum Event {
    /// A finalized turn — text as spoken, in the speaker's own language.
    Turn {
        seq: i32,
        speaker: call_utterances::Speaker,
        original_language: Option<agents::Language>,
        translated_language: Option<agents::Language>,
        text: String,
        offset_ms: Option<i32>,
        duration_ms: Option<i32>,
    },
    /// The MT output for an earlier `Turn` — what the other leg heard.
    Translation { seq: i32, text: String },

    /// This pipeline's own raw mic input — decoded PCM, mono. `speaker` says
    /// whose mic: the pipeline attached to `Caller` carries the caller's own
    /// voice, and so on. This is the "original" recording track.
    ///
    /// `offset_ms` is wall-clock-since-`connected_at`, same as `Turn`'s —
    /// only meaningful (and only used) on this buffer's very first chunk,
    /// to know how much silence to pad the front with so this leg's audio
    /// lines up with the other leg's instead of both starting at sample 0
    /// regardless of when each one's mic actually opened.
    Mic {
        speaker: call_utterances::Speaker,
        sample_rate: u32,
        offset_ms: Option<i32>,
        samples: Vec<i16>,
    },
    /// TTS is about to start synthesizing `seq`'s translation. `speaker` is
    /// still "whose pipeline this is" — since a pipeline's TTS output is
    /// always destined for the *other* leg, this is the translated audio
    /// the *other* speaker hears, not this one.
    TtsBoundaryStart {
        speaker: call_utterances::Speaker,
        seq: i32,
    },
    /// A chunk of that synthesized audio. `offset_ms` is the same
    /// first-chunk-only padding hint as `Mic`'s.
    TtsAudio {
        speaker: call_utterances::Speaker,
        sample_rate: u32,
        offset_ms: Option<i32>,
        samples: Vec<i16>,
    },
    /// Synthesis is done — closes whatever span `TtsBoundaryStart` most
    /// recently opened for this `speaker`'s pipeline. No `seq` here: the
    /// writer already knows which one is open, from the matching
    /// `TtsBoundaryStart` it already saw.
    TtsBoundaryEnd { speaker: call_utterances::Speaker },
}

struct PendingRow {
    speaker: call_utterances::Speaker,
    original_text: String,
    original_language: Option<agents::Language>,
    translated_text: Option<String>,
    translated_language: Option<agents::Language>,
    offset_ms: Option<i32>,
    duration_ms: Option<i32>,
}

impl PendingRow {
    fn into_active(self, call_id: Uuid) -> call_utterances::ActiveModel {
        call_utterances::ActiveModel {
            id: NotSet,
            call_id: Set(call_id),
            seq: Set(0), // replaced by the caller, which owns the seq
            speaker: Set(self.speaker),
            original_text: Set(self.original_text),
            original_language: Set(self.original_language),
            translated_text: Set(self.translated_text),
            translated_language: Set(self.translated_language),
            offset_ms: Set(self.offset_ms),
            // From Sarvam's return_timestamps (see stages/stt.rs); None for
            // any provider that doesn't supply turn-level timestamps.
            duration_ms: Set(self.duration_ms),
            // Filled in once the translated-track recorder exists.
            translated_offset_ms: NotSet,
            translated_duration_ms: NotSet,
            created_at: Set(Utc::now().fixed_offset()),
        }
    }
}

/// Per-call handle. Construct once where the call is set up, then hand each
/// translation pipeline its own observer.
pub struct CallRecorder {
    tx: UnboundedSender<Event>,
    /// Held until `spawn`. The observers have to exist before the pipelines
    /// are built, but the `CallHandle` the writer subscribes to only exists
    /// after them — so construction and spawning are two steps.
    rx: Option<UnboundedReceiver<Event>>,
    seq: Arc<AtomicI32>,
    /// Set by the writer when the call reaches `Connected`. Every `offset_ms`
    /// is measured from it, so it is also what the recording must be aligned
    /// to — see `calls.connected_at`.
    connected_at: Arc<OnceLock<Instant>>,
}

impl Default for CallRecorder {
    fn default() -> Self {
        Self::new()
    }
}

impl CallRecorder {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::unbounded_channel();
        Self {
            tx,
            rx: Some(rx),
            seq: Arc::new(AtomicI32::new(0)),
            connected_at: Arc::new(OnceLock::new()),
        }
    }

    /// Starts the writer task. Call once the registry has handed back the
    /// call's `CallHandle`, whose status channel drives the `calls` row.
    pub fn spawn(mut self, call_id: Uuid, handle: Arc<CallHandle>) {
        let Some(rx) = self.rx.take() else {
            return;
        };
        tokio::spawn(run_writer(call_id, rx, handle, self.connected_at));
    }

    /// One per direction: `a2b` records the caller's turns, `b2a` the callee's.
    /// Both share this recorder's seq counter, so their turns interleave into a
    /// single ordered transcript rather than two independent sequences.
    pub fn observer(
        &self,
        speaker: call_utterances::Speaker,
        original_language: Option<agents::Language>,
        translated_language: Option<agents::Language>,
    ) -> Arc<CallRecordObserver> {
        Arc::new(CallRecordObserver {
            speaker,
            original_language,
            translated_language,
            tx: self.tx.clone(),
            seq: Arc::clone(&self.seq),
            connected_at: Arc::clone(&self.connected_at),
            awaiting_translation: Mutex::new(VecDeque::new()),
            awaiting_tts: Mutex::new(VecDeque::new()),
        })
    }
}

pub struct CallRecordObserver {
    speaker: call_utterances::Speaker,
    original_language: Option<agents::Language>,
    translated_language: Option<agents::Language>,
    tx: UnboundedSender<Event>,
    seq: Arc<AtomicI32>,
    connected_at: Arc<OnceLock<Instant>>,
    /// Turns whose MT output hasn't arrived yet. MT lags the turn that
    /// produced it, and can lag by more than one turn under load, so this is a
    /// queue rather than a single slot.
    awaiting_translation: Mutex<VecDeque<i32>>,
    /// Same idea, popped when TTS starts synthesizing instead of when MT
    /// finishes translating. Known gap: if `stages/tts.rs` skips a turn
    /// entirely (`has_speakable_chars` fails — e.g. digits-only translated
    /// text), no `(Stage::Tts, MtText)` ever fires for it, this queue never
    /// pops that entry, and every later boundary is misattributed by one.
    /// Rare in practice; not handled yet.
    awaiting_tts: Mutex<VecDeque<i32>>,
}

impl CallRecordObserver {
    fn offset_ms(&self) -> Option<i32> {
        let connected = self.connected_at.get()?;
        i32::try_from(connected.elapsed().as_millis()).ok()
    }
}

impl FrameObserver for CallRecordObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        match (stage, frame.kind()) {
            // The finalized turn. Interim `Transcription` frames are
            // deliberately ignored: they are replaced on every partial, so
            // persisting them would multiply rows for text that is immediately
            // overwritten. Live partials reach the client over the data
            // channel, not through here.
            (Stage::Stt, FrameKind::UserTurnAggregation(turn)) => {
                let seq = self.seq.fetch_add(1, Ordering::Relaxed);
                if let Ok(mut queue) = self.awaiting_translation.lock() {
                    queue.push_back(seq);
                }
                if let Ok(mut queue) = self.awaiting_tts.lock() {
                    queue.push_back(seq);
                }
                let _ = self.tx.send(Event::Turn {
                    seq,
                    speaker: self.speaker.clone(),
                    original_language: self.original_language.clone(),
                    translated_language: self.translated_language.clone(),
                    text: turn.text.clone(),
                    offset_ms: self.offset_ms(),
                    duration_ms: turn.duration_ms,
                });
            }
            // Only from the `mt` stage: `tts` re-pushes `MtText` downstream
            // (stages/tts.rs), and matching that too would double every line.
            (Stage::Mt, FrameKind::MtText(mt)) => {
                let Some(seq) = self
                    .awaiting_translation
                    .lock()
                    .ok()
                    .and_then(|mut queue| queue.pop_front())
                else {
                    return;
                };
                let _ = self.tx.send(Event::Translation {
                    seq,
                    text: mt.text.clone(),
                });
            }
            // This leg's own raw mic input — pushed at the transport<->
            // pipeline boundary (see http::handlers::call::start_call,
            // a_transport_io/b_transport_io), before STT ever sees it, so
            // this is unprocessed, undecimated audio. Tagged CallA/CallB
            // (whichever leg this observer is attached to), never Pipeline —
            // that stage name belongs to the *inner* STT/MT/TTS chain this
            // same observer also watches for Turn/Translation/Tts* events.
            (Stage::CallA | Stage::CallB, FrameKind::RawAudio(audio)) => {
                let _ = self.tx.send(Event::Mic {
                    speaker: self.speaker.clone(),
                    sample_rate: audio.sample_rate,
                    offset_ms: self.offset_ms(),
                    samples: crate::audio::pcm::decode_pcm_le(&audio.audio),
                });
            }
            // TTS relays MtText downstream right before it starts
            // synthesizing it (stages/tts.rs) — the same signal that marks
            // "this turn's translated audio is about to begin".
            (Stage::Tts, FrameKind::MtText(_)) => {
                let Some(seq) = self
                    .awaiting_tts
                    .lock()
                    .ok()
                    .and_then(|mut queue| queue.pop_front())
                else {
                    return;
                };
                let _ = self.tx.send(Event::TtsBoundaryStart {
                    speaker: self.speaker.clone(),
                    seq,
                });
            }
            (Stage::Tts, FrameKind::TtsAudio(audio)) => {
                let _ = self.tx.send(Event::TtsAudio {
                    speaker: self.speaker.clone(),
                    sample_rate: audio.sample_rate,
                    offset_ms: self.offset_ms(),
                    samples: crate::audio::pcm::decode_pcm_le(&audio.audio),
                });
            }
            (Stage::Tts, FrameKind::TtsAudioStop) => {
                let _ = self.tx.send(Event::TtsBoundaryEnd {
                    speaker: self.speaker.clone(),
                });
            }
            _ => {}
        }
    }
}

/// One turn's translated-audio span within a `LegBuffers::tts_output` buffer,
/// in sample indices at that buffer's own `sample_rate`.
struct TtsBoundary {
    seq: i32,
    start_sample: usize,
    end_sample: usize,
}

/// One pipeline leg's captured audio: its own mic, and whatever TTS output
/// that same pipeline produced (which is destined for the *other* leg, not
/// this one — see `Event::TtsBoundaryStart`). Both buffers start life empty
/// and get front-padded with silence on their first chunk, up to that
/// chunk's wall-clock `offset_ms` — otherwise a mic buffer (starts filling
/// near `connected_at`) and a tts_output buffer (starts filling only once
/// the first STT->MT->TTS round trip completes, seconds later) would both
/// begin at sample 0 and drift out of sync with each other.
#[derive(Default)]
struct LegBuffers {
    mic: Vec<i16>,
    mic_sample_rate: Option<u32>,
    tts_output: Vec<i16>,
    tts_sample_rate: Option<u32>,
    tts_boundaries: Vec<TtsBoundary>,
}

impl LegBuffers {
    /// Pads `buf` with `offset_ms` worth of silence if this is its first
    /// chunk (buffer still empty, rate not yet recorded) — a no-op on every
    /// later chunk for the same buffer. Returns whether this chunk should be
    /// recorded at all: a `None` offset on the first chunk means audio
    /// arrived before `connected_at` was set (see `CallRecordObserver::
    /// offset_ms`), so there's no anchor to align it against yet — recording
    /// it anyway would glue it to position 0 and burn the one first-chunk
    /// slot the real, properly-offset first chunk needs.
    fn pad_on_first_chunk(
        buf: &mut Vec<i16>,
        recorded_rate: &mut Option<u32>,
        sample_rate: u32,
        offset_ms: Option<i32>,
    ) -> bool {
        if recorded_rate.is_some() {
            return true;
        }
        let Some(ms) = offset_ms else {
            return false;
        };
        *recorded_rate = Some(sample_rate);
        let silence_samples = if ms > 0 {
            (ms as u64 * sample_rate as u64 / 1000) as usize
        } else {
            0
        };
        buf.resize(silence_samples, 0);
        true
    }

    fn push_mic(&mut self, sample_rate: u32, offset_ms: Option<i32>, samples: Vec<i16>) {
        if !Self::pad_on_first_chunk(
            &mut self.mic,
            &mut self.mic_sample_rate,
            sample_rate,
            offset_ms,
        ) {
            return;
        }
        self.mic.extend(samples);
    }

    fn push_tts(&mut self, sample_rate: u32, offset_ms: Option<i32>, samples: Vec<i16>) {
        if !Self::pad_on_first_chunk(
            &mut self.tts_output,
            &mut self.tts_sample_rate,
            sample_rate,
            offset_ms,
        ) {
            return;
        }
        self.tts_output.extend(samples);
    }
}

/// A `TtsBoundaryStart` that hasn't seen its matching `TtsBoundaryEnd` yet.
struct OpenTtsBoundary {
    seq: i32,
    start_sample: usize,
}

/// Both legs' captured audio for one call. Which buffers end up in which
/// final recording is a finalize-time decision (original = caller.mic +
/// callee.mic; translated, for whichever account owns this call, = its own
/// mic + the *other* leg's tts_output) — not decided here, this only collects.
#[derive(Default)]
struct AudioState {
    caller: LegBuffers,
    callee: LegBuffers,
    /// The boundary currently open per leg, if any.
    caller_open_boundary: Option<OpenTtsBoundary>,
    callee_open_boundary: Option<OpenTtsBoundary>,
}

impl AudioState {
    fn leg_mut(&mut self, speaker: &call_utterances::Speaker) -> &mut LegBuffers {
        match speaker {
            call_utterances::Speaker::Caller => &mut self.caller,
            call_utterances::Speaker::Callee => &mut self.callee,
        }
    }

    fn open_boundary_mut(
        &mut self,
        speaker: &call_utterances::Speaker,
    ) -> &mut Option<OpenTtsBoundary> {
        match speaker {
            call_utterances::Speaker::Caller => &mut self.caller_open_boundary,
            call_utterances::Speaker::Callee => &mut self.callee_open_boundary,
        }
    }
}

async fn run_writer(
    call_id: Uuid,
    mut rx: UnboundedReceiver<Event>,
    handle: Arc<CallHandle>,
    connected_at: Arc<OnceLock<Instant>>,
) {
    let mut status = handle.watch_status();
    let mut open: HashMap<i32, PendingRow> = HashMap::new();
    let mut ready: Vec<(i32, PendingRow)> = Vec::new();
    let mut audio = AudioState::default();
    let mut ticker = time::interval(FLUSH_INTERVAL);
    ticker.set_missed_tick_behavior(time::MissedTickBehavior::Skip);

    loop {
        tokio::select! {
            event = rx.recv() => {
                match event {
                    Some(Event::Turn {
                        seq, speaker, original_language, translated_language, text, offset_ms,
                        duration_ms,
                    }) => {
                        open.insert(seq, PendingRow {
                            speaker,
                            original_text: text,
                            original_language,
                            translated_text: None,
                            translated_language,
                            offset_ms,
                            duration_ms,
                        });
                    }
                    Some(Event::Translation { seq, text }) => {
                        // A row becomes insertable once its translation lands,
                        // so a line is written exactly once — no INSERT then
                        // UPDATE, and no half-rows in history.
                        if let Some(mut row) = open.remove(&seq) {
                            row.translated_text = Some(text);
                            ready.push((seq, row));
                        }
                    }
                    Some(Event::Mic { speaker, sample_rate, offset_ms, samples }) => {
                        audio.leg_mut(&speaker).push_mic(sample_rate, offset_ms, samples);
                    }
                    Some(Event::TtsBoundaryStart { speaker, seq }) => {
                        let start_sample = audio.leg_mut(&speaker).tts_output.len();
                        *audio.open_boundary_mut(&speaker) =
                            Some(OpenTtsBoundary { seq, start_sample });
                    }
                    Some(Event::TtsAudio { speaker, sample_rate, offset_ms, samples }) => {
                        audio.leg_mut(&speaker).push_tts(sample_rate, offset_ms, samples);
                    }
                    Some(Event::TtsBoundaryEnd { speaker }) => {
                        if let Some(OpenTtsBoundary { seq, start_sample: start }) =
                            audio.open_boundary_mut(&speaker).take()
                        {
                            let end = audio.leg_mut(&speaker).tts_output.len();
                            audio.leg_mut(&speaker).tts_boundaries.push(TtsBoundary {
                                seq,
                                start_sample: start,
                                end_sample: end,
                            });
                        }
                    }
                    // Every observer dropped: the call's pipelines are gone.
                    None => break,
                }

                if ready.len() >= FLUSH_BATCH {
                    flush(call_id, &mut ready).await;
                }
            }

            _ = ticker.tick() => {
                flush(call_id, &mut ready).await;
            }

            changed = status.changed() => {
                if changed.is_err() {
                    break; // Registry dropped the handle.
                }
                let live = *status.borrow();
                if let Err(e) = apply_status(call_id, live, &connected_at).await {
                    tracing::warn!(%call_id, error = %e, "call record: status update failed");
                }
                if let LiveStatus::Ended(_) = live {
                    break;
                }
            }
        }
    }

    // Turns still waiting on MT when the call ended are real speech and belong
    // in the transcript; they just never got translated.
    for (seq, row) in open.drain() {
        ready.push((seq, row));
    }
    ready.sort_by_key(|(seq, _)| *seq);
    flush(call_id, &mut ready).await;

    finalize_recording(call_id, audio).await;
}

const RECORDING_CONTENT_TYPE: &str = "audio/wav";

/// PCM WAV, interleaved stereo. Channels of unequal length (routine: the two
/// legs captured at different real durations) are silence-padded to match
/// rather than truncated, so neither channel's audio gets cut off early.
fn build_wav_stereo(left: &[i16], right: &[i16], sample_rate: u32) -> Vec<u8> {
    let spec = hound::WavSpec {
        channels: 2,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let len = left.len().max(right.len());
    let mut cursor = std::io::Cursor::new(Vec::with_capacity(44 + len * 4));
    {
        // A Vec-backed cursor can't fail with an I/O error, so the only way
        // any of this returns Err is a hound bug — worth panicking on rather
        // than silently producing a corrupt or empty recording.
        let mut writer =
            hound::WavWriter::new(&mut cursor, spec).expect("failed to start WAV writer");
        for i in 0..len {
            writer
                .write_sample(left.get(i).copied().unwrap_or(0))
                .expect("failed to write WAV sample");
            writer
                .write_sample(right.get(i).copied().unwrap_or(0))
                .expect("failed to write WAV sample");
        }
        writer.finalize().expect("failed to finalize WAV file");
    }
    cursor.into_inner()
}

enum RecordingSlot {
    Original,
    Translated,
}

async fn upload_and_link(
    client: &SupabaseStorageClient,
    bucket: &str,
    call_id: Uuid,
    file_stem: &str,
    wav: Vec<u8>,
    slot: RecordingSlot,
) {
    let path = format!("{call_id}/{file_stem}.wav");
    if let Err(e) = client
        .upload(bucket, &path, RECORDING_CONTENT_TYPE, wav)
        .await
    {
        tracing::warn!(%call_id, error = %e, "call record: recording upload failed");
        return;
    }

    // Stores the bucket-relative object path, not a URL — the mobile client
    // builds the actual request itself, straight to Storage's `authenticated`
    // download route with its own session JWT, so this is never rendered
    // directly as a link (see m20260901_000001_recording_storage_rls).
    let mut model = calls::ActiveModel {
        id: Unchanged(call_id),
        updated_at: Set(Utc::now().fixed_offset()),
        ..Default::default()
    };
    match slot {
        RecordingSlot::Original => model.recording_path = Set(Some(path)),
        RecordingSlot::Translated => model.translated_recording_path = Set(Some(path)),
    }
    if let Err(e) = model.update(db::get()).await {
        tracing::warn!(%call_id, error = %e, "call record: recording url write failed");
    }
}

/// Builds and uploads both recordings, and writes the callee's turns'
/// timing into the translated recording. Nothing here is on the audio
/// path — this runs once, after the call has already ended, so a slow or
/// failed upload only ever logs a warning, never blocks or breaks the call
/// itself.
async fn finalize_recording(call_id: Uuid, audio: AudioState) {
    let Ok(cfg) = config::get() else {
        tracing::warn!(%call_id, "call record: config unavailable, skipping recording upload");
        return;
    };

    let client =
        SupabaseStorageClient::new(cfg.supabase_url.clone(), cfg.supabase_secret_key.clone());
    let bucket = cfg.supabase_recordings_bucket.clone();

    // Original: each party's own voice, untouched.
    match (audio.caller.mic_sample_rate, audio.callee.mic_sample_rate) {
        (Some(a), Some(b)) if a == b => {
            let wav = build_wav_stereo(&audio.caller.mic, &audio.callee.mic, a);
            upload_and_link(
                &client,
                &bucket,
                call_id,
                "original",
                wav,
                RecordingSlot::Original,
            )
            .await;
        }
        (Some(a), Some(b)) => {
            tracing::warn!(%call_id, a, b, "call record: mic sample rates differ, skipping original recording");
        }
        _ => {}
    }

    // Translated: the call owner's (caller's) own voice, plus the TTS
    // translation of the callee — literally what the owner heard live.
    match (audio.caller.mic_sample_rate, audio.callee.tts_sample_rate) {
        (Some(a), Some(b)) if a == b => {
            let wav = build_wav_stereo(&audio.caller.mic, &audio.callee.tts_output, a);
            upload_and_link(
                &client,
                &bucket,
                call_id,
                "translated",
                wav,
                RecordingSlot::Translated,
            )
            .await;
        }
        (Some(a), Some(b)) => {
            tracing::warn!(%call_id, a, b, "call record: mic/tts sample rates differ, skipping translated recording");
        }
        _ => {}
    }

    // Only the callee's turns need this: their translated audio is what
    // occupies part of the caller's translated recording. The caller's own
    // turns sit in that same recording as their own unmodified voice, at
    // the same position `offset_ms`/`duration_ms` already describe.
    if let Some(rate) = audio.callee.tts_sample_rate {
        for boundary in &audio.callee.tts_boundaries {
            let offset_ms = (boundary.start_sample as u64 * 1000 / rate as u64) as i32;
            let duration_ms =
                ((boundary.end_sample - boundary.start_sample) as u64 * 1000 / rate as u64) as i32;
            if let Err(e) = call_utterances::Entity::update_many()
                .filter(call_utterances::Column::CallId.eq(call_id))
                .filter(call_utterances::Column::Seq.eq(boundary.seq))
                .set(call_utterances::ActiveModel {
                    translated_offset_ms: Set(Some(offset_ms)),
                    translated_duration_ms: Set(Some(duration_ms)),
                    ..Default::default()
                })
                .exec(db::get())
                .await
            {
                tracing::warn!(%call_id, seq = boundary.seq, error = %e, "call record: translated timing update failed");
            }
        }
    }
}

async fn flush(call_id: Uuid, ready: &mut Vec<(i32, PendingRow)>) {
    if ready.is_empty() {
        return;
    }
    let models: Vec<call_utterances::ActiveModel> = ready
        .drain(..)
        .map(|(seq, row)| {
            let mut model = row.into_active(call_id);
            model.seq = Set(seq);
            model
        })
        .collect();

    // A failed transcript write must never take the call down with it — the
    // conversation is still happening, and a lost line is not worth ending it.
    if let Err(e) = call_utterances::Entity::insert_many(models)
        .exec(db::get())
        .await
    {
        tracing::warn!(%call_id, error = %e, "call record: utterance insert failed");
    }
}

async fn apply_status(
    call_id: Uuid,
    live: LiveStatus,
    connected_at: &Arc<OnceLock<Instant>>,
) -> db::Result<()> {
    let now = Utc::now().fixed_offset();
    let mut model = calls::ActiveModel {
        id: Unchanged(call_id),
        updated_at: Set(now),
        ..Default::default()
    };

    match live {
        LiveStatus::Dialing => {
            // Only ever the registry entry's initial value, never re-sent
            // through `set_status`, so a fresh subscriber never observes it as
            // a change. The INSERT already wrote this state.
            return Ok(());
        }
        LiveStatus::Ringing => {
            model.status = Set(calls::Status::Ringing);
            model.ringing_at = Set(Some(now));
        }
        LiveStatus::Connected => {
            let _ = connected_at.set(Instant::now());
            model.status = Set(calls::Status::Connected);
            model.connected_at = Set(Some(now));
        }
        LiveStatus::Ended(reason) => {
            model.status = Set(calls::Status::Ended);
            model.end_reason = Set(Some(map_end_reason(reason)));
            model.ended_at = Set(Some(now));
            // Never connected means nothing billable, however long it rang.
            let seconds = connected_at
                .get()
                .map(|start| start.elapsed().as_secs())
                .unwrap_or(0);
            model.billable_seconds = Set(i32::try_from(seconds).unwrap_or(i32::MAX));
        }
    }

    model.update(db::get()).await?;
    Ok(())
}

fn map_end_reason(reason: LiveEndReason) -> calls::EndReason {
    match reason {
        LiveEndReason::Busy => calls::EndReason::Busy,
        LiveEndReason::NoAnswer => calls::EndReason::NoAnswer,
        LiveEndReason::Failed => calls::EndReason::Failed,
        LiveEndReason::HungUpByA => calls::EndReason::HungUpByA,
        LiveEndReason::HungUpByB => calls::EndReason::HungUpByB,
    }
}
