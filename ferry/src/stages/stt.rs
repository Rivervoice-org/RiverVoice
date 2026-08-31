use std::sync::Arc;

use async_trait::async_trait;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, SttUsageFrame};
use crate::processor::{FrameIo, FrameProcessor};
use crate::services::stt::provider::{SttEvent, SttProvider};
use crate::stages::stage::Stage;

pub struct SttStage {
    provider: Box<dyn SttProvider>,
    serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
}

impl SttStage {
    pub fn new(
        provider: Box<dyn SttProvider>,
        serializer: Arc<dyn FrameSerializer<Message = tokio_tungstenite::tungstenite::Message>>,
    ) -> Self {
        Self {
            provider,
            serializer,
        }
    }
}

#[async_trait]
impl FrameProcessor for SttStage {
    fn name(&self) -> Stage {
        Stage::Stt
    }

    async fn run(self: Box<Self>, mut io: FrameIo) {
        let (mut session, mut events) = match self.provider.open(self.serializer).await {
            Ok(opened) => opened,
            Err(e) => {
                tracing::error!("{}: failed to open session: {e}", io.name());
                return;
            }
        };

        let mut unreported_audio_seconds: f64 = 0.0;

        let mut buffer = String::new();
        // A turn can be built from several final chunks (each with its own
        // start_s/end_s) before UserStoppedSpeaking closes it out — same
        // accumulate-then-flush shape as `buffer`. Only the first chunk's
        // start and the last chunk's end matter for the turn's overall span.
        let mut turn_start_s: Option<f64> = None;
        let mut turn_end_s: Option<f64> = None;
        loop {
            tokio::select! {
                frame = io.take() => {
                    let Some(frame) = frame else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };
                    match frame.into_kind() {
                        FrameKind::RawAudio(audio) => {
                            match session.send_audio(audio.clone()).await {
                                Ok(()) => {
                                    unreported_audio_seconds +=
                                        audio.audio.len() as f64
                                            / 2.0
                                            / audio.sample_rate as f64;
                                }
                                Err(e) => {
                                    tracing::error!("{}: failed to send audio: {e}", io.name());
                                    break;
                                }
                            }

                        }
                        other => {
                            tracing::warn!("{}: unexpected frame kind: {}", io.name(), other.get_name());
                            break;
                        }
                    }
                }
                event = events.recv() => {
                    let Some(event) = event else {
                        tracing::info!("{}: upstream closed", io.name());
                        break
                    };


                    // Reset only — the clock itself starts at
                    // `UserStoppedSpeaking` below, not here. Starting it at
                    // speech begin measured "how long did the user talk" (it
                    // ran until the first final transcript, which usually
                    // lands mid-sentence), not STT's actual contribution to
                    // the turn's latency.
                    if let SttEvent::UserStartedSpeaking = &event {
                        io.cancel_ttfb_metrics();
                    }

                    if let SttEvent::Transcript(t) = &event {
                        if !io
                            .push(Frame::new(FrameKind::Transcription(
                                crate::frames::TranscriptionFrame {
                                    text: t.text.clone(),
                                    is_final: t.is_final,
                                    start_s: t.start_s,
                                    end_s: t.end_s,
                                },
                            )))
                            .await
                        {
                            tracing::info!("{}: downstream closed", io.name());
                            break;
                        }
                    }

                    // STT providers finalize text in chunks as you talk — a single
                    // sentence can produce several interim→final cycles before
                    // you're actually done speaking. Only `UserStoppedSpeaking`
                    // marks the real turn boundary; treating each final chunk
                    // as end-of-turn was flushing (and translating) partial
                    // sentences early, and losing the chunk's own text
                    // entirely when nothing had accumulated yet.
                    match &event {
                        SttEvent::Transcript(t) if t.is_final => {
                            buffer.push_str(&t.text);
                            if turn_start_s.is_none() {
                                turn_start_s = t.start_s;
                            }
                            if t.end_s.is_some() {
                                turn_end_s = t.end_s;
                            }
                        }
                        SttEvent::UserStoppedSpeaking => {
                            // The provider can send this more than once for
                            // one turn — an early one with nothing finalized
                            // yet, then a real one once the trailing text
                            // catches up. `start_ttfb_metrics` only records
                            // an instant if none is already pending, so the
                            // clock always starts at the *first* one, and
                            // measures the true wait: from "user stopped
                            // talking" to "turn text handed to MT" below.
                            io.start_ttfb_metrics();
                            if !buffer.is_empty() {
                                let text = std::mem::take(&mut buffer);
                                let duration_ms = match (turn_start_s.take(), turn_end_s.take()) {
                                    (Some(start), Some(end)) if end > start => {
                                        Some(((end - start) * 1000.0).round() as i32)
                                    }
                                    _ => None,
                                };
                                tracing::info!(target: "ferry::transcript", text = %text);
                                io.stop_ttfb_metrics().await;
                                if !io
                                    .push(Frame::new(FrameKind::UserTurnAggregation(
                                        crate::frames::UserTurnAggregationFrame {
                                            text,
                                            duration_ms,
                                        },
                                    )))
                                    .await
                                {
                                    tracing::info!("{}: downstream closed", io.name());
                                    break;
                                }
                            } else {
                                tracing::debug!("User stopped speaking. No buffer to send.");
                            }
                        }
                        _ => {}
                    }

                    if matches!(&event, SttEvent::Transcript(t) if t.is_final)
                        && unreported_audio_seconds > 0.0
                    {
                        let audio_seconds = std::mem::take(&mut unreported_audio_seconds);
                        if !io
                            .push(Frame::new(FrameKind::SttUsage(SttUsageFrame {
                                audio_seconds,
                            })))
                            .await
                        {
                            tracing::info!("{}: downstream closed", io.name());
                            break;
                        }
                    }


                }
            }
        }

        if unreported_audio_seconds > 0.0 {
            let _ = io
                .push(Frame::new(FrameKind::SttUsage(SttUsageFrame {
                    audio_seconds: unreported_audio_seconds,
                })))
                .await;
        }

        session.close().await;
    }
}
