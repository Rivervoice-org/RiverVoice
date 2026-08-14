use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};

use crate::frames::frames::{Frame, FrameKind};
use crate::observer::observer::FrameObserver;

/// A processor's (or transport's) access to the pipeline: where its
/// frames come from and where it pushes them. Wiring is the pipeline's
/// job. The holder never knows who is on the other end of either side.
///
/// Two queues run between each pair of stages, not one: `upstream`/
/// `downstream` carry ordinary work, and `control`/`downstream_control`
/// carry frames that must be seen ahead of whatever's already backed up
/// (see [`FrameKind::is_control`](crate::frames::frames::FrameKind::is_control)).
/// [`FrameIo::take`] always drains the control queue first.
pub struct FrameIo {
    name: String,
    upstream: Receiver<Frame>,
    control: Receiver<Frame>,
    downstream: Sender<Frame>,
    downstream_control: Sender<Frame>,
    /// Shared across every stage's `FrameIo` in the pipeline — an `Arc`
    /// clone per stage, not a copy of the list itself. See
    /// [`FrameObserver`].
    observers: Arc<[Arc<dyn FrameObserver>]>,
}

impl FrameIo {
    pub fn new(
        name: impl Into<String>,
        upstream: Receiver<Frame>,
        control: Receiver<Frame>,
        downstream: Sender<Frame>,
        downstream_control: Sender<Frame>,
        observers: Arc<[Arc<dyn FrameObserver>]>,
    ) -> Self {
        Self {
            name: name.into(),
            upstream,
            control,
            downstream,
            downstream_control,
            observers,
        }
    }

    /// Name used in logs and metrics (e.g. "stt", "vad").
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Pushes a frame onward, onto whichever of the two queues it belongs
    /// on. `false` means downstream is gone, wind down.
    pub async fn push(&self, frame: Frame) -> bool {
        for observer in self.observers.iter() {
            observer.on_push(&self.name, &frame);
        }
        let queue = if frame.kind().is_control() {
            &self.downstream_control
        } else {
            &self.downstream
        };
        queue.send(frame).await.is_ok()
    }

    /// Next frame for this holder, control queue first. `None` means both
    /// queues are closed and drained, so the call is over; finish
    /// in-flight work and return.
    pub async fn take(&mut self) -> Option<Frame> {
        let frame = tokio::select! {
            biased;
            control = self.control.recv() => match control {
                Some(frame) => {
                    if matches!(frame.kind(), FrameKind::Interruption) {
                        self.flush();
                    }
                    Some(frame)
                }
                // The control queue is closed and drained, but the
                // regular queue may still have work buffered — fall
                // through to it instead of ending the call early.
                None => self.upstream.recv().await,
            },
            work = self.upstream.recv() => work,
        };
        if let Some(frame) = &frame {
            for observer in self.observers.iter() {
                observer.on_take(&self.name, frame);
            }
        }
        frame
    }

    /// Drops every frame currently buffered in the work queue. Called
    /// when an interruption arrives on the control queue, so a processor
    /// picks its next frame up fresh instead of still grinding through
    /// work from before the user cut in.
    fn flush(&mut self) {
        while self.upstream.try_recv().is_ok() {}
    }
}

/// A `FrameProcessor` is one stage of the pipeline: it receives `Frame`s
/// from upstream, does its one job, and sends `Frame`s downstream. Every
/// stage in the pipeline (VAD, STT, LLM, TTS, ...) implements this trait.
///
/// The rules every processor must follow:
///
/// 1. **Two hands only.** A processor knows `upstream` and `downstream`,
///    never which processors sit on the other end of either. Wiring is
///    the pipeline's job.
/// 2. **Process what you understand, forward the rest untouched.** A frame
///    kind a processor doesn't handle must be passed downstream as-is,
///    never dropped. Dropping unknown frames breaks every stage after it.
/// 3. **Run for the lifetime of the call.** `run` loops until `upstream`
///    closes (the transport hung up), then finishes any in-flight work,
///    drops `downstream`, and returns. Closing `downstream` propagates
///    shutdown to the next stage in the pipeline.
/// 4. **Interruptions travel the control queue.** An
///    [`Interruption`](crate::frames::frames::FrameKind::Interruption)
///    frame is pushed like any other, but [`FrameIo`] routes it onto the
///    control queue, where it's seen ahead of whatever work is already
///    backed up. A processor only has to actually forward it downstream
///    (per rule 2) for the next stage to get the same head start.
///
#[async_trait]
pub trait FrameProcessor: Send {
    /// Name used in logs and metrics (e.g. "stt", "vad").
    fn name(&self) -> &'static str;

    /// Consumes the processor and runs it as one stage of a call's pipeline.
    async fn run(self: Box<Self>, io: FrameIo);
}
