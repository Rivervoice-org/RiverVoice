use crate::frames::frames::Frame;
use crate::observer::observer::FrameObserver;

/// Traces every frame crossing every stage boundary — the ferry
/// equivalent of pipecat's `DebugLogObserver`. Silent unless
/// `ferry::frame_flow` is enabled (e.g. `RUST_LOG=info,ferry::frame_flow=trace`):
/// `RawAudioFrame`/`TtsAudioFrame` flow at audio-chunk volume, so this
/// logs at `trace`, not `debug` or `info`.
pub struct LogObserver;

impl FrameObserver for LogObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "push");
    }

    fn on_take(&self, stage: &str, frame: &Frame) {
        tracing::trace!(target: "ferry::frame_flow", stage, frame = %frame.get_name(), "take");
    }
}
