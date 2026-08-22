use std::sync::Arc;

use tokio::sync::mpsc;
use tracing::Instrument;

use crate::codec::stt::deepgram::DeepgramSerializer;
use crate::codec::tts::sarvam::SarvamSerializer;
use crate::config::Config;
use crate::db::entity::agents;
use crate::frames::Frame;
use crate::observer::frame_observer::FrameObserver;
use crate::observer::latency_observer::LatencyObserver;
use crate::observer::log_observer::LogObserver;
use crate::observer::metrics_log_observer::MetricsLogObserver;
use crate::observer::stage_latency_observer::StageLatencyObserver;
use crate::observer::transcript_log_observer::TranscriptLogObserver;
use crate::observer::usage_observer::UsageObserver;
use crate::processor::{FrameIo, FrameProcessor};
use crate::services::mt::sarvam::{SarvamMtProvider, SpeakerGender, TranslateMode};
use crate::services::stt::deepgram::{DeepgramSttConfig, DeepgramSttProvider};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{SttConfig, SttConfigKind};
use crate::services::tts::provider::TtsConfigKind;
use crate::services::tts::sarvam::{SarvamModel, SarvamTtsConfig, SarvamTtsProvider};
use crate::stages::mt::MtStage;
use crate::stages::stt::SttStage;
use crate::stages::tts::TtsStage;

pub const SAMPLE_RATE: u32 = 16_000;
pub const NUM_CHANNELS: u16 = 1;
const DEFAULT_TTS_VOICE: &str = "shubh";

const STAGE_QUEUE_SIZE: usize = 64;

/// The DB-facing `agents::Language` and the pipeline-facing
/// `services::stt::language::Language` are separate enums with matching
/// variant names (so ferry doesn't couple its DB schema to its STT
/// provider's type) — this just carries a value across that boundary.
fn to_stt_language(lang: &agents::Language) -> Language {
    match lang {
        agents::Language::English => Language::En,
        agents::Language::Hindi => Language::Hi,
        agents::Language::Telugu => Language::Te,
        agents::Language::Tamil => Language::Ta,
        agents::Language::Kannada => Language::Kn,
    }
}

/// Sarvam's translate API only recognizes Male/Female for `speaker_gender` —
/// `Neutral` has no equivalent, so it's omitted from the request rather than
/// guessing at an unsupported value.
fn to_sarvam_gender(gender: &agents::Gender) -> Option<SpeakerGender> {
    match gender {
        agents::Gender::Female => Some(SpeakerGender::Female),
        agents::Gender::Male => Some(SpeakerGender::Male),
        agents::Gender::Neutral => None,
    }
}

fn to_sarvam_mode(mode: &agents::Mode) -> TranslateMode {
    match mode {
        agents::Mode::Formal => TranslateMode::Formal,
        agents::Mode::ModernColloquial => TranslateMode::ModernColloquial,
        agents::Mode::ClassicColloquial => TranslateMode::ClassicColloquial,
        agents::Mode::CodeMixed => TranslateMode::CodeMixed,
    }
}

/// Builds one direction of an STT->MT->TTS pipeline. Shared by the two-leg
/// call flow (`http::handlers::call::start_call`, called twice — once per
/// direction, via `reversed`) and the one-way try-agent demo
/// (`http::handlers::webrtc::webrtc_offer`, called once).
///
/// `agent` supplies the source/target languages via its input/output
/// language pair, plus MT gender/mode and the TTS voice — `reversed` picks
/// which direction this call is (A->B uses input->output, B->A is the
/// mirror; irrelevant for a one-way caller, which should always pass
/// `false`). `None` falls back to a hardcoded Te<->En default with no
/// gender/mode/voice override rather than failing outright.
pub fn build_translation_pipeline(
    config: &Config,
    agent: Option<&agents::Model>,
    reversed: bool,
    call_span: tracing::Span,
) -> FrameIo {
    let (source_lang, target_lang) = match agent {
        Some(agent) => {
            let input = to_stt_language(&agent.input_language);
            let output = to_stt_language(&agent.output_language);
            if reversed {
                (output, input)
            } else {
                (input, output)
            }
        }
        None => {
            if reversed {
                (Language::En, Language::Te)
            } else {
                (Language::Te, Language::En)
            }
        }
    };
    let tts_voice = agent
        .map(|agent| agent.voice.as_str())
        .unwrap_or(DEFAULT_TTS_VOICE);
    let speaker_gender = agent.and_then(|agent| to_sarvam_gender(&agent.gender));
    let mode = agent.map(|agent| to_sarvam_mode(&agent.mode));

    let stt_serializer: Arc<
        dyn crate::codec::frame_serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(DeepgramSerializer::new(SAMPLE_RATE));
    let tts_serializer: Arc<
        dyn crate::codec::frame_serializer::FrameSerializer<
                Message = tokio_tungstenite::tungstenite::Message,
            >,
    > = Arc::new(SarvamSerializer::new(SAMPLE_RATE));

    let stt_provider = DeepgramSttProvider::new(config.deepgram_stt_api_key.to_string());
    let stt_config = SttConfig::new(
        SAMPLE_RATE,
        vec![source_lang],
        SttConfigKind::DeepgramSttConfig(DeepgramSttConfig::new()),
    );

    let mt_provider = SarvamMtProvider::new(
        config.sarvam_tts_api_key.to_string(),
        source_lang,
        target_lang,
        speaker_gender,
        mode,
    );
    let mt_model_slug = mt_provider.model().slug();

    let tts_provider =
        SarvamTtsProvider::new(config.sarvam_tts_api_key.to_string(), SarvamModel::BulbulV3);
    let tts_config = crate::services::tts::provider::TtsConfig::new(
        SAMPLE_RATE,
        tts_voice.to_string(),
        target_lang,
        TtsConfigKind::SarvamTtsConfig(SarvamTtsConfig::new()),
    );

    let stages: Vec<Box<dyn FrameProcessor>> = vec![
        Box::new(SttStage::new(
            Box::new(stt_provider),
            stt_config,
            stt_serializer,
        )),
        Box::new(MtStage::new(Box::new(mt_provider))),
        Box::new(TtsStage::new(
            Box::new(tts_provider),
            tts_config,
            tts_serializer,
        )),
    ];

    let usage_observer = Arc::new(UsageObserver::new());

    let observers: Vec<Arc<dyn FrameObserver>> = vec![
        usage_observer,
        Arc::new(LogObserver),
        Arc::new(LatencyObserver::new()),
        Arc::new(MetricsLogObserver),
        Arc::new(StageLatencyObserver::new()),
        Arc::new(TranscriptLogObserver::new(mt_model_slug)),
    ];

    Pipeline::spawn(stages, observers, call_span)
}

pub struct Pipeline;

impl Pipeline {
    /// `call_span` is entered for every stage task this pipeline spawns, so
    /// every log line a stage emits (STT/MT/TTS, any provider) automatically
    /// carries whatever fields the caller put on that span — e.g. `call_id`
    /// and `dir` — without each stage needing to know or pass those fields
    /// itself.
    pub fn spawn(
        stages: Vec<Box<dyn FrameProcessor>>,
        observers: Vec<Arc<dyn FrameObserver>>,
        call_span: tracing::Span,
    ) -> FrameIo {
        let observers: Arc<[Arc<dyn FrameObserver>]> = observers.into();
        let (into_first, mut prev_exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);

        for stage in stages {
            let (entrance, exit) = mpsc::channel::<Frame>(STAGE_QUEUE_SIZE);
            let io = FrameIo::new(stage.name(), prev_exit, entrance, Arc::clone(&observers));
            tokio::spawn(stage.run(io).instrument(call_span.clone()));
            prev_exit = exit;
        }

        FrameIo::new("Rivervoice", prev_exit, into_first, observers)
    }
}
