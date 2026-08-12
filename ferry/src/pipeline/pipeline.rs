use tokio::sync::mpsc;

use crate::frames::frames::Frame;
use crate::processor::processor::{FrameIo, FrameProcessor};

/// How many frames can wait in each stage's inbox before the pusher is
/// made to wait (backpressure).
const STAGE_QUEUE_SIZE: usize = 64;

/// The assembler. Its whole job happens once, before the call starts:
/// create the channel between each adjacent pair of stages, hand every
/// stage its two ends, spawn each stage's task, and return the leftover
/// ends to the transport. During the call the pipeline does nothing —
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
    pub fn spawn(name: &str, stages: Vec<Box<dyn FrameProcessor>>) -> FrameIo {
        let (into_first, mut prev_exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);

        for stage in stages {
            let (entrance, exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let io = FrameIo::new(stage.name(), prev_exit, entrance);
            tokio::spawn(stage.run(io));
            prev_exit = exit;
        }

        FrameIo::new(name, prev_exit, into_first)
    }
}
