use std::sync::atomic::{AtomicU32, Ordering};

use crate::turns::strategy::TurnStrategy;

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
    Transcription(TranscriptionFrame),
    /// The user started speaking, per whichever turn-detection is active:
    /// an STT provider that detects turns itself (e.g. Deepgram Flux), or
    /// Deepgram nova's own `vad_events`. No local VAD/turn-detector stage
    /// exists yet, so today this only ever comes from an STT provider.
    UserStartedSpeaking,
    /// The user's turn ended. See [`FrameKind::UserStartedSpeaking`].
    UserStoppedSpeaking,
    /// What a service can tell the rest of the pipeline about itself,
    /// pushed once when a call starts. See [`ServiceMetadataFrame`].
    ServiceMetadata(ServiceMetadataFrame),
    /// The user started talking while the bot's own output was still
    /// playing out, so whatever's downstream should stop that output
    /// immediately rather than let it run to the end.
    Interruption,
    /// Every transcript segment collected while one user turn was open,
    /// joined into a single block of text and emitted once the turn
    /// ends. See [`UserTurnAggregationFrame`].
    UserTurnAggregation(UserTurnAggregationFrame),
    /// An LLM generation has started streaming a reply. Pushed once, right
    /// before the first [`FrameKind::LlmText`] of that reply.
    LlmResponseStart,
    /// One chunk of the assistant's streamed reply. See [`LlmTextFrame`].
    LlmText(LlmTextFrame),
    /// The LLM generation that [`FrameKind::LlmResponseStart`] opened has
    /// finished, successfully or otherwise. A downstream stage (TTS) that
    /// wants to know a reply is complete, as opposed to just paused
    /// between chunks, waits for this rather than inferring it from a gap
    /// in `LlmText` frames.
    LlmResponseEnd,
    /// The bot has started speaking: the first [`FrameKind::TtsAudio`]
    /// chunk of one utterance is about to follow. Pushed once per
    /// utterance, not once per call — see [`FrameKind::TtsAudioStop`].
    TtsAudioStart,
    /// One chunk of synthesized PCM audio. See [`TtsAudioFrame`].
    TtsAudio(TtsAudioFrame),
    /// Every chunk of the utterance [`FrameKind::TtsAudioStart`] opened
    /// has been delivered. A downstream stage (the output transport)
    /// waits for this rather than inferring "done speaking" from a gap
    /// between audio chunks.
    TtsAudioStop,
    /// A stage's own measurement of its request/response latency —
    /// pushed by the stage itself (it alone knows when its own request
    /// truly started and ended), not inferred from outside. See
    /// [`MetricsFrame`].
    Metrics(MetricsFrame),
}

impl FrameKind {
    pub fn get_name(&self) -> String {
        match self {
            FrameKind::RawAudio(_) => "RawAudioFrame".to_string(),
            FrameKind::Transcription(_) => "TranscriptionFrame".to_string(),
            FrameKind::UserStartedSpeaking => "UserStartedSpeakingFrame".to_string(),
            FrameKind::UserStoppedSpeaking => "UserStoppedSpeakingFrame".to_string(),
            FrameKind::ServiceMetadata(_) => "ServiceMetadataFrame".to_string(),
            FrameKind::Interruption => "InterruptionFrame".to_string(),
            FrameKind::UserTurnAggregation(_) => "UserTurnAggregationFrame".to_string(),
            FrameKind::LlmResponseStart => "LlmResponseStartFrame".to_string(),
            FrameKind::LlmText(_) => "LlmTextFrame".to_string(),
            FrameKind::LlmResponseEnd => "LlmResponseEndFrame".to_string(),
            FrameKind::TtsAudioStart => "TtsAudioStartFrame".to_string(),
            FrameKind::TtsAudio(_) => "TtsAudioFrame".to_string(),
            FrameKind::TtsAudioStop => "TtsAudioStopFrame".to_string(),
            FrameKind::Metrics(_) => "MetricsFrame".to_string(),
        }
    }

    /// Whether this frame belongs on [`FrameIo`](crate::processor::processor::FrameIo)'s
    /// control queue: seen ahead of whatever's already backed up on the
    /// regular queue, rather than waiting in line behind it.
    ///
    /// `UserStartedSpeaking` belongs here for more than priority: a turn
    /// starting is often immediately followed by an `Interruption` (see
    /// [`UserAggregatorStage`](crate::stages::user_aggregator::UserAggregatorStage)),
    /// and `Interruption` triggers [`FrameIo::take`]'s flush of the
    /// *regular* queue. If `UserStartedSpeaking` sat on the regular queue,
    /// a downstream stage that hadn't read it yet by the time the
    /// `Interruption` arrived could have it discarded by that same flush.
    /// Keeping both on the control queue preserves their send order
    /// instead: `UserStartedSpeaking` is always delivered as its own item
    /// before the `Interruption` behind it is ever seen, so it can never
    /// be caught in that Interruption's own flush.
    pub fn is_control(&self) -> bool {
        matches!(self, FrameKind::Interruption)
    }
}

/// What a service announces about itself when a call starts.
///
/// A service that changes how the pipeline should behave says so by
/// putting one of these on the pipeline, rather than the pipeline asking
/// each service what it can do. Two reasons: the knowledge stays in the
/// vendor's own file, and swapping a service mid-call re-announces
/// without anyone having to remember to re-ask.
///
/// Every field is a recommendation. Explicit configuration always wins —
/// see [`TurnStrategySelection`](crate::turns::strategy::TurnStrategySelection).
pub struct ServiceMetadataFrame {
    /// Which service is announcing, for logs.
    pub service_name: String,
    /// The turn strategy this service recommends, if it has an opinion.
    /// `None` — the common case — leaves whatever is in force alone.
    pub turn_strategy: Option<TurnStrategy>,
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

/// A speech-to-text result. Emitted once per Deepgram (or any other STT
/// provider's) transcript, interim or final; `is_final` distinguishes the
/// two rather than splitting them into separate `FrameKind` variants,
/// since every downstream consumer wants both.
pub struct TranscriptionFrame {
    pub text: String,
    /// Whether the STT provider considers this transcript settled for its
    /// utterance, as opposed to a partial result that may still change.
    pub is_final: bool,
}

/// The user's fully aggregated turn: what an LLM stage would actually
/// run on, as opposed to the individual `TranscriptionFrame` fragments
/// that arrived while the turn was open. Built by
/// [`UserAggregatorStage`](crate::stages::user_aggregator::UserAggregatorStage).
pub struct UserTurnAggregationFrame {
    pub text: String,
}

/// One chunk of an LLM's streamed reply, in whatever pieces the provider
/// sends them (a token, a few tokens, a line). See
/// [`FrameKind::LlmText`].
pub struct LlmTextFrame {
    pub text: String,
}

/// One chunk of synthesized PCM audio for one utterance, tagged with the
/// rate it was generated at (a TTS provider's own voice/model decides
/// this, not the pipeline). See [`FrameKind::TtsAudio`].
pub struct TtsAudioFrame {
    pub audio: Vec<u8>,
    pub sample_rate: u32,
}

/// One stage's time-to-first-byte for one request: how long it took from
/// starting its own work (sending audio, starting a generation, sending
/// text to synthesize) to the first sign of a response coming back.
/// Computed by the stage itself — see [`FrameKind::Metrics`] — since only
/// the stage knows which of its internal events actually bracket one
/// request; nothing generic sitting outside it (an observer watching
/// `FrameIo`) can infer that boundary for a continuously-streaming stage
/// like STT.
pub struct MetricsFrame {
    /// Which stage measured itself, e.g. `"stt"`, `"llm"`, `"tts"`.
    pub stage: String,
    pub ttfb_ms: u64,
}
