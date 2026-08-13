use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use futures_util::StreamExt;
use serde::Deserialize;
use tokio::sync::mpsc::{self, Receiver};
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

use super::{connect_with_retries, percent_encode};
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

const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(5);

const EVENT_CHANNEL_CAPACITY: usize = 32;

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

impl SttProvider for DeepgramFluxSttProvider {
    fn name(&self) -> &'static str {
        "deepgram-flux"
    }

    fn recommended_turn_strategy(&self) -> Option<TurnStrategy> {
        // Flux emits StartOfTurn/EndOfTurn itself, so nothing else needs
        // to run a local VAD/turn-detector alongside it.
        Some(TurnStrategy::External)
    }

    fn open(
        &self,
        config: SttConfig,
    ) -> Pin<
        Box<
            dyn Future<Output = Result<(Box<dyn SttSession>, Receiver<SttEvent>), SttError>> + Send,
        >,
    > {
        let api_key = self.api_key.clone();
        Box::pin(async move {
            let SttConfigKind::DeepgramFluxSttConfig(vendor) = &config.kind else {
                return Err(SttError::Protocol(
                    "deepgram-flux: config is not a DeepgramFluxSttConfig".to_string(),
                ));
            };
            let url = build_url(&config, vendor);

            let (client, mut read) = connect_with_retries(&url, &api_key).await?;

            let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
            let read_task = tokio::spawn(async move {
                while let Some(msg) = read.next().await {
                    let msg = match msg {
                        Ok(msg) => msg,
                        Err(e) => {
                            tracing::warn!("deepgram-flux: connection read error, closing: {e}");
                            break;
                        }
                    };
                    let Message::Text(text) = msg else {
                        continue;
                    };
                    for event in parse_message(&text) {
                        if tx.send(event).await.is_err() {
                            return; // caller dropped the receiver, nothing left to do
                        }
                    }
                }
            });

            let keepalive_client = client.clone();
            let keepalive_task = tokio::spawn(async move {
                loop {
                    let idle = keepalive_client.idle_for();
                    if idle < KEEPALIVE_INTERVAL {
                        // Audio (or a prior keepalive) already covered this
                        // window; wait out the remainder and re-check,
                        // rather than firing on a fixed clock regardless of
                        // real traffic.
                        tokio::time::sleep(KEEPALIVE_INTERVAL - idle).await;
                        continue;
                    }
                    if !keepalive_client.keepalive().await {
                        break; // connection is dead; the read task will notice too
                    }
                }
            });

            Ok((
                Box::new(DeepgramFluxSttSession {
                    client,
                    read_task,
                    keepalive_task,
                }) as Box<dyn SttSession>,
                rx,
            ))
        })
    }
}

/// [`SttSession`] backed by a live Deepgram Flux WebSocket connection.
struct DeepgramFluxSttSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
}

impl SttSession for DeepgramFluxSttSession {
    fn send_audio(
        &mut self,
        pcm: &[u8],
    ) -> Pin<Box<dyn Future<Output = Result<(), SttError>> + Send + '_>> {
        let payload = pcm.to_vec();
        Box::pin(async move { self.client.send(Message::Binary(payload)).await })
    }

    fn close(self: Box<Self>) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        Box::pin(async move {
            // Same control message as classic Deepgram: no more audio is
            // coming, flush whatever turn is in flight.
            let _ = self
                .client
                .send(Message::Text(r#"{"type":"CloseStream"}"#.into()))
                .await;
            self.read_task.abort();
            self.keepalive_task.abort();
        })
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

/// Parses one text message off Deepgram Flux's WebSocket into zero or more
/// events. Zero for message types this provider doesn't act on
/// (`Connected`, `ConfigureSuccess`/`ConfigureFailure`, malformed JSON,
/// ...); two for `EndOfTurn`, which both finalizes the transcript and
/// signals the turn stopped.
fn parse_message(text: &str) -> Vec<SttEvent> {
    let message: FluxMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            tracing::trace!("deepgram-flux: dropping unparsable message: {e}");
            return Vec::new();
        }
    };

    match message {
        FluxMessage::TurnInfo(info) => match info.event {
            FluxEventType::StartOfTurn => vec![SttEvent::UserStartedSpeaking],
            FluxEventType::EndOfTurn => vec![
                SttEvent::Transcript(Transcript {
                    text: info.transcript,
                    language: None,
                    is_final: true,
                }),
                SttEvent::UserStoppedSpeaking,
            ],
            FluxEventType::EagerEndOfTurn if !info.transcript.is_empty() => {
                vec![SttEvent::Transcript(Transcript {
                    text: info.transcript,
                    language: None,
                    is_final: false,
                })]
            }
            // TurnResumed and Update carry nothing this slice acts on yet.
            FluxEventType::EagerEndOfTurn | FluxEventType::TurnResumed | FluxEventType::Update => {
                Vec::new()
            }
        },
        FluxMessage::Error(err) => {
            tracing::warn!("deepgram-flux: fatal error from server: {}", err.error);
            Vec::new()
        }
        FluxMessage::Other => Vec::new(),
    }
}

/// The message shapes Deepgram Flux (`/v2/listen`) sends on its live
/// streaming WebSocket that this parser cares about. A completely
/// different envelope from classic Deepgram's (see
/// `super::super::deepgram`'s `DeepgramMessage`): no `Results`/
/// `SpeechStarted`/`UtteranceEnd`, everything turn-related is wrapped in
/// `TurnInfo` instead.
///
/// Also sent but not modeled here, since nothing currently acts on them:
/// `Connected` (handshake acknowledgement) and `ConfigureSuccess`/
/// `ConfigureFailure` (acks for a `Configure` control message this
/// provider never sends); both fall into `Other`.
/// <https://developers.deepgram.com/docs/flux/quickstart>
/// <https://developers.deepgram.com/docs/flux/state>
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum FluxMessage {
    /// One frame of Flux's turn state machine. Every `event` value shares
    /// this same envelope:
    ///
    /// ```json
    /// {
    ///   "type": "TurnInfo",
    ///   "event": "EndOfTurn",
    ///   "turn_index": 3,
    ///   "audio_window_start": 4.0,
    ///   "audio_window_end": 6.4,
    ///   "transcript": "hello there",
    ///   "words": [
    ///     { "word": "hello", "confidence": 0.99, "start": 4.1, "end": 4.4 }
    ///   ],
    ///   "end_of_turn_confidence": 0.92
    /// }
    /// ```
    ///
    /// `flux-general-multi` additionally carries `languages`/
    /// `languages_hinted`, which this parser doesn't read (see
    /// `flux_language_hint` for the outbound side of language handling).
    /// Only `event` and `transcript` are modeled on [`TurnInfo`] below;
    /// `turn_index`/the audio window/`words`/confidence have no consumer
    /// yet and are dropped the same way classic Deepgram's word timings
    /// are.
    TurnInfo(TurnInfo),
    /// A fatal error terminating the connection.
    ///
    /// ```json
    /// { "type": "Error", "error": "some description" }
    /// ```
    Error(FluxError),
    #[serde(other)]
    Other,
}

/// See [`FluxMessage::TurnInfo`] for the full payload; only the two fields
/// this parser reads.
#[derive(Debug, Deserialize)]
struct TurnInfo {
    event: FluxEventType,
    /// Guaranteed non-empty on `StartOfTurn`/`EagerEndOfTurn`/`EndOfTurn`
    /// per Deepgram's docs; can be empty on `Update`/`TurnResumed`, which
    /// this parser ignores regardless (see `parse_message`).
    #[serde(default)]
    transcript: String,
}

#[derive(Debug, Deserialize)]
struct FluxError {
    #[serde(default)]
    error: String,
}

/// `TurnInfo.event`. Deepgram's own turn state machine:
/// <https://developers.deepgram.com/docs/flux/state>
///
/// - `StartOfTurn`: speech began; transcript is always non-empty.
/// - `Update`: fired roughly every 0.25s while the turn is in progress,
///   independent of whether the transcript actually changed.
/// - `EagerEndOfTurn`: end-of-turn confidence crossed
///   `eager_eot_threshold` but not `eot_threshold` yet; transcript is
///   always non-empty. May still be followed by `TurnResumed` if the user
///   keeps talking.
/// - `TurnResumed`: speech continued after an `EagerEndOfTurn`.
/// - `EndOfTurn`: the turn is finalized; transcript matches whatever the
///   immediately preceding `EagerEndOfTurn` reported, per Deepgram's docs.
///   `turn_index` increments right after this.
#[derive(Debug, Deserialize)]
enum FluxEventType {
    StartOfTurn,
    TurnResumed,
    EndOfTurn,
    EagerEndOfTurn,
    Update,
}
