use async_trait::async_trait;

use crate::audio::filters::AudioFilter;
use crate::frames::frames::{Frame, FrameKind};
use crate::processor::processor::{FrameIo, FrameProcessor};

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

                        Some(rate) if rate != audio.sample_rate => {
                            tracing::warn!(
                                expected = rate,
                                got = audio.sample_rate,
                                "denoiser: sample rate changed mid-call, filtering at the original rate"
                            );
                        }
                        Some(_) => {}
                    }

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

                other @ (FrameKind::Transcription(_)
                | FrameKind::UserStartedSpeaking
                | FrameKind::UserStoppedSpeaking
                | FrameKind::UserTurnAggregation(_)
                | FrameKind::MtResponseStart
                | FrameKind::MtText(_)
                | FrameKind::MtResponseEnd
                | FrameKind::TtsAudioStart
                | FrameKind::TtsAudio(_)
                | FrameKind::TtsAudioStop
                | FrameKind::Metrics(_)
                | FrameKind::SttUsage(_)
                | FrameKind::MtUsage(_)
                | FrameKind::TtsUsage(_)) => io.push(Frame::new(other)).await,
            };

            if !pushed {
                break;
            }
        }
    }
}
