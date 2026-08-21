use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::Frame;
use crate::processor::FrameIo;

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

    /// Like [`next_wire_message`](Self::next_wire_message), but hands back the
    /// raw `Frame` instead of serializing it — for transports (WebRTC) that need
    /// to route some frame kinds somewhere other than the serializer/wire-message
    /// path (e.g. `TtsAudio` going out over a real RTP track instead of the data
    /// channel).
    pub async fn next_frame(&mut self) -> Option<Frame> {
        self.io.take().await
    }

    /// Serializes a single frame already pulled via [`next_frame`](Self::next_frame)
    /// into a wire message, for the caller to send after handling it specially.
    pub fn serialize(&self, frame: Frame) -> anyhow::Result<S::Message> {
        self.serializer.serialize(frame)
    }

    pub async fn push_frame(&self, frame: Frame) -> bool {
        self.io.push(frame).await
    }

    /// See [`FrameSerializer::drain_paced`](crate::codec::frame_serializer::FrameSerializer::drain_paced).
    pub fn drain_paced(&self) -> Option<S::Message> {
        self.serializer.drain_paced()
    }

    /// See [`FrameSerializer::pace_interval`](crate::codec::frame_serializer::FrameSerializer::pace_interval).
    pub fn pace_interval(&self) -> Option<std::time::Duration> {
        self.serializer.pace_interval()
    }
}
