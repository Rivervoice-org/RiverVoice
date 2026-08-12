/// An `AudioFilter` transforms raw audio in place: denoising, gain,
/// high-pass, etc. Filters work on plain PCM samples and know nothing
/// about `Frame`s or the pipeline — a processor (e.g. a denoiser stage)
/// owns one or more filters and applies them to the audio it carries.
///
/// Filters are chainable: applying filter A then filter B to the same
/// buffer composes them, in order.
///
/// A filter never changes the sample rate: it is told the stream's rate
/// once, then takes and returns audio at that rate. A filter whose model
/// demands some other rate (RNNoise wants 48 kHz) converts internally and
/// hides it — the caller hands over the pipeline's rate and gets the same
/// rate back.
pub trait AudioFilter: Send {
    /// Name used in logs and metrics (e.g. "denoise", "highpass").
    fn name(&self) -> &'static str;

    /// Called once, before any audio, with the rate every buffer will
    /// arrive at. The filter sets up whatever this rate requires — a
    /// resampler, filter coefficients — or gives up filtering if it
    /// cannot serve the rate at all.
    fn start(&mut self, sample_rate: u32);

    /// Transforms one buffer of mono PCM samples in place, at the rate
    /// given to `start`.
    fn apply(&mut self, samples: &mut [i16]);
}
