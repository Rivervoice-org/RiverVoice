/// An `AudioFilter` transforms raw audio in place: denoising, gain,
/// high-pass, etc. Filters work on plain PCM samples and know nothing
/// about `Frame`s or the pipeline — a processor (e.g. a denoiser stage)
/// owns one or more filters and applies them to the audio it carries.
///
/// Filters are chainable: applying filter A then filter B to the same
/// buffer composes them, in order.
pub trait AudioFilter: Send {
    /// Name used in logs and metrics (e.g. "denoise", "highpass").
    fn name(&self) -> &'static str;

    /// Transforms one buffer of 16 kHz mono PCM samples in place.
    fn apply(&mut self, samples: &mut [i16]);
}
