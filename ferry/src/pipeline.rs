use std::sync::Arc;

use tokio::sync::mpsc;
use tracing::Instrument;

use crate::frames::Frame;
use crate::observer::frame_observer::FrameObserver;
use crate::processor::{FrameIo, FrameProcessor};

const STAGE_QUEUE_SIZE: usize = 64;

pub struct Pipeline;

impl Pipeline {
    /// `call_span` is entered for every stage task this pipeline spawns, so
    /// every log line a stage emits (STT/MT/TTS, any provider) automatically
    /// carries whatever fields the caller put on that span — e.g. `call_id`
    /// and `dir` — without each stage needing to know or pass those fields
    /// itself.
    pub fn spawn(
        stages: Vec<Box<dyn FrameProcessor>>,
        observers: Vec<Arc<dyn FrameObserver>>,
        call_span: tracing::Span,
    ) -> FrameIo {
        let observers: Arc<[Arc<dyn FrameObserver>]> = observers.into();
        let (into_first, mut prev_exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);

        for stage in stages {
            let (entrance, exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let io = FrameIo::new(stage.name(), prev_exit, entrance, Arc::clone(&observers));
            tokio::spawn(stage.run(io).instrument(call_span.clone()));
            prev_exit = exit;
        }

        FrameIo::new("Rivervoice", prev_exit, into_first, observers)
    }
}
