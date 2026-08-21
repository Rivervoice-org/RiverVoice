use std::time::Duration;

use crate::frames::Frame;

pub trait FrameSerializer: Send + Sync {
    type Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Self::Message>;
    // None means "the wire message carried nothing actionable" (e.g. an
    // empty STT transcript during silence) — a skip, not a failure.
    fn deserialize(&self, msg: Self::Message) -> anyhow::Result<Option<Frame>>;

    /// Pops one already-buffered wire message ready to send *right now*,
    /// without needing a new pipeline `Frame` to trigger it — for
    /// serializers (Twilio's real-time mulaw stream) that must deliver
    /// audio at a steady wall-clock cadence rather than in whatever burst
    /// sizes `serialize` happens to produce (a single `TtsAudio` frame can
    /// be hundreds of ms of audio; forwarding that straight to Twilio in
    /// one message, instead of steady 20ms chunks, is what caused choppy,
    /// jitter-buffer-choking playback). `None` (the default) means this
    /// serializer doesn't buffer/pace at all — `serialize`'s output goes
    /// straight to the wire, same as before this existed.
    fn drain_paced(&self) -> Option<Self::Message> {
        None
    }

    /// How often the transport should poll `drain_paced`. `None` (the
    /// default) means never — no pacing needed for this serializer.
    fn pace_interval(&self) -> Option<Duration> {
        None
    }
}
