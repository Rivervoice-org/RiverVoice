use crate::frames::frames::Frame;
use crate::processor::processor::FrameIo;
use crate::serializer::serializer::FrameSerializer;

pub struct BaseTransport<S: FrameSerializer> {
    io: FrameIo,
    serializer: S,
}

impl<S: FrameSerializer> BaseTransport<S> {
    pub fn new(io: FrameIo, serializer: S) -> Self {
        Self { io, serializer }
    }

    pub async fn push_wire_message(&self, msg: S::Message) -> bool {
        match self.serializer.deserialize(msg) {
            Ok(Some(frame)) => self.io.push(frame).await,
            Ok(None) => true,
            Err(e) => {
                tracing::warn!("{}: dropping undeserializable message: {e}", self.io.name());
                true
            }
        }
    }

    pub async fn next_wire_message(&mut self) -> Option<S::Message> {
        while let Some(frame) = self.io.take().await {
            match self.serializer.serialize(frame) {
                Ok(msg) => return Some(msg),
                Err(_) => {}
            }
        }
        None
    }

    pub async fn push_frame(&self, frame: Frame) -> bool {
        self.io.push(frame).await
    }
}
