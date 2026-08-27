use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::http::HeaderName;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, RawAudioFrame};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{
    SttError, SttEvent, SttProvider, SttSession, Transcript, WsOutboundClient,
};

// docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming
const ENDPOINT: &str = "wss://api.sarvam.ai/speech-to-text-realtime/ws";

const AUTH_HEADER: &str = "api-subscription-key";

// The only model this endpoint accepts.
const MODEL: &str = "saaras:v3-realtime";

// Matches what SarvamSttSerializer sends: mono 16-bit PCM.
const ENCODING: &str = "linear16";

// Same reasoning as deepgram.rs: STT is on the latency-critical hot path,
// so fail fast rather than retry.
const MAX_RECONNECT_ATTEMPTS: u32 = 1;
const RECONNECT_DELAY: Duration = Duration::from_millis(100);

const EVENT_CHANNEL_CAPACITY: usize = 32;

fn percent_encode(s: &str) -> String {
    percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC).to_string()
}

pub struct SarvamSttProvider {
    api_key: String,
    config: SarvamSttConfig,
}

impl SarvamSttProvider {
    pub fn new(api_key: String, config: SarvamSttConfig) -> Self {
        Self { api_key, config }
    }
}

#[async_trait]
impl SttProvider for SarvamSttProvider {
    fn name(&self) -> &'static str {
        "sarvam"
    }

    async fn open(
        &self,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn SttSession>, mpsc::Receiver<SttEvent>), SttError> {
        let vendor = &self.config;
        let url = build_url(vendor);
        let language = vendor.languages.first().copied();

        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static(AUTH_HEADER),
            self.api_key.clone(),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await?;

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let read_task =
            Self::spawn_read_task("sarvam-stt", read, serializer.clone(), tx, move |frame| {
                match frame.into_kind() {
                    FrameKind::Transcription(t) => vec![SttEvent::Transcript(Transcript {
                        text: t.text,
                        language,
                        is_final: t.is_final,
                    })],
                    FrameKind::UserStartedSpeaking => vec![SttEvent::UserStartedSpeaking],
                    FrameKind::UserStoppedSpeaking => vec![SttEvent::UserStoppedSpeaking],
                    _ => vec![],
                }
            });

        Ok((
            Box::new(SarvamSttSession {
                client,
                read_task,
                serializer,
            }) as Box<dyn SttSession>,
            rx,
        ))
    }
}

struct SarvamSttSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    serializer: Arc<dyn FrameSerializer<Message = Message>>,
}

#[async_trait]
impl SttSession for SarvamSttSession {
    async fn send_audio(&mut self, frame: RawAudioFrame) -> Result<(), SttError> {
        let msg = self
            .serializer
            .serialize(Frame::new(FrameKind::RawAudio(frame)))
            .map_err(|e| SttError::Protocol(e.to_string()))?;

        self.client
            .send(msg)
            .await
            .map_err(|e| SttError::Protocol(e.to_string()))
    }

    async fn close(self: Box<Self>) {
        self.read_task.abort();
        self.client.close().await;
    }
}

fn build_url(vendor: &SarvamSttConfig) -> String {
    let mut params: Vec<(String, String)> = vec![
        ("model".into(), MODEL.into()),
        ("encoding".into(), ENCODING.into()),
        ("sample_rate".into(), vendor.sample_rate.to_string()),
    ];

    if let Some(language) = vendor.languages.first() {
        params.push(("language_code".into(), language.code().into()));
    }
    if let Some(v) = vendor.stream_type {
        params.push(("stream_type".into(), v.as_str().into()));
    }
    if let Some(v) = vendor.mode {
        params.push(("mode".into(), v.as_str().into()));
    }
    if let Some(v) = vendor.endpointing {
        params.push(("endpointing".into(), v.as_str().into()));
    }
    if let Some(v) = vendor.threshold {
        params.push(("threshold".into(), v.to_string()));
    }
    if let Some(v) = vendor.silence_duration_ms {
        params.push(("silence_duration_ms".into(), v.to_string()));
    }
    if let Some(v) = vendor.min_speech_duration_ms {
        params.push(("min_speech_duration_ms".into(), v.to_string()));
    }
    if let Some(v) = vendor.return_timestamps {
        params.push(("return_timestamps".into(), v.to_string()));
    }
    if let Some(p) = &vendor.prompt {
        params.push(("prompt".into(), p.clone()));
    }
    for (k, v) in &vendor.extra {
        params.push((k.clone(), v.clone()));
    }

    let query = params
        .into_iter()
        .map(|(k, v)| format!("{}={}", percent_encode(&k), percent_encode(&v)))
        .collect::<Vec<_>>()
        .join("&");

    format!("{ENDPOINT}?{query}")
}

#[derive(Debug, Clone)]
pub struct SarvamSttConfig {
    pub sample_rate: u32,

    pub languages: Vec<Language>,

    pub stream_type: Option<StreamType>,

    pub mode: Option<Mode>,

    pub endpointing: Option<Endpointing>,

    pub threshold: Option<f32>,

    pub silence_duration_ms: Option<u32>,

    pub min_speech_duration_ms: Option<u32>,

    pub return_timestamps: Option<bool>,

    pub prompt: Option<String>,

    pub extra: HashMap<String, String>,
}

impl SarvamSttConfig {
    // Pass `None` to get Sarvam's recommended defaults outright, or `Some`
    // with only the fields you care about set — anything left `None` on it
    // still falls back to the same recommended default.
    pub fn new(config: Option<SarvamSttConfig>) -> Self {
        let Some(c) = config else {
            return Self::default();
        };

        Self {
            sample_rate: c.sample_rate,
            languages: c.languages,
            stream_type: c.stream_type.or(Some(StreamType::Balanced)),
            mode: c.mode.or(Some(Mode::Transcribe)),
            endpointing: c.endpointing.or(Some(Endpointing::Vad)),
            threshold: c.threshold.or(Some(0.3)),
            silence_duration_ms: c.silence_duration_ms.or(Some(500)),
            min_speech_duration_ms: c.min_speech_duration_ms.or(Some(250)),
            return_timestamps: c.return_timestamps.or(Some(false)),
            prompt: c.prompt,
            extra: c.extra,
        }
    }
    fn default() -> Self {
        Self {
            sample_rate: 0,
            languages: Vec::new(),
            stream_type: Some(StreamType::Balanced),
            mode: Some(Mode::Transcribe),
            endpointing: Some(Endpointing::Vad),
            threshold: Some(0.3),
            silence_duration_ms: Some(500),
            min_speech_duration_ms: Some(250),
            return_timestamps: Some(false),
            prompt: None,
            extra: HashMap::new(),
        }
    }
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamType {
    Fast,
    Balanced,
    Simulated,
}

impl StreamType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Balanced => "balanced",
            Self::Simulated => "simulated",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    Transcribe,
    Translate,
    Verbatim,
    Translit,
    Codemix,
}

impl Mode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Transcribe => "transcribe",
            Self::Translate => "translate",
            Self::Verbatim => "verbatim",
            Self::Translit => "translit",
            Self::Codemix => "codemix",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Endpointing {
    Vad,
    Manual,
}

impl Endpointing {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Vad => "vad",
            Self::Manual => "manual",
        }
    }
}
