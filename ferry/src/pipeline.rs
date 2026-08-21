use std::sync::Arc;

use tokio::sync::mpsc;

use crate::frames::Frame;
use crate::observer::frame_observer::FrameObserver;
use crate::processor::{FrameIo, FrameProcessor};

const STAGE_QUEUE_SIZE: usize = 64;

pub struct Pipeline;

impl Pipeline {
    pub fn spawn(
        stages: Vec<Box<dyn FrameProcessor>>,
        observers: Vec<Arc<dyn FrameObserver>>,
    ) -> FrameIo {
        let observers: Arc<[Arc<dyn FrameObserver>]> = observers.into();
        let (into_first, mut prev_exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);

        for stage in stages {
            let (entrance, exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let io = FrameIo::new(stage.name(), prev_exit, entrance, Arc::clone(&observers));
            tokio::spawn(stage.run(io));
            prev_exit = exit;
        }

        FrameIo::new("Rivervoice", prev_exit, into_first, observers)
    }
}
