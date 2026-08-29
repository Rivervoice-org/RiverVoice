use crate::frames::{Frame, FrameKind};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct MetricsLogObserver;

impl FrameObserver for MetricsLogObserver {
    fn on_push(&self, stage: Stage, frame: &Frame) {
        if let FrameKind::Metrics(metrics) = frame.kind()
            && metrics.stage == stage
        {
            tracing::info!(
                target: "ferry::metrics",
                stage = metrics.stage.as_str(),
                ttfb_ms = metrics.ttfb_ms,
                "ttfb"
            );
        }
    }
}
