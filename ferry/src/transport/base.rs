use axum::extract::ws::Message;

use crate::frames::frames::Frame;
use crate::processor::processor::FrameIo;
use crate::serializer::serializer::FrameSerializer;

/// What every transport owns, regardless of its wire: access to the
/// pipeline and the serializer that speaks the wire's dialect. Concrete
/// transports (WebSocket today, WebRTC later) embed this and add only
/// their wire-specific plumbing.
///
/// The boundary: `BaseTransport` knows everything pipeline-facing and
/// nothing wire-facing. no sockets, no connection handling.
pub struct BaseTransport {
    io: FrameIo,
    serializer: Box<dyn FrameSerializer>,
}

impl BaseTransport {
    pub fn new(io: FrameIo, serializer: Box<dyn FrameSerializer>) -> Self {
        Self { io, serializer }
    }

    /// Returns `false` when the pipeline is gone (torn down); the
    /// transport should stop reading its wire. A message that fails to
    /// deserialize is dropped (logged), not fatal to the call.
    pub async fn push_wire_message(&self, msg: Message) -> bool {
        match self.serializer.deserialize(msg) {
            Ok(frame) => {
                tracing::debug!("{}: pushing frame {}", self.io.name(), frame.get_name());
                self.io.push(frame).await
            }
            Err(e) => {
                tracing::warn!("{}: dropping undeserializable message: {e}", self.io.name());
                true
            }
        }
    }

    /// Returns `None` when the pipeline shut down; the call is over and
    /// the transport should close its wire. A frame that fails to serialize
    /// is skipped (logged), and the next frame is tried.
    pub async fn next_wire_message(&mut self) -> Option<Message> {
        while let Some(frame) = self.io.take().await {
            match self.serializer.serialize(frame) {
                Ok(msg) => return Some(msg),
                Err(e) => {
                    tracing::warn!("{}: dropping unserializable frame: {e}", self.io.name());
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
