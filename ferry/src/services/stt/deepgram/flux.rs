use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::tungstenite::http::HeaderName;

use super::{MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY, percent_encode};
use crate::frames::frames::FrameKind;
use crate::serializer::transport::serializer::FrameSerializer;
use crate::services::stt::deepgram::{EVENT_CHANNEL_CAPACITY, KEEPALIVE_INTERVAL};
use crate::services::stt::language::Language;
use crate::services::stt::provider::{
    SttConfig, SttConfigKind, SttError, SttEvent, SttProvider, SttSession, Transcript,
    WsOutboundClient,
};
use crate::turns::strategy::TurnStrategy;

const ENDPOINT: &str = "wss://api.deepgram.com/v2/listen";

/// Same audio contract as classic Deepgram: linear16 (s16le) PCM, mono,
/// fixed by the pipeline rather than a config choice. See
/// `stt::AUDIO_ENCODING` for why this isn't a field.
const AUDIO_ENCODING: &str = "linear16";

/// Flux's own model naming for its multilingual model, the only one that
/// honors `language_hints`.
const MULTILINGUAL_MODEL: &str = "flux-general-multi";

/// [`SttProvider`] backed by Deepgram Flux's live streaming WebSocket
/// (`/v2/listen`, not `/v1/listen`). A wholly different protocol from
/// classic Deepgram (`super::stt::DeepgramSttProvider`), not a mode of it:
/// different endpoint, different message schema (`TurnInfo` events rather
/// than `Results`/`SpeechStarted`/`UtteranceEnd`), and Flux detects turns
/// itself rather than only offering VAD hints.
/// <https://developers.deepgram.com/docs/flux/quickstart>
pub struct DeepgramFluxSttProvider {
    api_key: String,
}

impl DeepgramFluxSttProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl SttProvider for DeepgramFluxSttProvider {
    fn name(&self) -> &'static str {
        "deepgram-flux"
    }

    fn recommended_turn_strategy(&self) -> Option<TurnStrategy> {
        // Flux emits StartOfTurn/EndOfTurn itself, so nothing else needs
        // to run a local VAD/turn-detector alongside it.
        Some(TurnStrategy::External)
    }

    async fn open(
        &self,
        config: SttConfig,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn SttSession>, mpsc::Receiver<SttEvent>), SttError> {
        let SttConfigKind::DeepgramFluxSttConfig(vendor) = &config.kind else {
            return Err(SttError::Protocol(
                "deepgram-flux: config is not a DeepgramFluxSttConfig".to_string(),
            ));
        };
        let url = build_url(&config, vendor);

        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static("authorization"),
            format!("Token {}", self.api_key),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await?;

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);

        let read_task =
            Self::spawn_read_task("deepgram-flux", read, serializer, tx, move |frame| {
                let kind = frame.into_kind();
                // `EndOfTurn` finalizes the transcript and ends the
                // turn at once, but `FrameSerializer::deserialize`
                // only ever produces one `Frame` per message (see
                // `DeepgramFluxSerializer`'s doc comment), so the
                // stopped-speaking half is synthesized here instead.
                let stopped_speaking_too =
                    matches!(&kind, FrameKind::Transcription(t) if t.is_final);
                let mut events = match kind {
                    FrameKind::Transcription(t) => vec![SttEvent::Transcript(Transcript {
                        text: t.text,
                        language: None,
                        is_final: t.is_final,
                    })],
                    FrameKind::UserStartedSpeaking => vec![SttEvent::UserStartedSpeaking],
                    _ => vec![],
                };
                if stopped_speaking_too {
                    events.push(SttEvent::UserStoppedSpeaking);
                }
                events
            });

        // Same keepalive control message as classic Deepgram.
        // <https://developers.deepgram.com/docs/keep-alive>
        let keepalive_task = Self::spawn_keepalive_task(
            client.clone(),
            Message::Text(r#"{"type":"KeepAlive"}"#.into()),
            KEEPALIVE_INTERVAL,
        );

        Ok((
            Box::new(DeepgramFluxSttSession {
                client,
                read_task,
                keepalive_task,
            }) as Box<dyn SttSession>,
            rx,
        ))
    }
}

/// [`SttSession`] backed by a live Deepgram Flux WebSocket connection.
struct DeepgramFluxSttSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
}

#[async_trait]
impl SttSession for DeepgramFluxSttSession {
    async fn send_audio(&mut self, pcm: &[u8]) -> Result<(), SttError> {
        let payload = pcm.to_vec();
        self.client
            .send(Message::Binary(payload))
            .await
            .map_err(Into::into)
    }

    async fn close(self: Box<Self>) {
        // Same control message as classic Deepgram: no more audio is
        // coming, flush whatever turn is in flight.
        let _ = self
            .client
            .send(Message::Text(r#"{"type":"CloseStream"}"#.into()))
            .await;
        self.read_task.abort();
        self.keepalive_task.abort();
    }
}

/// Turns `SttConfig` and Flux's own knobs into the query string Flux's
/// `/v2/listen` endpoint expects.
/// <https://developers.deepgram.com/docs/flux/quickstart>
fn build_url(config: &SttConfig, vendor: &DeepgramFluxSttConfig) -> String {
    let model = vendor.model.as_deref().unwrap_or("flux-general-en");
    let mut params: Vec<(String, String)> = vec![
        ("model".into(), model.into()),
        ("encoding".into(), AUDIO_ENCODING.into()),
        ("sample_rate".into(), config.sample_rate.to_string()),
    ];

    if let Some(v) = vendor.eager_eot_threshold {
        params.push(("eager_eot_threshold".into(), v.to_string()));
    }
    if let Some(v) = vendor.eot_threshold {
        params.push(("eot_threshold".into(), v.to_string()));
    }
    if let Some(v) = vendor.eot_timeout_ms {
        params.push(("eot_timeout_ms".into(), v.to_string()));
    }
    if let Some(v) = vendor.numerals {
        params.push(("numerals".into(), v.to_string()));
    }
    if let Some(v) = vendor.mip_opt_out {
        params.push(("mip_opt_out".into(), v.to_string()));
    }
    for k in &vendor.keyterm {
        params.push(("keyterm".into(), k.clone()));
    }
    for t in &vendor.tag {
        params.push(("tag".into(), t.clone()));
    }

    if model == MULTILINGUAL_MODEL {
        for language in &config.languages {
            if let Some(hint) = flux_language_hint(*language) {
                params.push(("language_hint".into(), hint.into()));
            }
        }
    }

    let query = params
        .into_iter()
        .map(|(k, v)| format!("{}={}", percent_encode(&k), percent_encode(&v)))
        .collect::<Vec<_>>()
        .join("&");

    format!("{ENDPOINT}?{query}")
}

/// Maps a ferry `Language` to one of Flux's bare hint codes. Only honored
/// on `flux-general-multi`. Flux's supported set doesn't include ferry's
/// code-mixed varieties (Hinglish, ...) or most of its Indic languages
/// beyond Hindi, so those return `None` and are simply not hinted.
fn flux_language_hint(language: Language) -> Option<&'static str> {
    match language {
        Language::En => Some("en"),
        Language::Hi => Some("hi"),
        _ => None,
    }
}

/// Deepgram Flux's own knobs for its live streaming STT WebSocket.
///
/// Not present here, deliberately: `encoding`/`sample_rate` (fixed by the
/// pipeline, see [`build_url`]) and `language_hints` (lives on
/// [`SttConfig`]'s `languages` field, shared across every provider, same as
/// classic Deepgram's `language`).
impl DeepgramFluxSttConfig {
    /// Deepgram's own documented defaults, written explicitly rather
    /// than left as `None`/omitted from the request. Functionally the
    /// same as today, Deepgram applies these same values server-side
    /// when a parameter is absent, but stated here so they don't
    /// silently drift if Deepgram ever changes its own default; what
    /// ferry asks for is then this file, not a synced docs page.
    /// <https://developers.deepgram.com/docs/flux/quickstart>
    pub fn new() -> Self {
        Self {
            model: Some("flux-general-en".into()),
            eot_threshold: Some(0.7),
            eot_timeout_ms: Some(5000),
            // No documented recommended value: Deepgram gives a usable
            // range (0.3-0.9) but explicitly declines to prescribe one,
            // since it's a deployment-specific latency/false-start
            // tradeoff. Left unset rather than guessing.
            eager_eot_threshold: None,
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct DeepgramFluxSttConfig {
    /// e.g. "flux-general-en" or "flux-general-multi". Defaults to
    /// "flux-general-en" if unset.
    pub model: Option<String>,

    /// EagerEndOfTurn/TurnResumed threshold. Off by default. Lower values
    /// = more aggressive (faster response, more false starts).
    pub eager_eot_threshold: Option<f32>,

    /// End-of-turn confidence required to finish a turn. Deepgram's
    /// default is 0.7.
    pub eot_threshold: Option<f32>,

    /// Time in ms after speech to finish a turn regardless of EOT
    /// confidence. Deepgram's default is 5000.
    pub eot_timeout_ms: Option<u32>,

    /// Keyterms to boost recognition accuracy for specialized terminology.
    pub keyterm: Vec<String>,

    /// Convert spoken numbers to numeral form. Connection-time only: Flux
    /// doesn't support toggling this mid-stream.
    pub numerals: Option<bool>,

    /// Opt this request out of Deepgram's model improvement program.
    pub mip_opt_out: Option<bool>,

    /// Custom billing/usage tags attached to this request.
    pub tag: Vec<String>,
}

// Wire-format parsing for Flux's `TurnInfo`-based `/v2/listen` messages
// now lives in `DeepgramFluxSerializer`
// (crate::serializer::stt::deepgram_flux), shared with the `axum`-facing
// `Frame` pipeline rather than duplicated here.
