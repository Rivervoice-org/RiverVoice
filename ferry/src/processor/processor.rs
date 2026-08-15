use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};

use crate::frames::frames::{Frame, FrameKind, MetricsFrame};
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
    upstream_control: Receiver<Frame>,
    downstream: Sender<Frame>,
    downstream_control: Sender<Frame>,
    /// Shared across every stage's `FrameIo` in the pipeline — an `Arc`
    /// clone per stage, not a copy of the list itself. See
    /// [`FrameObserver`].
    observers: Arc<[Arc<dyn FrameObserver>]>,
    /// This stage's own time-to-first-byte (TTFB) stopwatch — see [`FrameIo::start_ttfb_metrics`].
    ttfb_start: Option<Instant>,
}

impl FrameIo {
    pub fn new(
        name: impl Into<String>,
        upstream: Receiver<Frame>,
        upstream_control: Receiver<Frame>,
        downstream: Sender<Frame>,
        downstream_control: Sender<Frame>,
        observers: Arc<[Arc<dyn FrameObserver>]>,
    ) -> Self {
        Self {
            name: name.into(),
            upstream,
            upstream_control,
            downstream,
            downstream_control,
            observers,
            ttfb_start: None,
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

        let mut new_frame: Option<Frame> = None;

        let queue = if frame.kind().is_control() {
            &self.downstream_control
        } else {
            &self.downstream
        };

        if matches!(frame.kind(), FrameKind::UserStartedSpeaking) {
            new_frame = Some(Frame::new(FrameKind::Interruption));
        }

        if let Some(new_frame) = new_frame {
            let new_frame_queue = if new_frame.kind().is_control() {
                &self.downstream_control
            } else {
                &self.downstream
            };
            let _ = new_frame_queue.send(new_frame).await.is_ok();
        }

        queue.send(frame).await.is_ok()
    }

    /// Next frame for this holder, control queue first. `None` means both
    /// queues are closed and drained, so the call is over; finish
    /// in-flight work and return.
    pub async fn take(&mut self) -> Option<Frame> {
        let frame = tokio::select! {
            biased;
            control = self.upstream_control.recv() => match control {
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

    /// Starts this stage's TTFB stopwatch — call right where the stage
    /// itself begins a real request (sending audio worth transcribing,
    /// starting an LLM generation, sending text to synthesize). A no-op
    /// if a stopwatch is already running: only the request that opened
    /// the current window starts the clock, not every one of its
    /// follow-ups (e.g. every audio chunk while STT is still waiting on
    /// its first transcript back).
    pub fn start_ttfb_metrics(&mut self) {
        if self.ttfb_start.is_none() {
            self.ttfb_start = Some(Instant::now());
        }
    }

    /// Stops the stopwatch (if one is running) and pushes the elapsed
    /// time downstream as a [`FrameKind::Metrics`] frame tagged with this
    /// stage's own name — call right where the stage sees the first sign
    /// of a response to the request that started it (first transcript,
    /// first LLM token, first TTS audio chunk). `true` and no frame
    /// pushed if no stopwatch was running (e.g. called again for a later
    /// chunk of the same response).
    pub async fn stop_ttfb_metrics(&mut self) -> bool {
        let start = match self.ttfb_start.take() {
            Some(start) => start,
            None => return true,
        };
        self.push(Frame::new(FrameKind::Metrics(MetricsFrame {
            stage: self.name.clone(),
            ttfb_ms: start.elapsed().as_millis() as u64,
        })))
        .await
    }

    /// Discards a running stopwatch without reporting it — call when the
    /// request it was timing was cut short (an interruption) rather than
    /// actually answered, so its partial, meaningless elapsed time isn't
    /// mistaken for a real measurement.
    pub fn cancel_ttfb_metrics(&mut self) {
        self.ttfb_start = None;
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
