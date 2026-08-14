use crate::frames::frames::Frame;
use crate::processor::processor::FrameIo;
use crate::serializer::transport::serializer::FrameSerializer;

/// What every transport owns, regardless of its wire: access to the
/// pipeline and the serializer that speaks the wire's dialect. Concrete
/// transports (WebSocket today, WebRTC later) embed this and add only
/// their wire-specific plumbing.
///
/// The boundary: `BaseTransport` knows everything pipeline-facing and
/// nothing wire-facing. no sockets, no connection handling.
pub struct BaseTransport<S: FrameSerializer> {
    io: FrameIo,
    serializer: S,
}

impl<S: FrameSerializer> BaseTransport<S> {
    pub fn new(io: FrameIo, serializer: S) -> Self {
        Self { io, serializer }
    }

    /// Returns `false` when the pipeline is gone (torn down); the
    /// transport should stop reading its wire. A message that fails to
    /// deserialize is dropped (logged), not fatal to the call.
    pub async fn push_wire_message(&self, msg: S::Message) -> bool {
        match self.serializer.deserialize(msg) {
            Ok(frame) => self.io.push(frame).await,
            Err(e) => {
                tracing::warn!("{}: dropping undeserializable message: {e}", self.io.name());
                true
            }
        }
    }

    /// Returns `None` when the pipeline shut down; the call is over and
    /// the transport should close its wire. A frame that fails to serialize
    /// is skipped (logged), and the next frame is tried.
    pub async fn next_wire_message(&mut self) -> Option<S::Message> {
        while let Some(frame) = self.io.take().await {
            match self.serializer.serialize(frame) {
                Ok(msg) => return Some(msg),
                Err(e) => {
                    // Routine, not a problem: a pipeline can (and here,
                    // does) produce frames a given wire format has no
                    // representation for at all — e.g. a transcript, on
                    // a serializer that only knows raw audio. Every such
                    // frame hits this once by design, not by mistake.
                    tracing::debug!("{}: dropping unserializable frame: {e}", self.io.name());
                }
            }
        }
        None
    }

    /// Push an already-built Frame into the pipeline (for frames the
    /// transport creates itself, e.g. `CallEnded` when the wire dies).
    pub async fn push_frame(&self, frame: Frame) -> bool {
        self.io.push(frame).await
    }
}
