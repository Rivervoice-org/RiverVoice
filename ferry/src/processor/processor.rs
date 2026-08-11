use std::future::Future;
use std::pin::Pin;

use tokio::sync::mpsc::{Receiver, Sender};

use crate::frames::frames::Frame;

/// The future a processor's `run` returns. Boxed so the pipeline can hold
/// any processor as `Box<dyn FrameProcessor>` without knowing its type.
pub type ProcessorFuture = Pin<Box<dyn Future<Output = ()> + Send>>;

/// A `FrameProcessor` is one stage of the pipeline: it receives `Frame`s
/// from upstream, does its one job, and sends `Frame`s downstream. Every
/// stage in the pipeline (VAD, STT, LLM, TTS, ...) implements this trait.
///
/// The rules every processor must follow:
///
/// 1. **Two hands only.** A processor knows `upstream` and `downstream` —
///    never which processors sit on the other end of either. Wiring is
///    the pipeline's job.
/// 2. **Process what you understand, forward the rest untouched.** A frame
///    kind a processor doesn't handle must be passed downstream as-is,
///    never dropped. Dropping unknown frames breaks every stage after it.
/// 3. **Run for the lifetime of the call.** `run` loops until `upstream`
///    closes (the transport hung up), then finishes any in-flight work,
///    drops `downstream`, and returns. Closing `downstream` propagates
///    shutdown to the next stage in the pipeline.
/// 4. **On interruption, flush and re-stamp — never signal backward as a
///    `Frame`.** A processor watches the shared turn number; when it
///    changes, drop any in-flight/queued work from the old turn and start
///    stamping new frames with the new turn. Signaling "the turn changed"
///    is the watch channel's job, not a `Frame` sent upstream — frames only
///    ever flow downstream, so live user speech can never be mistaken for
///    stale work and discarded.
pub trait FrameProcessor: Send {
    /// Name used in logs and metrics (e.g. "stt", "vad").
    fn name(&self) -> &'static str;

    /// Consumes the processor and runs it as one stage of a call's pipeline.
    fn run(
        self: Box<Self>,
        upstream: Receiver<Frame>,
        downstream: Sender<Frame>,
    ) -> ProcessorFuture;
}
