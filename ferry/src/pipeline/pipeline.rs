use std::sync::Arc;

use tokio::sync::mpsc;

use crate::frames::frames::Frame;
use crate::observer::observer::FrameObserver;
use crate::processor::processor::{FrameIo, FrameProcessor};

/// How many frames can wait in each stage's inbox before the pusher is
/// made to wait (backpressure).
const STAGE_QUEUE_SIZE: usize = 64;

/// The assembler. Its whole job happens once, before the call starts:
/// create the channel between each adjacent pair of stages, hand every
/// stage its two ends, spawn each stage's task, and return the leftover
/// ends to the transport. During the call the pipeline does nothing:
/// stages work, channels connect.
pub struct Pipeline;

impl Pipeline {
    /// Links the given stages in order and spawns them.
    ///
    /// Returns the transport's `FrameIo`: frames pushed into it enter the
    /// first stage, frames taken from it come out of the last stage.
    ///
    /// When the transport drops this `FrameIo`, the first stage's inbox
    /// closes and shutdown ripples through every stage in order.
    ///
    /// `observers` watches every frame crossing every stage boundary; see
    /// [`FrameObserver`]. The same set is shared (via `Arc`, not copied)
    /// across every stage's `FrameIo`.
    pub fn spawn(
        name: &str,
        stages: Vec<Box<dyn FrameProcessor>>,
        observers: Vec<Arc<dyn FrameObserver>>,
    ) -> FrameIo {
        let observers: Arc<[Arc<dyn FrameObserver>]> = observers.into();
        let (into_first, mut prev_exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
        let (into_first_control, mut prev_exit_control) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);

        for stage in stages {
            let (entrance, exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let (entrance_control, exit_control) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let io = FrameIo::new(
                stage.name(),
                prev_exit,
                prev_exit_control,
                entrance,
                entrance_control,
                Arc::clone(&observers),
            );
            tokio::spawn(stage.run(io));
            prev_exit = exit;
            prev_exit_control = exit_control;
        }

        FrameIo::new(
            name,
            prev_exit,
            prev_exit_control,
            into_first,
            into_first_control,
            observers,
        )
    }
}
