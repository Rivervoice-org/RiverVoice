use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;

pub struct MetricsLogObserver;

impl FrameObserver for MetricsLogObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
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
