use crate::frames::frames::Frame;

/// Watches frames as they cross a stage boundary, without being part of
/// the stage itself. Every [`FrameIo`](crate::processor::processor::FrameIo)
/// notifies every observer attached at
/// [`Pipeline::spawn`](crate::pipeline::pipeline::Pipeline::spawn) on each
/// push/take, so logging, metrics, and latency tracking can all watch the
/// same frame traffic without any of them living inside a stage or
/// knowing about each other.
///
/// Callbacks run inline on the frame's send/receive path: no I/O, no
/// blocking, nothing that awaits a lock another stage might be holding.
/// An observer with slow work to do (persisting metrics, an HTTP call)
/// must hand it off to its own task rather than block the caller.
pub trait FrameObserver: Send + Sync {
    /// `stage` pushed `frame` onward (downstream, or upstream for a
    /// control frame). Default no-op so adding a hook later doesn't break
    /// existing observers that don't care about it.
    fn on_push(&self, _stage: &str, _frame: &Frame) {}

    /// `stage` received `frame` from upstream.
    fn on_take(&self, _stage: &str, _frame: &Frame) {}
}
