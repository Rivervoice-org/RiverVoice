use crate::frames::frames::Frame;

/// Converts between wire messages and pipeline `Frame`s.
///
/// Different telephony providers encode their WebSocket messages
/// differently. Twilio's format isn't Exotel's, so each provider gets
/// its own `FrameSerializer` implementation to translate its messages
/// into `Frame`s the rest of the pipeline understands, and back.
pub trait FrameSerializer: Send + Sync {
    type Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Self::Message>;
    fn deserialize(&self, msg: Self::Message) -> anyhow::Result<Frame>;
}
