use crate::frames::Frame;

pub trait FrameSerializer: Send + Sync {
    type Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Self::Message>;
    fn deserialize(&self, msg: Self::Message) -> anyhow::Result<Option<Frame>>;
}
