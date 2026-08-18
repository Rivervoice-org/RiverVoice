use std::sync::atomic::{AtomicU32, Ordering};

use crate::turns::strategy::TurnStrategy;

static NEXT_FRAME_ID: AtomicU32 = AtomicU32::new(0);

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
    Transcription(TranscriptionFrame),

    UserStartedSpeaking,

    UserStoppedSpeaking,

    ServiceMetadata(ServiceMetadataFrame),

    UserTurnAggregation(UserTurnAggregationFrame),

    MtResponseStart,

    MtText(MtTextFrame),

    MtResponseEnd,

    TtsAudioStart,

    TtsAudio(TtsAudioFrame),

    TtsAudioStop,

    Metrics(MetricsFrame),

    SttUsage(SttUsageFrame),

    MtUsage(MtUsageFrame),

    TtsUsage(TtsUsageFrame),
}

impl FrameKind {
    pub fn get_name(&self) -> String {
        match self {
            FrameKind::RawAudio(_) => "RawAudioFrame".to_string(),
            FrameKind::Transcription(_) => "TranscriptionFrame".to_string(),
            FrameKind::UserStartedSpeaking => "UserStartedSpeakingFrame".to_string(),
            FrameKind::UserStoppedSpeaking => "UserStoppedSpeakingFrame".to_string(),
            FrameKind::ServiceMetadata(_) => "ServiceMetadataFrame".to_string(),
            FrameKind::UserTurnAggregation(_) => "UserTurnAggregationFrame".to_string(),
            FrameKind::MtResponseStart => "MtResponseStartFrame".to_string(),
            FrameKind::MtText(_) => "MtTextFrame".to_string(),
            FrameKind::MtResponseEnd => "MtResponseEndFrame".to_string(),
            FrameKind::TtsAudioStart => "TtsAudioStartFrame".to_string(),
            FrameKind::TtsAudio(_) => "TtsAudioFrame".to_string(),
            FrameKind::TtsAudioStop => "TtsAudioStopFrame".to_string(),
            FrameKind::Metrics(_) => "MetricsFrame".to_string(),
            FrameKind::SttUsage(_) => "SttUsageFrame".to_string(),
            FrameKind::MtUsage(_) => "MtUsageFrame".to_string(),
            FrameKind::TtsUsage(_) => "TtsUsageFrame".to_string(),
        }
    }
}

pub struct ServiceMetadataFrame {
    pub service_name: String,

    pub turn_strategy: Option<TurnStrategy>,
}

pub struct RawAudioFrame {
    pub audio: Vec<u8>,
    pub sample_rate: u32,
    pub num_channels: u16,

    pub num_frames: u32,
}

pub struct TranscriptionFrame {
    pub text: String,

    pub is_final: bool,
}

pub struct UserTurnAggregationFrame {
    pub text: String,
}

pub struct MtTextFrame {
    pub text: String,
}

pub struct TtsAudioFrame {
    pub audio: Vec<u8>,
    pub sample_rate: u32,
}

pub struct MetricsFrame {
    pub stage: String,
    pub ttfb_ms: u64,
}

#[derive(Clone, Copy, Default)]
pub struct SttUsageFrame {
    pub audio_seconds: f64,
}

#[derive(Clone, Copy, Default, serde::Deserialize)]
pub struct MtUsageFrame {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Clone, Copy, Default)]
pub struct TtsUsageFrame {
    pub characters: u32,
}
