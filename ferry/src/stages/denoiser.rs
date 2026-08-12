use crate::audio::filters::AudioFilter;
use crate::frames::frames::{Frame, FrameKind};
use crate::processor::processor::{FrameIo, FrameProcessor, ProcessorFuture};

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

impl FrameProcessor for DenoiserStage {
    fn name(&self) -> &'static str {
        "denoiser"
    }

    fn run(mut self: Box<Self>, mut io: FrameIo) -> ProcessorFuture {
        Box::pin(async move {
            // The rate is not configured here — it arrives on the audio
            // itself, and the filters are told it once, before any of it
            // reaches them.
            let mut started = false;

            while let Some(frame) = io.take().await {
                let pushed = match frame.into_kind() {
                    FrameKind::RawAudio(mut audio) => {
                        if !started {
                            for filter in &mut self.filters {
                                filter.start(audio.sample_rate);
                            }
                            started = true;
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
                };

                if !pushed {
                    break; // downstream gone — the call is being torn down
                }
            }
            // upstream closed: run ends, dropping `io`, which closes our
            // downstream and lets shutdown ripple through the pipeline.
        })
    }
}
