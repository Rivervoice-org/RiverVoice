use std::sync::Arc;
use std::time::Duration;

use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, MtTextFrame};
use crate::services::tts::provider::{
    TtsConfig, TtsConfigKind, TtsError, TtsEvent, TtsProvider, TtsSession,
};
use crate::services::ws_client::WsOutboundClient;
use async_trait::async_trait;
use serde::Serialize;
use tokio::sync::mpsc::{self, Receiver};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::http::HeaderName;

const ENDPOINT: &str = "wss://api.sarvam.ai/text-to-speech/ws";

const AUTH_HEADER: &str = "api-subscription-key";

const OUTPUT_AUDIO_CODEC: &str = "linear16";

const EVENT_CHANNEL_CAPACITY: usize = 32;

const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(20);

const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_millis(750);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SarvamModel {
    BulbulV2,

    BulbulV3,
}

impl SarvamModel {
    pub fn slug(self) -> &'static str {
        match self {
            Self::BulbulV2 => "bulbul:v2",
            Self::BulbulV3 => "bulbul:v3",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BulbulV3Voice {
    // Female
    Ritu,
    Priya,
    Neha,
    Pooja,
    Simran,
    Kavya,
    Ishita,
    Shreya,
    Roopa,
    Tanya,
    Shruti,
    Suhani,
    Kavitha,
    Rupali,
    // Male
    Shubh,
    Aditya,
    Rahul,
    Rohan,
    Amit,
    Dev,
    Ratan,
    Varun,
    Manan,
    Sumit,
    Kabir,
    Aayan,
    Ashutosh,
    Advait,
    Anand,
    Tarun,
    Sunny,
    Mani,
    Gokul,
    Vijay,
    Mohit,
    Rehan,
    Soham,
}

impl BulbulV3Voice {
    pub fn slug(self) -> &'static str {
        match self {
            Self::Shubh => "shubh",
            Self::Aditya => "aditya",
            Self::Ritu => "ritu",
            Self::Priya => "priya",
            Self::Neha => "neha",
            Self::Rahul => "rahul",
            Self::Pooja => "pooja",
            Self::Rohan => "rohan",
            Self::Simran => "simran",
            Self::Kavya => "kavya",
            Self::Amit => "amit",
            Self::Dev => "dev",
            Self::Ishita => "ishita",
            Self::Shreya => "shreya",
            Self::Ratan => "ratan",
            Self::Varun => "varun",
            Self::Manan => "manan",
            Self::Sumit => "sumit",
            Self::Roopa => "roopa",
            Self::Kabir => "kabir",
            Self::Aayan => "aayan",
            Self::Ashutosh => "ashutosh",
            Self::Advait => "advait",
            Self::Anand => "anand",
            Self::Tanya => "tanya",
            Self::Tarun => "tarun",
            Self::Sunny => "sunny",
            Self::Mani => "mani",
            Self::Gokul => "gokul",
            Self::Vijay => "vijay",
            Self::Shruti => "shruti",
            Self::Suhani => "suhani",
            Self::Mohit => "mohit",
            Self::Kavitha => "kavitha",
            Self::Rehan => "rehan",
            Self::Soham => "soham",
            Self::Rupali => "rupali",
        }
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Some(match slug {
            "shubh" => Self::Shubh,
            "aditya" => Self::Aditya,
            "ritu" => Self::Ritu,
            "priya" => Self::Priya,
            "neha" => Self::Neha,
            "rahul" => Self::Rahul,
            "pooja" => Self::Pooja,
            "rohan" => Self::Rohan,
            "simran" => Self::Simran,
            "kavya" => Self::Kavya,
            "amit" => Self::Amit,
            "dev" => Self::Dev,
            "ishita" => Self::Ishita,
            "shreya" => Self::Shreya,
            "ratan" => Self::Ratan,
            "varun" => Self::Varun,
            "manan" => Self::Manan,
            "sumit" => Self::Sumit,
            "roopa" => Self::Roopa,
            "kabir" => Self::Kabir,
            "aayan" => Self::Aayan,
            "ashutosh" => Self::Ashutosh,
            "advait" => Self::Advait,
            "anand" => Self::Anand,
            "tanya" => Self::Tanya,
            "tarun" => Self::Tarun,
            "sunny" => Self::Sunny,
            "mani" => Self::Mani,
            "gokul" => Self::Gokul,
            "vijay" => Self::Vijay,
            "shruti" => Self::Shruti,
            "suhani" => Self::Suhani,
            "mohit" => Self::Mohit,
            "kavitha" => Self::Kavitha,
            "rehan" => Self::Rehan,
            "soham" => Self::Soham,
            "rupali" => Self::Rupali,
            _ => return None,
        })
    }

    pub fn gender(self) -> VoiceGender {
        match self {
            Self::Ritu
            | Self::Priya
            | Self::Neha
            | Self::Pooja
            | Self::Simran
            | Self::Kavya
            | Self::Ishita
            | Self::Shreya
            | Self::Roopa
            | Self::Tanya
            | Self::Shruti
            | Self::Suhani
            | Self::Kavitha
            | Self::Rupali => VoiceGender::Female,
            Self::Shubh
            | Self::Aditya
            | Self::Rahul
            | Self::Rohan
            | Self::Amit
            | Self::Dev
            | Self::Ratan
            | Self::Varun
            | Self::Manan
            | Self::Sumit
            | Self::Kabir
            | Self::Aayan
            | Self::Ashutosh
            | Self::Advait
            | Self::Anand
            | Self::Tarun
            | Self::Sunny
            | Self::Mani
            | Self::Gokul
            | Self::Vijay
            | Self::Mohit
            | Self::Rehan
            | Self::Soham => VoiceGender::Male,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BulbulV2Voice {
    // Female
    Anushka,
    Manisha,
    Vidya,
    Arya,
    // Male
    Abhilash,
    Karun,
    Hitesh,
}

impl BulbulV2Voice {
    pub fn slug(self) -> &'static str {
        match self {
            Self::Anushka => "anushka",
            Self::Manisha => "manisha",
            Self::Vidya => "vidya",
            Self::Arya => "arya",
            Self::Abhilash => "abhilash",
            Self::Karun => "karun",
            Self::Hitesh => "hitesh",
        }
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Some(match slug {
            "anushka" => Self::Anushka,
            "manisha" => Self::Manisha,
            "vidya" => Self::Vidya,
            "arya" => Self::Arya,
            "abhilash" => Self::Abhilash,
            "karun" => Self::Karun,
            "hitesh" => Self::Hitesh,
            _ => return None,
        })
    }

    pub fn gender(self) -> VoiceGender {
        match self {
            Self::Anushka | Self::Manisha | Self::Vidya | Self::Arya => VoiceGender::Female,
            Self::Abhilash | Self::Karun | Self::Hitesh => VoiceGender::Male,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoiceGender {
    Male,
    Female,
}

#[derive(Debug, Clone, Default)]
pub struct SarvamTtsConfig {
    pub pace: Option<f32>,

    pub pitch: Option<f32>,

    pub loudness: Option<f32>,

    pub temperature: Option<f32>,

    pub enable_preprocessing: Option<bool>,

    pub min_buffer_size: Option<u32>,

    pub max_chunk_length: Option<u32>,
}

impl SarvamTtsConfig {
    pub fn new() -> Self {
        Self {
            pace: Some(1.0),
            pitch: Some(0.0),
            loudness: Some(1.0),
            temperature: Some(0.6),
            enable_preprocessing: Some(false),
            min_buffer_size: Some(50),
            max_chunk_length: Some(150),
        }
    }
}

pub struct SarvamTtsProvider {
    api_key: String,
    model: SarvamModel,
}

impl SarvamTtsProvider {
    pub fn new(api_key: String, model: SarvamModel) -> Self {
        Self { api_key, model }
    }
}

#[async_trait]
impl TtsProvider for SarvamTtsProvider {
    fn name(&self) -> &'static str {
        "sarvam"
    }

    async fn open(
        &self,
        config: TtsConfig,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn TtsSession>, Receiver<TtsEvent>), TtsError> {
        let vendor = match &config.kind {
            TtsConfigKind::SarvamTtsConfig(vendor) => vendor,
        };
        let url = build_url(&config, self.model);
        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static(AUTH_HEADER),
            self.api_key.clone(),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await
        .map_err(|e| TtsError::Connection(e.to_string()))?;

        let config_message = ClientMessage::Config {
            data: ConfigData {
                language_code: config.language.code(),
                speaker: config.voice,
                speech_sample_rate: config.sample_rate,
                enable_preprocessing: vendor.enable_preprocessing.unwrap_or(false),
                model: self.model.slug(),
                pace: vendor.pace,
                pitch: vendor.pitch,
                loudness: vendor.loudness,
                temperature: vendor.temperature,
                min_buffer_size: vendor.min_buffer_size,
                max_chunk_length: vendor.max_chunk_length,
                output_audio_codec: OUTPUT_AUDIO_CODEC,
            },
        };
        let config_text = serde_json::to_string(&config_message)
            .map_err(|e| TtsError::Protocol(e.to_string()))?;

        client
            .send(Message::Text(config_text))
            .await
            .map_err(|e| TtsError::Connection(e.to_string()))?;

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let read_task =
            Self::spawn_read_task("sarvam", read, serializer.clone(), tx.clone(), |frame| {
                match frame.into_kind() {
                    FrameKind::TtsAudio(audio) => vec![TtsEvent::AudioChunk(audio.audio)],
                    FrameKind::TtsAudioStop => vec![TtsEvent::Done],
                    _ => vec![],
                }
            });
        let keepalive_task =
            Self::spawn_keepalive_task(client.clone(), ping_message(), KEEPALIVE_INTERVAL);

        Ok((
            Box::new(SarvamTtsSession {
                client,
                read_task,
                keepalive_task,
                serializer,
            }) as Box<dyn TtsSession>,
            rx,
        ))
    }
}

fn build_url(config: &TtsConfig, model: SarvamModel) -> String {
    format!(
        "{ENDPOINT}?model={}&send_completion_event=true&language_code={}&speaker={}&speech_sample_rate={}",
        model.slug(),
        config.language.code(),
        config.voice,
        config.sample_rate,
    )
}

fn ping_message() -> Message {
    Message::Text(
        serde_json::to_string(&ClientMessage::Ping).expect("ClientMessage::Ping always serializes"),
    )
}

struct SarvamTtsSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
    serializer: Arc<dyn FrameSerializer<Message = Message>>,
}

#[async_trait]
impl TtsSession for SarvamTtsSession {
    async fn send_text(&mut self, text_frame: MtTextFrame) -> Result<(), TtsError> {
        let msg = self
            .serializer
            .serialize(Frame::new(FrameKind::MtText(text_frame)))
            .map_err(|e| TtsError::Protocol(e.to_string()))?;

        self.client
            .send(msg)
            .await
            .map_err(|e| TtsError::Connection(e.to_string()))
    }

    async fn flush(&mut self) -> Result<(), TtsError> {
        let text = serde_json::to_string(&ClientMessage::Flush)
            .map_err(|e| TtsError::Protocol(e.to_string()))?;
        self.client
            .send(Message::Text(text))
            .await
            .map_err(|e| TtsError::Connection(e.to_string()))
    }

    async fn close(self: Box<Self>) {
        self.read_task.abort();
        self.keepalive_task.abort();
        self.client.close().await;
    }
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub(crate) enum ClientMessage {
    Config { data: ConfigData },
    Text { data: TextData },
    Flush,
    Ping,
}

#[derive(Serialize, Clone)]
pub(crate) struct ConfigData {
    language_code: &'static str,
    speaker: String,
    speech_sample_rate: u32,
    enable_preprocessing: bool,
    model: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pace: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pitch: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    loudness: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    min_buffer_size: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_chunk_length: Option<u32>,

    output_audio_codec: &'static str,
}

#[derive(Serialize)]
pub(crate) struct TextData {
    pub text: String,
}
