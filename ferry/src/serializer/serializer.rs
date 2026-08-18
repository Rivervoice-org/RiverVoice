use crate::frames::frames::Frame;

pub trait FrameSerializer: Send + Sync {
    type Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Self::Message>;
    // None means "the wire message carried nothing actionable" (e.g. an
    // empty STT transcript during silence) — a skip, not a failure.
    fn deserialize(&self, msg: Self::Message) -> anyhow::Result<Option<Frame>>;
}
