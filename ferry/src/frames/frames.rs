use std::sync::atomic::{AtomicU32, Ordering};

static NEXT_FRAME_ID: AtomicU32 = AtomicU32::new(0);

/// `Frame` is the fundamental unit of data that flows through the RiverVoice
/// pipeline. Every stage in the pipeline passes data around exclusively as
/// `Frame`s, so any new kind of data (audio, transcripts, control signals,
/// etc.) must be represented as a `FrameKind` variant to move through it.
pub struct Frame {
    id: u32,
    kind: FrameKind,
}

impl Frame {
    pub fn new(kind: FrameKind) -> Self {
        Self {
            id: Self::next_id(),
            kind,
        }
    }

    fn next_id() -> u32 {
        NEXT_FRAME_ID.fetch_add(1, Ordering::Relaxed)
    }

    pub fn get_id(&self) -> u32 {
        self.id
    }

    pub fn get_name(&self) -> String {
        format!("{}-{}", self.kind.get_name(), self.id)
    }

    pub fn kind(&self) -> &FrameKind {
        &self.kind
    }

    pub fn into_kind(self) -> FrameKind {
        self.kind
    }
}

pub enum FrameKind {
    RawAudio(RawAudioFrame),
}

impl FrameKind {
    pub fn get_name(&self) -> String {
        match self {
            FrameKind::RawAudio(_) => "RawAudioFrame".to_string(),
        }
    }
}

/// Raw, unprocessed audio as received from an external source: telephony,
/// a browser API, etc. Any incoming audio must be wrapped in a
/// `RawAudioFrame` (via `FrameKind::RawAudio`) before it can enter the
/// pipeline.
pub struct RawAudioFrame {
    /// PCM sample bytes (s16le).
    pub audio: Vec<u8>,
    pub sample_rate: u32,
    pub num_channels: u16,
    /// Samples per channel in `audio`.
    pub num_frames: u32,
}
