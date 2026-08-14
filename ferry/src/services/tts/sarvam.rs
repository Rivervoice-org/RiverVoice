use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use serde::Serialize;
use tokio::sync::mpsc::{self, Receiver, Sender};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::http::HeaderName;

use crate::frames::frames::FrameKind;
use crate::serializer::serializer::FrameSerializer;
use crate::services::tts::provider::{
    TtsConfig, TtsConfigKind, TtsError, TtsEvent, TtsProvider, TtsSession,
};
use crate::services::ws_client::WsOutboundClient;

/// <https://docs.sarvam.ai/api-reference-docs/text-to-speech/streaming>
const ENDPOINT: &str = "wss://api.sarvam.ai/text-to-speech/ws";

/// Header Sarvam authenticates every request (REST or WS) with — not a
/// bearer token.
const AUTH_HEADER: &str = "api-subscription-key";

/// Sarvam defaults `output_audio_codec` to `mp3`; ferry's pipeline only
/// ever carries raw PCM (see [`TtsAudioFrame`](crate::frames::frames::TtsAudioFrame)),
/// so this is fixed rather than left to that default or exposed as a
/// per-call choice. Same reasoning as classic Deepgram's
/// `encoding=linear16`.
const OUTPUT_AUDIO_CODEC: &str = "linear16";

/// How many outstanding events a session can buffer before
/// [`TtsStage`](crate::stages::tts::TtsStage) catches up. Same reasoning
/// as the Deepgram STT provider's own constant of this name.
const EVENT_CHANNEL_CAPACITY: usize = 32;

/// Sarvam doesn't document a required keepalive cadence for this
/// endpoint; Pipecat's `SarvamTTSService` pings every 20s, so this
/// matches that rather than guessing a different number.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(20);

/// Same reasoning as classic Deepgram's constant of this name: reconnect
/// attempts before giving up on a connection that keeps failing
/// immediately, rather than failing an utterance on the first transient
/// error.
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_millis(750);

/// Sarvam's two streaming-capable TTS models. Fixed per provider
/// instance, not per call: each has its own native output rate, and
/// [`TtsConfig::sample_rate`] is expected to already match whichever one
/// this provider was built with (the provider has no way to resample).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SarvamModel {
    /// 22050 Hz. Speakers: anushka, abhilash, manisha, vidya, arya,
    /// karun, hitesh. Supports `pitch`/`loudness`.
    BulbulV2,
    /// 24000 Hz, more speakers, `temperature` in place of
    /// `pitch`/`loudness`.
    BulbulV3,
}

impl SarvamModel {
    fn slug(self) -> &'static str {
        match self {
            Self::BulbulV2 => "bulbul:v2",
            Self::BulbulV3 => "bulbul:v3",
        }
    }
}

/// Sarvam's own knobs for its streaming TTS WebSocket, carried on
/// [`TtsConfig::kind`](crate::services::tts::provider::TtsConfig::kind)
/// via [`TtsConfigKind::SarvamTtsConfig`](crate::services::tts::provider::TtsConfigKind::SarvamTtsConfig).
///
/// Not present here, deliberately: `output_audio_codec`/
/// `output_audio_bitrate`. Sarvam defaults `output_audio_codec` to
/// `mp3`, but every downstream stage in ferry expects
/// [`TtsAudioFrame`](crate::frames::frames::TtsAudioFrame) to carry raw
/// PCM — nothing in the pipeline can decode a compressed codec. Same
/// reasoning as classic Deepgram's `encoding=linear16`
/// (`DeepgramSttConfig`'s docs): this isn't a real per-call choice, so
/// it's fixed in [`SarvamTtsProvider::open`] instead of exposed as a
/// field a caller could unknowingly break the pipeline with.
/// `output_audio_bitrate` only means anything for a compressed codec, so
/// it has nothing to configure once the codec is fixed.
#[derive(Debug, Clone, Default)]
pub struct SarvamTtsConfig {
    /// Speaking rate multiplier.
    pub pace: Option<f32>,
    /// Voice pitch adjustment. `bulbul:v2` only — `bulbul:v3` uses
    /// `temperature` instead. This type is built without knowing which
    /// model it'll be paired with, so it doesn't enforce that itself;
    /// `SarvamTtsProvider::open` drops whichever of this/`loudness`/
    /// `temperature` doesn't apply to `self.model` before sending.
    pub pitch: Option<f32>,
    /// Voice loudness adjustment. `bulbul:v2` only, see `pitch`.
    pub loudness: Option<f32>,
    /// Generation randomness. `bulbul:v3` only, see `pitch`.
    pub temperature: Option<f32>,
    /// Whether Sarvam applies its own text preprocessing (number/
    /// abbreviation normalization) before synthesizing.
    pub enable_preprocessing: Option<bool>,
    /// Minimum characters Sarvam buffers before starting to synthesize.
    pub min_buffer_size: Option<u32>,
    /// Maximum characters sent per synthesis chunk.
    pub max_chunk_length: Option<u32>,
}

impl SarvamTtsConfig {
    /// Sarvam's own documented defaults, written out explicitly rather
    /// than left as `None`/omitted from the request. Functionally the
    /// same as today — Sarvam applies these same values server-side when
    /// a field is absent — but stated here so they don't silently drift
    /// if Sarvam ever changes its own default; what ferry asks for is
    /// then this file, not a synced docs page. Same approach as
    /// `DeepgramFluxSttConfig::new()`.
    /// <https://docs.sarvam.ai/api-reference-docs/text-to-speech/stream>
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

/// [`TtsProvider`] backed by Sarvam's streaming TTS WebSocket. Ferry's
/// only TTS vendor, the same way OpenRouter is its only LLM vendor.
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
        let TtsConfigKind::SarvamTtsConfig(mut vendor) = config.kind;
        // `pitch`/`loudness` (bulbul:v2) and `temperature` (bulbul:v3) are
        // mutually exclusive on Sarvam's wire protocol, but `SarvamTtsConfig`
        // itself is built without knowing which model it'll be paired with
        // (see its doc comment) — only `self.model` here does, so this is
        // where the fields that don't apply to it get dropped, rather than
        // sending both sets and hoping Sarvam ignores the wrong one.
        match self.model {
            SarvamModel::BulbulV2 => vendor.temperature = None,
            SarvamModel::BulbulV3 => {
                vendor.pitch = None;
                vendor.loudness = None;
            }
        }

        let config_data = ConfigData {
            target_language_code: config.language.code(),
            speaker: config.voice,
            speech_sample_rate: config.sample_rate,
            enable_preprocessing: vendor.enable_preprocessing.unwrap_or(false),
            model: self.model.slug(),
            // Fixed, not a caller choice — see `SarvamTtsConfig`'s doc
            // comment on why `output_audio_codec`/`output_audio_bitrate`
            // aren't fields on it.
            output_audio_codec: OUTPUT_AUDIO_CODEC,
            pace: vendor.pace,
            pitch: vendor.pitch,
            loudness: vendor.loudness,
            temperature: vendor.temperature,
            min_buffer_size: vendor.min_buffer_size,
            max_chunk_length: vendor.max_chunk_length,
        };

        let url = format!(
            "{ENDPOINT}?model={}&send_completion_event=true",
            self.model.slug()
        );
        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static(AUTH_HEADER),
            self.api_key.clone(),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await
        .map_err(|e| TtsError::Connection(e.to_string()))?;

        send_json(
            &client,
            &ClientMessage::Config {
                data: config_data.clone(),
            },
        )
        .await?;

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
                api_key: self.api_key.clone(),
                model: self.model,
                config_data,
                client,
                read_task,
                keepalive_task,
                tx,
                serializer,
            }) as Box<dyn TtsSession>,
            rx,
        ))
    }
}

/// Sarvam's `ping` control message carries no fields, so it encodes to
/// the same JSON every time — built fresh at each keepalive spawn rather
/// than cached, since it's cheap and this way nothing has to invalidate
/// a stale cached value if `ClientMessage::Ping`'s shape ever changes.
fn ping_message() -> Message {
    Message::Text(
        serde_json::to_string(&ClientMessage::Ping)
            .expect("ClientMessage::Ping always serializes")
            .into(),
    )
}

async fn send_json(client: &WsOutboundClient, message: &ClientMessage) -> Result<(), TtsError> {
    let text = serde_json::to_string(message)
        .map_err(|e| TtsError::Protocol(format!("failed to encode message: {e}")))?;
    client
        .send(Message::Text(text.into()))
        .await
        .map_err(|e| TtsError::Connection(e.to_string()))
}

/// [`TtsSession`] backed by a live Sarvam WebSocket connection.
struct SarvamTtsSession {
    api_key: String,
    model: SarvamModel,
    /// Kept so [`SarvamTtsSession::interrupt`] can resend it when it
    /// reconnects — Sarvam requires `config` as the first message on
    /// every connection, not just the first one.
    config_data: ConfigData,
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
    /// Kept so a reconnect's fresh read loop can still forward into the
    /// same channel [`TtsProvider::open`] originally handed back to the
    /// caller — the caller only ever holds the one `Receiver`, for the
    /// life of the session, regardless of how many times the underlying
    /// connection itself gets rebuilt.
    tx: Sender<TtsEvent>,
    /// Kept so [`SarvamTtsSession::interrupt`]'s reconnect can hand the
    /// same decoder to its fresh read loop — `Arc` rather than `Box`
    /// because, unlike an STT session (which reads once for its whole
    /// life), this needs to be reused across however many reconnects an
    /// interruption causes.
    serializer: Arc<dyn FrameSerializer<Message = Message>>,
}

#[async_trait]
impl TtsSession for SarvamTtsSession {
    async fn send_text(&mut self, text: &str) -> Result<(), TtsError> {
        send_json(
            &self.client,
            &ClientMessage::Text {
                data: TextData {
                    text: text.to_string(),
                },
            },
        )
        .await
    }

    async fn flush(&mut self) -> Result<(), TtsError> {
        send_json(&self.client, &ClientMessage::Flush).await
    }

    async fn interrupt(&mut self) -> Result<(), TtsError> {
        let url = format!(
            "{ENDPOINT}?model={}&send_completion_event=true",
            self.model.slug()
        );
        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static(AUTH_HEADER),
            self.api_key.clone(),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await
        .map_err(|e| TtsError::Connection(e.to_string()))?;

        send_json(
            &client,
            &ClientMessage::Config {
                data: self.config_data.clone(),
            },
        )
        .await?;

        let read_task = SarvamTtsProvider::spawn_read_task(
            "sarvam",
            read,
            self.serializer.clone(),
            self.tx.clone(),
            |frame| match frame.into_kind() {
                FrameKind::TtsAudio(audio) => vec![TtsEvent::AudioChunk(audio.audio)],
                FrameKind::TtsAudioStop => vec![TtsEvent::Done],
                _ => vec![],
            },
        );
        let keepalive_task = SarvamTtsProvider::spawn_keepalive_task(
            client.clone(),
            ping_message(),
            KEEPALIVE_INTERVAL,
        );

        // Old connection torn down (tasks aborted, socket closed) only
        // once the new one is confirmed up — an interruption is exactly
        // the wrong moment to end up with neither.
        let old_client = std::mem::replace(&mut self.client, client);
        let old_read_task = std::mem::replace(&mut self.read_task, read_task);
        let old_keepalive_task = std::mem::replace(&mut self.keepalive_task, keepalive_task);
        old_read_task.abort();
        old_keepalive_task.abort();
        old_client.close().await;
        Ok(())
    }

    async fn close(self: Box<Self>) {
        self.read_task.abort();
        self.keepalive_task.abort();
        self.client.close().await;
    }
}

/// Every message ferry sends over the socket, as an internally-tagged
/// enum (`{"type": "...", ...fields}`) so `Flush`/`Ping` — which
/// Sarvam's protocol gives no `data` field at all — serialize as bare
/// `{"type":"flush"}`/`{"type":"ping"}` rather than a variant needing a
/// placeholder `data` value it doesn't have.
/// <https://docs.sarvam.ai/api-reference-docs/text-to-speech/streaming>
#[derive(Serialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum ClientMessage {
    Config { data: ConfigData },
    Text { data: TextData },
    Flush,
    Ping,
}

#[derive(Serialize, Clone)]
struct ConfigData {
    target_language_code: &'static str,
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
    /// Always `OUTPUT_AUDIO_CODEC` — see `SarvamTtsConfig`'s doc comment.
    output_audio_codec: &'static str,
}

#[derive(Serialize)]
struct TextData {
    text: String,
}
