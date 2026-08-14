use async_trait::async_trait;

use crate::audio::filters::AudioFilter;
use crate::frames::frames::{Frame, FrameKind};
use crate::processor::processor::{FrameIo, FrameProcessor};

/// The denoiser stage: applies its chain of `AudioFilter`s, in order, to
/// every `RawAudioFrame` that passes through. The filters see plain PCM
/// samples and know nothing about frames; this stage does the unwrapping
/// and re-wrapping.
pub struct DenoiserStage {
    filters: Vec<Box<dyn AudioFilter>>,
}

impl DenoiserStage {
    pub fn new(filters: Vec<Box<dyn AudioFilter>>) -> Self {
        Self { filters }
    }
}

#[async_trait]
impl FrameProcessor for DenoiserStage {
    fn name(&self) -> &'static str {
        "denoiser"
    }

    async fn run(mut self: Box<Self>, mut io: FrameIo) {
        // The rate is not configured here. It arrives on the audio
        // itself, and the filters are told it once, before any of it
        // reaches them.
        let mut started_at: Option<u32> = None;

        while let Some(frame) = io.take().await {
            let pushed = match frame.into_kind() {
                FrameKind::RawAudio(mut audio) => {
                    match started_at {
                        None => {
                            for filter in &mut self.filters {
                                filter.start(audio.sample_rate);
                            }
                            started_at = Some(audio.sample_rate);
                        }
                        // Filters are set up for one rate and cannot be
                        // told a new one mid-call, so audio at a
                        // different rate would be filtered at the wrong
                        // ratio and quietly distorted. Say so instead.
                        Some(rate) if rate != audio.sample_rate => {
                            tracing::warn!(
                                expected = rate,
                                got = audio.sample_rate,
                                "denoiser: sample rate changed mid-call, filtering at the original rate"
                            );
                        }
                        Some(_) => {}
                    }

                    // Audio travels as s16le bytes; filters eat i16 samples.
                    let mut samples: Vec<i16> = audio
                        .audio
                        .chunks_exact(2)
                        .map(|b| i16::from_le_bytes([b[0], b[1]]))
                        .collect();

                    for filter in &mut self.filters {
                        filter.apply(&mut samples);
                    }

                    audio.audio = samples.iter().flat_map(|s| s.to_le_bytes()).collect();
                    io.push(Frame::new(FrameKind::RawAudio(audio))).await
                }
                // Nothing to denoise; pass through unchanged.
                other @ (FrameKind::Transcription(_)
                | FrameKind::UserStartedSpeaking
                | FrameKind::UserStoppedSpeaking
                | FrameKind::ServiceMetadata(_)
                | FrameKind::Interruption
                | FrameKind::UserTurnAggregation(_)
                | FrameKind::LlmResponseStart
                | FrameKind::LlmText(_)
                | FrameKind::LlmResponseEnd
                | FrameKind::TtsAudioStart
                | FrameKind::TtsAudio(_)
                | FrameKind::TtsAudioStop
                | FrameKind::Metrics(_)) => io.push(Frame::new(other)).await,
            };

            if !pushed {
                break; // downstream gone, the call is being torn down
            }
        }
        // upstream closed: run ends, dropping `io`, which closes our
        // downstream and lets shutdown ripple through the pipeline.
    }
}
