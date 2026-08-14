use crate::frames::frames::{Frame, FrameKind};
use crate::observer::observer::FrameObserver;

/// Logs every [`FrameKind::Metrics`] frame — the ferry equivalent of
/// pipecat's `MetricsLogObserver`. Unlike [`LogObserver`](crate::observer::log_observer::LogObserver)
/// this does no timing itself: `Metrics` frames already carry a
/// measurement the emitting stage computed about its own request, so this
/// only has to report it.
pub struct MetricsLogObserver;

impl FrameObserver for MetricsLogObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        // A `Metrics` frame is re-pushed (wrapped fresh, per stage) as it
        // forwards through every stage after the one that emitted it —
        // same as any other frame kind a stage doesn't own. Logging only
        // where `stage` matches the frame's own `metrics.stage` reports
        // it once, at the point it was actually measured, instead of once
        // per hop on its way downstream.
        if let FrameKind::Metrics(metrics) = frame.kind()
            && metrics.stage == stage
        {
            tracing::info!(
                target: "ferry::metrics",
                stage = metrics.stage,
                ttfb_ms = metrics.ttfb_ms,
                "ttfb"
            );
        }
    }
}
