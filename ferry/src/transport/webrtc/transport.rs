use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use bytes::BytesMut;
use rtc::media::Sample;
use rtc::media_stream::MediaStreamTrack;
use rtc::rtp_transceiver::rtp_sender::{
    RTCRtpCodec, RTCRtpCodecParameters, RTCRtpCodingParameters, RTCRtpEncodingParameters,
    RtpCodecKind,
};
use tokio::sync::oneshot;
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::media_stream::track_local::TrackLocal;
use webrtc::media_stream::track_local::static_sample::TrackLocalStaticSample;
use webrtc::media_stream::track_remote::{TrackRemote, TrackRemoteEvent};
use webrtc::peer_connection::{
    MediaEngine, PeerConnection, PeerConnectionBuilder, PeerConnectionEventHandler,
    RTCConfigurationBuilder, RTCIceGatheringState, RTCSessionDescription, Registry,
    register_default_interceptors,
};
use webrtc::runtime::default_runtime;

use crate::audio::opus::{OpusDecoder, OpusEncoder, SAMPLE_RATE};
use crate::call::CallStatus;
use crate::codec::frame_serializer::FrameSerializer;
use crate::codec::transport::webrtc_dc::{CALL_ENDED_TAG, CALL_RINGING_TAG, PEER_CONNECTED_TAG};
use crate::frames::{Frame, FrameKind, RawAudioFrame};
use crate::transport::base::BaseTransport;

/// RTP payload type we assign Opus in our own SDP — arbitrary but fixed,
/// since we register the codec ourselves rather than negotiating
/// dynamically.
const OPUS_PAYLOAD_TYPE: u8 = 120;

/// Per RFC 7587, Opus is always signaled at a 48000Hz clock rate and 2
/// channels in SDP regardless of the audio's actual encode/decode rate or
/// channel count — that's a wire-format convention, not what the codec
/// itself operates at (we run Opus at `SAMPLE_RATE`/mono, see `audio::opus`).
const OPUS_SDP_CLOCK_RATE: u32 = 48000;
const OPUS_SDP_CHANNELS: u16 = 2;

/// How long `run()` will wait without a single inbound audio frame before
/// giving up on the connection — checked from the moment `run()` starts,
/// before the data channel has even opened, straight through the rest of
/// the call. The client's mic track keeps sending packets continuously
/// while the peer connection is alive (no DTX/silence suppression is
/// negotiated), so a stall this long means the connection is gone, not that
/// the caller is quiet. Without this, a connection abandoned mid-handshake
/// (offer accepted, but the client never completes it) leaves this task's
/// `.await` parked forever, which — because a `SessionGuard` is held for
/// exactly as long as this task runs — also leaves the caller's
/// `UserSessionRegistry` entry live forever, 409-locking them out of
/// starting a real session.
const AUDIO_IDLE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// Bounds `run()`'s wait for the pacer to notice `stopped` and exit. Normally
/// at most one frame period (`FRAME_DURATION_MS`) — this is the backstop for
/// a `write_sample` call that never returns (a stalled/dead transport), since
/// an un-bounded `pacer.await` here would defeat `AUDIO_IDLE_TIMEOUT` itself:
/// `run()` wouldn't return, so `SessionGuard` wouldn't drop, so the same
/// stuck-session symptom `AUDIO_IDLE_TIMEOUT` exists to prevent would still
/// happen, just moved one step later.
const PACER_SHUTDOWN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(2);

/// One 20ms frame at 16kHz mono, 16-bit PCM — Opus only accepts fixed frame
/// durations (2.5/5/10/20/40/60ms); this is the size TTS chunks get grouped
/// into before encoding, since providers hand back audio in their own
/// chunk sizes, not 20ms-aligned ones.
const FRAME_DURATION_MS: u64 = 20;
const FRAME_SAMPLES: usize = SAMPLE_RATE as usize * FRAME_DURATION_MS as usize / 1000;
const FRAME_BYTES: usize = FRAME_SAMPLES * 2;

/// How much PCM must accumulate before the pacer starts draining a *new*
/// utterance. TTS providers hand audio back in bursts with uneven gaps
/// between chunks — not a steady 20ms-per-tick supply — so draining the
/// instant the first chunk shows up exposes that delivery jitter directly as
/// an underrun right at the start of a sentence, which is where it is most
/// audible. This is pure added latency, so it is kept to roughly the size of
/// one TTS chunk's worth of jitter rather than anything generous.
const PREROLL_MS: u64 = 120;
const PREROLL_BYTES: usize = (SAMPLE_RATE as usize * PREROLL_MS as usize / 1000) * 2;

/// The same gate, but for an underrun that happens *mid*-utterance rather
/// than at its start. Re-arming the full `PREROLL_MS` there is what turns a
/// momentary supply hiccup into an audible hole in the middle of a word: the
/// pacer stops emitting real audio until a fifth of a second has piled up,
/// every time. Mid-utterance the buffer is only ever a chunk-delivery
/// wobble away from refilling, so a much smaller gate costs one short
/// concealment instead of a gap — and unlike the start of an utterance there
/// is no silence around it to hide a long pause in.
const RESUME_MS: u64 = 40;
const RESUME_BYTES: usize = (SAMPLE_RATE as usize * RESUME_MS as usize / 1000) * 2;

/// How far behind its own schedule the pacer will let itself get before it
/// stops trying to catch up and just resumes from now. Catching up matters:
/// RTP timestamps advance by exactly one frame per packet, so a pacer that
/// quietly emits fewer than 50 frames per second of wall clock is telling
/// the receiver less time passed than really did, and its jitter buffer
/// drains until every packet is concealed — which is what "metallic" and
/// "words dropping out" actually sound like. But catching up from an
/// arbitrarily long stall would dump that whole backlog on the wire at once,
/// the burst the pacer exists to prevent, so past this point the stall is
/// absorbed as latency instead.
const MAX_CATCHUP_MS: u64 = 100;

/// Purely a "something is wrong" tripwire on the outbound buffer. Audio is
/// played out in real time by definition, so anything that piles up here is
/// latency the listener will actually experience; if a call ever gets this
/// far behind, the interesting fact is that it happened, not the buffer
/// itself (dropping the audio would just replace delay with missing words).
const BACKLOG_WARN_BYTES: usize = SAMPLE_RATE as usize * 2 * 5;

/// The answerer must echo back whatever payload type number the offer used
/// for a matching codec (JSEP) — not necessarily `OPUS_PAYLOAD_TYPE`, which
/// is only the number we register the codec under locally. Reads the number
/// actually written into our own answer SDP so outgoing packets are tagged
/// with what the client was told to expect.
fn parse_negotiated_opus_payload_type(sdp: &str) -> Option<u8> {
    sdp.lines().find_map(|line| {
        let (pt, rest) = line.strip_prefix("a=rtpmap:")?.split_once(' ')?;
        rest.starts_with("opus/").then(|| pt.parse().ok())?
    })
}

fn opus_codec() -> RTCRtpCodec {
    RTCRtpCodec {
        mime_type: "audio/opus".to_string(),
        clock_rate: OPUS_SDP_CLOCK_RATE,
        channels: OPUS_SDP_CHANNELS,
        sdp_fmtp_line: String::new(),
        rtcp_feedback: vec![],
    }
}

/// The WebRTC doorway: signaling (SDP offer/answer), the data-channel
/// read/write loop, and the Opus audio track in both directions.
/// Everything pipeline-facing lives in `BaseTransport`, same division of
/// labor as `WebSocketClient`.
///
/// Audio flows over a real Opus RTP track in both directions (inbound mic,
/// outbound TTS) rather than raw PCM on the data channel — the data channel
/// carries only transcripts, translations, and call-status control bytes.
/// The client's native WebRTC stack (e.g. `react-native-webrtc`'s NetEQ)
/// handles jitter buffering and steady playout on receipt.
///
/// Outbound TTS audio is paced to one `FRAME_DURATION_MS` frame per real
/// `FRAME_DURATION_MS` of wall clock, not written as fast as it arrives.
/// TTS hands audio back in large, bursty chunks — without pacing, a whole
/// utterance's worth of RTP packets go out within a few milliseconds of each
/// other, which is enough to actually overrun a Wi-Fi radio's buffering and
/// cause real packet loss (confirmed via the client's own `getStats()`:
/// climbing `packetsLost`/`jitter` and ~30-40% `concealedSamples`) — not a
/// timing/jitter-buffer artifact, genuine drops.
///
/// That pacing runs in its own task (`spawn_pacer`), not as a branch of
/// `run`'s `select!`. It has to: a `select!` runs one branch at a time, so
/// sharing the loop means every mic packet forwarded into the pipeline, every
/// data-channel message, and every await on pipeline backpressure pushes the
/// next audio frame out past its deadline. Emitting even slightly fewer than
/// 50 frames per second of wall clock starves the receiver's jitter buffer —
/// RTP timestamps say less time passed than really did — and NetEQ conceals
/// the difference, which is audible as metallic, stuttery, word-dropping
/// speech. Keeping the pacer on its own task and its own absolute schedule
/// means nothing else in the transport can perturb its cadence.
pub struct WebRtcClient<S: FrameSerializer<Message = bytes::Bytes>> {
    base: BaseTransport<S>,
    peer_connection: Box<dyn PeerConnection>,
    data_channel_rx: oneshot::Receiver<Arc<dyn DataChannel>>,
    /// Decoded mic audio (`RawAudioFrame`s), forwarded from the `on_track`
    /// handler's RTP-receive task into the pipeline.
    inbound_audio_rx: tokio::sync::mpsc::Receiver<Frame>,
    output_track: Arc<TrackLocalStaticSample>,
    output_ssrc: u32,
    /// The Opus payload type actually negotiated in the answer SDP for this
    /// call — varies per client/call, not the fixed `OPUS_PAYLOAD_TYPE` we
    /// register our codec under locally. Sending with the wrong value means
    /// the client silently drops every audio packet as unrecognized.
    output_payload_type: u8,
    /// Handed to `spawn_pacer`; `run` only ever writes into it (TTS PCM in,
    /// utterance boundaries) and never reads a frame back out.
    outbound_audio: Arc<Mutex<OutboundAudio>>,
    /// Fires when the call's `CallRegistry` entry transitions to `Ended` —
    /// Twilio reporting busy/no-answer/failed, or the Twilio leg hanging up
    /// — so this side hangs up too instead of sitting connected with no
    /// audio ever arriving. `None` for one-way/no-registry calls (e.g. the
    /// try-agent screen), which have no other leg to watch.
    status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
}

/// Outbound TTS audio in flight between the transport's event loop (which
/// fills it) and the pacer task (which drains it, one frame per tick).
///
/// Guarded by a `std::sync::Mutex` on purpose: every critical section is a
/// couple of memcpys with no `.await` inside, so an async mutex would add
/// scheduling overhead to a lock held for microseconds — and the one thing
/// this must never do is make the pacer wait.
struct OutboundAudio {
    /// Little-endian PCM16 at `SAMPLE_RATE`, accumulated across `TtsAudio`
    /// frames — providers chunk on their own boundaries, never 20ms ones.
    pcm: VecDeque<u8>,
    /// True between `TtsAudioStart` and `TtsAudioStop`: more audio for the
    /// utterance being spoken is still on its way. This is what lets the
    /// pacer tell the two very different meanings of an empty buffer apart —
    /// "the provider is a beat late, wait for it" versus "that was the whole
    /// utterance, flush the tail and go quiet" — instead of guessing from
    /// the buffer level alone.
    producing: bool,
    /// Whether the pacer is currently draining real audio (`true`) or
    /// accumulating up to `gate_bytes` before it starts (`false`).
    draining: bool,
    /// How much PCM must accumulate before draining (re)starts:
    /// `PREROLL_BYTES` at the start of an utterance, `RESUME_BYTES` after a
    /// mid-utterance underrun.
    gate_bytes: usize,
    /// Set by `run` on its way out so the pacer finishes the frame it is on
    /// and returns, rather than being aborted part-way through a
    /// `write_sample`.
    stopped: bool,
}

impl OutboundAudio {
    fn new() -> Self {
        Self {
            pcm: VecDeque::new(),
            producing: false,
            draining: false,
            gate_bytes: PREROLL_BYTES,
            stopped: false,
        }
    }

    /// The PCM to send on this tick, or `None` to send a silence frame.
    ///
    /// `None` is never a skipped packet: the pacer sends silence instead, so
    /// the RTP stream stays continuous and its timestamps keep tracking wall
    /// clock even across the seconds-long quiet stretches between utterances.
    /// (Going genuinely silent there instead makes the next real frame claim
    /// only one frame's worth of time passed since the last one, and the
    /// receiver garbles the start of the next utterance reconciling that.)
    fn take_frame(&mut self) -> Option<Vec<u8>> {
        if !self.draining {
            // Once the provider has said it is done, whatever is buffered is
            // the whole remainder — there is nothing left to wait for, and a
            // short utterance would otherwise sit here forever below a gate
            // no further audio is coming to lift.
            let ready =
                self.pcm.len() >= self.gate_bytes || (!self.producing && !self.pcm.is_empty());
            if !ready {
                return None;
            }
            self.draining = true;
        }

        if self.pcm.len() >= FRAME_BYTES {
            return Some(self.pcm.drain(..FRAME_BYTES).collect());
        }

        if self.producing {
            // Underran mid-utterance: more is coming, just not yet. Conceal
            // this one tick and re-arm on the short gate.
            self.draining = false;
            self.gate_bytes = RESUME_BYTES;
            return None;
        }

        // The utterance is over. Anything under a frame left is its tail —
        // pad it out rather than stranding it in the buffer, where it would
        // otherwise be prepended to the *next* utterance as a click.
        self.draining = false;
        self.gate_bytes = PREROLL_BYTES;
        if self.pcm.is_empty() {
            return None;
        }
        let mut tail: Vec<u8> = self.pcm.drain(..).collect();
        tail.resize(FRAME_BYTES, 0);
        Some(tail)
    }
}

/// Drives the outbound Opus track: exactly one `FRAME_DURATION_MS` frame per
/// `FRAME_DURATION_MS` of wall clock, forever, real audio when there is any
/// and silence when there isn't. See `WebRtcClient`'s doc comment for why
/// this is a task of its own rather than a branch of `run`'s `select!`.
fn spawn_pacer(
    track: Arc<TrackLocalStaticSample>,
    ssrc: u32,
    payload_type: u8,
    audio: Arc<Mutex<OutboundAudio>>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let mut encoder = match OpusEncoder::new() {
            Ok(encoder) => encoder,
            Err(e) => {
                tracing::error!("webrtc: failed to init opus encoder, no outbound audio: {e}");
                return;
            }
        };

        let period = std::time::Duration::from_millis(FRAME_DURATION_MS);
        let max_catchup = std::time::Duration::from_millis(MAX_CATCHUP_MS);
        // Deadlines are absolute and advance by exactly `period` each frame,
        // so however long encoding and `write_sample` take, the *next* frame
        // still goes out on the original schedule. `tokio::time::interval`
        // with `MissedTickBehavior::Delay` would instead restart the period
        // from whenever the tick was actually polled, quietly shedding a few
        // milliseconds per frame and drifting below real time indefinitely.
        let mut next_tick = tokio::time::Instant::now() + period;
        let mut frames_sent: u64 = 0;

        loop {
            tokio::time::sleep_until(next_tick).await;
            next_tick += period;

            let now = tokio::time::Instant::now();
            if now > next_tick + max_catchup {
                // Too far behind to make up without bursting — take the
                // stall as latency and resume cleanly from here.
                tracing::debug!(
                    behind_ms = (now - next_tick).as_millis() as u64,
                    "webrtc: pacer fell behind, resyncing"
                );
                next_tick = now + period;
            }

            let pcm = {
                let mut audio = audio.lock().unwrap();
                if audio.stopped {
                    break;
                }
                audio.take_frame()
            };

            let mut samples = [0i16; FRAME_SAMPLES];
            if let Some(bytes) = pcm {
                for (sample, raw) in samples.iter_mut().zip(bytes.chunks_exact(2)) {
                    *sample = i16::from_le_bytes([raw[0], raw[1]]);
                }
            }

            let opus_bytes = match encoder.encode(&samples) {
                Ok(bytes) => bytes,
                Err(e) => {
                    tracing::warn!("webrtc: opus encode failed: {e}");
                    continue;
                }
            };

            let sample = Sample {
                data: opus_bytes.into(),
                duration: period,
                ..Default::default()
            };

            if let Err(e) = track.write_sample(ssrc, payload_type, &sample, &[]).await {
                tracing::warn!("webrtc: write_sample failed: {e}");
            } else {
                frames_sent += 1;
            }
        }

        tracing::debug!(
            frames_sent,
            seconds_sent = frames_sent as f64 * FRAME_DURATION_MS as f64 / 1000.0,
            "webrtc: audio pacer stopped"
        );
    })
}

struct Handler {
    gather_complete_tx: Mutex<Option<oneshot::Sender<()>>>,
    data_channel_tx: Mutex<Option<oneshot::Sender<Arc<dyn DataChannel>>>>,
    inbound_audio_tx: tokio::sync::mpsc::Sender<Frame>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for Handler {
    async fn on_ice_gathering_state_change(&self, state: RTCIceGatheringState) {
        if state == RTCIceGatheringState::Complete
            && let Some(tx) = self.gather_complete_tx.lock().unwrap().take()
        {
            let _ = tx.send(());
        }
    }

    async fn on_data_channel(&self, data_channel: Arc<dyn DataChannel>) {
        if let Some(tx) = self.data_channel_tx.lock().unwrap().take() {
            let _ = tx.send(data_channel);
        }
    }

    async fn on_track(&self, track: Arc<dyn TrackRemote>) {
        if track.kind().await != RtpCodecKind::Audio {
            return;
        }

        let tx = self.inbound_audio_tx.clone();
        tokio::spawn(async move {
            let mut decoder = match OpusDecoder::new() {
                Ok(decoder) => decoder,
                Err(e) => {
                    tracing::error!("webrtc: failed to init opus decoder: {e}");
                    return;
                }
            };

            while let Some(event) = track.poll().await {
                let TrackRemoteEvent::OnRtpPacket(packet) = event else {
                    continue;
                };
                let pcm = match decoder.decode(&packet.payload) {
                    Ok(pcm) => pcm,
                    Err(e) => {
                        tracing::warn!("webrtc: opus decode failed: {e}");
                        continue;
                    }
                };
                let num_frames = pcm.len() as u32 / 2;
                let frame = Frame::new(FrameKind::RawAudio(RawAudioFrame {
                    audio: pcm,
                    sample_rate: SAMPLE_RATE,
                    num_channels: 1,
                    num_frames,
                }));
                if tx.send(frame).await.is_err() {
                    break;
                }
            }
        });
    }
}

impl<S: FrameSerializer<Message = bytes::Bytes> + 'static> WebRtcClient<S> {
    pub async fn accept_offer(
        base: BaseTransport<S>,
        offer_sdp: String,
        status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
    ) -> anyhow::Result<(Self, String)> {
        let (gather_complete_tx, gather_complete_rx) = oneshot::channel();
        let (data_channel_tx, data_channel_rx) = oneshot::channel();
        let (inbound_audio_tx, inbound_audio_rx) =
            tokio::sync::mpsc::channel(EVENT_CHANNEL_CAPACITY);

        let handler = Arc::new(Handler {
            gather_complete_tx: Mutex::new(Some(gather_complete_tx)),
            data_channel_tx: Mutex::new(Some(data_channel_tx)),
            inbound_audio_tx,
        });

        let mut media_engine = MediaEngine::default();
        let audio_codec = RTCRtpCodecParameters {
            rtp_codec: opus_codec(),
            payload_type: OPUS_PAYLOAD_TYPE,
        };
        media_engine.register_codec(audio_codec.clone(), RtpCodecKind::Audio)?;
        let registry = register_default_interceptors(Registry::new(), &mut media_engine)?;

        let runtime = default_runtime()
            .ok_or_else(|| anyhow::anyhow!("webrtc: no async runtime available"))?;

        let config = RTCConfigurationBuilder::new().build();

        let bind_ip = crate::config::get()
            .map_err(|e| anyhow::anyhow!("webrtc: {e}"))?
            .webrtc_bind_ip
            .clone();

        let peer_connection = PeerConnectionBuilder::new()
            .with_configuration(config)
            .with_media_engine(media_engine)
            .with_interceptor_registry(registry)
            .with_handler(handler)
            .with_runtime(runtime)
            .with_udp_addrs(vec![format!("{bind_ip}:0")])
            .build()
            .await?;

        let output_ssrc: u32 = rand::random();
        let output_track = Arc::new(TrackLocalStaticSample::new(MediaStreamTrack::new(
            "ferry-stream".to_string(),
            "ferry-tts-audio".to_string(),
            "ferry TTS audio".to_string(),
            RtpCodecKind::Audio,
            vec![RTCRtpEncodingParameters {
                rtp_coding_parameters: RTCRtpCodingParameters {
                    ssrc: Some(output_ssrc),
                    ..Default::default()
                },
                codec: audio_codec.rtp_codec,
                ..Default::default()
            }],
        ))?);
        peer_connection
            .add_track(output_track.clone() as Arc<dyn TrackLocal>)
            .await?;

        let offer = RTCSessionDescription::offer(offer_sdp)?;
        peer_connection.set_remote_description(offer).await?;
        let answer = peer_connection.create_answer(None).await?;
        peer_connection.set_local_description(answer).await?;

        let _ = gather_complete_rx.await;

        let answer_sdp = peer_connection
            .local_description()
            .await
            .ok_or_else(|| anyhow::anyhow!("webrtc: no local description after ICE gathering"))?
            .sdp;

        let output_payload_type =
            parse_negotiated_opus_payload_type(&answer_sdp).unwrap_or(OPUS_PAYLOAD_TYPE);

        Ok((
            Self {
                base,
                peer_connection: Box::new(peer_connection),
                data_channel_rx,
                inbound_audio_rx,
                output_track,
                output_ssrc,
                output_payload_type,
                outbound_audio: Arc::new(Mutex::new(OutboundAudio::new())),
                status_rx,
            },
            answer_sdp,
        ))
    }

    pub async fn run(mut self) {
        // Reset every time inbound audio actually arrives, from here through
        // the main loop below — see `AUDIO_IDLE_TIMEOUT`. `tokio::pin!`
        // rather than a struct field: it only needs to live for this call,
        // and `select!` requires a pinned, by-`&mut`-reusable future to poll
        // it repeatedly across iterations instead of consuming it after one
        // match.
        let idle_watchdog = tokio::time::sleep(AUDIO_IDLE_TIMEOUT);
        tokio::pin!(idle_watchdog);

        // `on_track` and `on_data_channel` are independent PeerConnection
        // callbacks with no ordering between them, and SCTP association
        // setup (the data channel) is a real extra handshake beyond what
        // SRTP media needs — so audio can and does arrive before the data
        // channel opens. Buffered rather than dropped, and flushed into the
        // pipeline once the main loop starts.
        let mut early_audio: Vec<Frame> = Vec::new();

        let data_channel = loop {
            tokio::select! {
                result = &mut self.data_channel_rx => {
                    match result {
                        Ok(dc) => break dc,
                        Err(_) => {
                            tracing::warn!("webrtc: no data channel opened, dropping connection");
                            let _ = self.peer_connection.close().await;
                            return;
                        }
                    }
                }
                _ = async {
                    let rx = self.status_rx.as_mut().expect("guarded by `if` below");
                    loop {
                        if rx.changed().await.is_err() {
                            return;
                        }
                        if matches!(*rx.borrow(), CallStatus::Ended(_)) {
                            return;
                        }
                    }
                }, if self.status_rx.is_some() => {
                    tracing::info!(
                        "webrtc: call ended before data channel opened, waiting briefly to deliver hangup signal"
                    );
                    if let Ok(Ok(dc)) = tokio::time::timeout(
                        std::time::Duration::from_secs(3),
                        &mut self.data_channel_rx,
                    )
                    .await
                    {
                        let _ = dc.send(BytesMut::from(&[CALL_ENDED_TAG][..])).await;
                        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                    }
                    let _ = self.peer_connection.close().await;
                    return;
                }
                _ = &mut idle_watchdog => {
                    tracing::warn!(
                        "webrtc: no data channel opened within {AUDIO_IDLE_TIMEOUT:?}, dropping connection"
                    );
                    let _ = self.peer_connection.close().await;
                    return;
                }
                frame = self.inbound_audio_rx.recv() => {
                    if let Some(frame) = frame {
                        idle_watchdog
                            .as_mut()
                            .reset(tokio::time::Instant::now() + AUDIO_IDLE_TIMEOUT);
                        early_audio.push(frame);
                    }
                }
            }
        };

        idle_watchdog
            .as_mut()
            .reset(tokio::time::Instant::now() + AUDIO_IDLE_TIMEOUT);

        // Deliver whatever arrived while we were still waiting on the data
        // channel, in the order it arrived, before the main loop starts
        // taking anything newer.
        for frame in early_audio {
            if !self.base.push_frame(frame).await {
                let _ = self.peer_connection.close().await;
                return;
            }
        }

        let mut pacer = spawn_pacer(
            Arc::clone(&self.output_track),
            self.output_ssrc,
            self.output_payload_type,
            Arc::clone(&self.outbound_audio),
        );

        loop {
            tokio::select! {
                changed = async {
                    self.status_rx.as_mut().unwrap().changed().await
                }, if self.status_rx.is_some() => {
                    if changed.is_err() {
                        break;
                    }
                    let status = *self.status_rx.as_ref().unwrap().borrow();
                    match status {
                        CallStatus::Ended(_) => {
                            tracing::info!("webrtc: call ended (other leg), hanging up");
                            let _ = data_channel
                                .send(BytesMut::from(&[CALL_ENDED_TAG][..]))
                                .await;
                            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                            break;
                        }
                        CallStatus::Connected => {
                            let msg = BytesMut::from(&[PEER_CONNECTED_TAG][..]);
                            if data_channel.send(msg).await.is_err() {
                                break;
                            }
                        }
                        CallStatus::Ringing => {
                            let msg = BytesMut::from(&[CALL_RINGING_TAG][..]);
                            if data_channel.send(msg).await.is_err() {
                                break;
                            }
                        }
                        CallStatus::Dialing => {}
                    }
                }
                event = data_channel.poll() => {
                    // Polled only for `OnClose`. The data channel is
                    // outbound-only — transcripts, translations and status
                    // tags go out on it and nothing comes back, since the
                    // client's mic is a real Opus RTP track (see
                    // `Handler::on_track`), not PCM on this channel.
                    match event {
                        Some(DataChannelEvent::OnClose) | None => break,
                        Some(_) => {}
                    }
                }
                frame = self.base.next_frame() => {
                    let Some(frame) = frame else { break };
                    match frame.into_kind() {
                        // The three TTS frame kinds all go to the pacer,
                        // not the data channel — audio rides the real Opus
                        // RTP track, and the start/stop markers are what tell
                        // the pacer where one utterance ends and the next
                        // begins (see `OutboundAudio::take_frame`).
                        FrameKind::TtsAudioStart => {
                            self.outbound_audio.lock().unwrap().producing = true;
                        }
                        FrameKind::TtsAudio(audio) => {
                            let mut outbound = self.outbound_audio.lock().unwrap();
                            let before = outbound.pcm.len();
                            outbound.pcm.extend(audio.audio);
                            // Only on the crossing, not for every chunk that
                            // arrives while it stays over — a backlog is a
                            // sustained state, and re-logging it 50 times a
                            // second buries whatever caused it.
                            if before <= BACKLOG_WARN_BYTES && outbound.pcm.len() > BACKLOG_WARN_BYTES {
                                tracing::warn!(
                                    buffered_ms = outbound.pcm.len() as u64 * 1000
                                        / (SAMPLE_RATE as u64 * 2),
                                    "webrtc: outbound audio backlog — TTS is outrunning real-time playout"
                                );
                            }
                        }
                        FrameKind::TtsAudioStop => {
                            self.outbound_audio.lock().unwrap().producing = false;
                        }
                        other => {
                            if let Ok(msg) = self.base.serialize(Frame::new(other))
                                && data_channel.send(BytesMut::from(msg.as_ref())).await.is_err()
                            {
                                break;
                            }
                        }
                    }
                }
                frame = self.inbound_audio_rx.recv() => {
                    let Some(frame) = frame else { continue };
                    // Receiving a frame is itself proof the connection is
                    // alive, so the watchdog resets here regardless of how
                    // the handoff below goes.
                    idle_watchdog
                        .as_mut()
                        .reset(tokio::time::Instant::now() + AUDIO_IDLE_TIMEOUT);
                    // push_frame is a bounded channel send — if the stage
                    // downstream is stuck, that await blocks this whole arm's
                    // body, which would stop the outer select! from ever
                    // re-polling idle_watchdog. Racing it here bounds the
                    // handoff itself the same way AUDIO_IDLE_TIMEOUT bounds
                    // waiting for the next frame.
                    tokio::select! {
                        ok = self.base.push_frame(frame) => {
                            if !ok {
                                break;
                            }
                        }
                        _ = &mut idle_watchdog => {
                            tracing::warn!(
                                "webrtc: pipeline handoff stalled past {AUDIO_IDLE_TIMEOUT:?}, ending call"
                            );
                            break;
                        }
                    }
                }
                _ = &mut idle_watchdog => {
                    tracing::warn!(
                        "webrtc: no inbound audio for {AUDIO_IDLE_TIMEOUT:?}, ending call"
                    );
                    break;
                }
            }
        }

        // Let the pacer finish the frame it is mid-way through rather than
        // aborting into a half-written `write_sample`; it checks this flag
        // once per tick, so this normally costs at most one frame's wait —
        // bounded by PACER_SHUTDOWN_TIMEOUT in case `write_sample` itself
        // never returns, so a stalled pacer can't keep this task (and the
        // SessionGuard it holds) alive indefinitely.
        self.outbound_audio.lock().unwrap().stopped = true;
        if tokio::time::timeout(PACER_SHUTDOWN_TIMEOUT, &mut pacer)
            .await
            .is_err()
        {
            tracing::warn!(
                "webrtc: pacer did not stop within {PACER_SHUTDOWN_TIMEOUT:?}, aborting it"
            );
            pacer.abort();
        }

        let _ = self.peer_connection.close().await;
    }
}

const EVENT_CHANNEL_CAPACITY: usize = 32;
