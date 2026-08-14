use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use axum::http::HeaderName;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

use super::percent_encode;
use crate::frames::frames::FrameKind;
use crate::serializer::transport::serializer::FrameSerializer;
use crate::services::stt::deepgram::{
    EVENT_CHANNEL_CAPACITY, KEEPALIVE_INTERVAL, MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY,
};
use crate::services::stt::provider::{
    SttConfig, SttConfigKind, SttError, SttEvent, SttProvider, SttSession, Transcript,
    WsOutboundClient,
};

const ENDPOINT: &str = "wss://api.deepgram.com/v1/listen";

/// What `RawAudioFrame` always contains: linear16 (s16le) PCM, mono. Not
/// a config field: there is no code path in ferry that produces anything
/// else, so exposing it as settable would let a caller ask Deepgram to
/// decode audio that was never actually sent in that format.
const AUDIO_ENCODING: &str = "linear16";

/// [`SttProvider`] backed by Deepgram's live streaming WebSocket.
pub struct DeepgramSttProvider {
    api_key: String,
}

impl DeepgramSttProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait]
impl SttProvider for DeepgramSttProvider {
    fn name(&self) -> &'static str {
        "deepgram"
    }

    async fn open(
        &self,
        config: SttConfig,
        serializer: Arc<dyn FrameSerializer<Message = Message>>,
    ) -> Result<(Box<dyn SttSession>, mpsc::Receiver<SttEvent>), SttError> {
        let SttConfigKind::DeepgramSttConfig(vendor) = &config.kind else {
            return Err(SttError::Protocol(
                "deepgram: config is not a DeepgramSttConfig".to_string(),
            ));
        };
        // Deepgram's own requirement: UtteranceEnd is derived from
        // interim results, so it never fires without interim_results
        // also being on — silently, since the connection still opens
        // fine. Left unchecked, `UserStoppedSpeaking` would just never
        // arrive and the pipeline would fall back to the blunt
        // watchdog on every turn, with nothing pointing at why.
        // <https://developers.deepgram.com/docs/utterance-end>
        if vendor.utterance_end_ms.is_some() && vendor.interim_results != Some(true) {
            return Err(SttError::Protocol(
                "deepgram: utterance_end_ms requires interim_results=true, or UtteranceEnd (and UserStoppedSpeaking) will never fire"
                    .to_string(),
            ));
        }
        let url = build_url(&config, vendor);
        let language = config.languages.first().copied();

        let (client, read) = crate::services::ws_client::connect_with_retries(
            &url,
            HeaderName::from_static("authorization"),
            format!("Token {}", self.api_key),
            MAX_RECONNECT_ATTEMPTS,
            RECONNECT_DELAY,
        )
        .await?;

        let (tx, rx) = mpsc::channel(EVENT_CHANNEL_CAPACITY);
        let read_task = Self::spawn_read_task("deepgram", read, serializer, tx, move |frame| {
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

        // Deepgram's documented keepalive control message — a text
        // frame, not audio, specifically so it holds the connection
        // open without being processed/billed as speech.
        // <https://developers.deepgram.com/docs/keep-alive>
        let keepalive_task = Self::spawn_keepalive_task(
            client.clone(),
            Message::Text(r#"{"type":"KeepAlive"}"#.into()),
            KEEPALIVE_INTERVAL,
        );

        Ok((
            Box::new(DeepgramSttSession {
                client,
                read_task,
                keepalive_task,
            }) as Box<dyn SttSession>,
            rx,
        ))
    }
}

/// [`SttSession`] backed by a live Deepgram WebSocket connection.
struct DeepgramSttSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
}

#[async_trait]
impl SttSession for DeepgramSttSession {
    async fn send_audio(&mut self, pcm: &[u8]) -> Result<(), SttError> {
        // One copy is unavoidable here: `Message::Binary` needs an owned
        // buffer to hand to the socket. Taking `&[u8]` rather than `Vec<u8>`
        // just means this is the only copy — the caller doesn't also need
        // its own spare owned buffer just to satisfy this signature.
        let payload = pcm.to_vec();
        self.client
            .send(Message::Binary(payload))
            .await
            .map_err(Into::into)
    }

    async fn close(self: Box<Self>) {
        // Tells Deepgram no more audio is coming, so it flushes any final
        // transcript instead of waiting out its own silence timeout.
        // https://developers.deepgram.com/docs/close-stream
        let _ = self
            .client
            .send(Message::Text(r#"{"type":"CloseStream"}"#.into()))
            .await;
        self.read_task.abort();
        self.keepalive_task.abort();
    }
}

/// Turns `SttConfig` and Deepgram's own knobs into the query string
/// Deepgram's WebSocket endpoint expects.
///
/// Full parameter reference:
/// <https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming>
fn build_url(config: &SttConfig, vendor: &DeepgramSttConfig) -> String {
    let mut params: Vec<(String, String)> = vec![
        ("encoding".into(), AUDIO_ENCODING.into()),
        ("sample_rate".into(), config.sample_rate.to_string()),
        ("channels".into(), "1".into()),
    ];

    if let Some(language) = config.languages.first() {
        params.push(("language".into(), language.code().into()));
    }
    if let Some(model) = &vendor.model {
        params.push(("model".into(), model.clone()));
    }
    if let Some(v) = vendor.punctuate {
        params.push(("punctuate".into(), v.to_string()));
    }
    if let Some(v) = vendor.smart_format {
        params.push(("smart_format".into(), v.to_string()));
    }
    if let Some(v) = vendor.interim_results {
        params.push(("interim_results".into(), v.to_string()));
    }
    match &vendor.endpointing {
        Some(Endpointing::Ms(ms)) => params.push(("endpointing".into(), ms.to_string())),
        Some(Endpointing::Disabled) => params.push(("endpointing".into(), "false".into())),
        None => {}
    }
    if let Some(ms) = vendor.utterance_end_ms {
        params.push(("utterance_end_ms".into(), ms.to_string()));
    }
    if let Some(v) = vendor.vad_events {
        params.push(("vad_events".into(), v.to_string()));
    }
    if let Some(v) = vendor.diarize {
        params.push(("diarize".into(), v.to_string()));
    }
    if let Some(m) = &vendor.diarize_model {
        params.push(("diarize_model".into(), m.clone()));
    }
    if let Some(v) = vendor.numerals {
        params.push(("numerals".into(), v.to_string()));
    }
    if let Some(v) = vendor.profanity_filter {
        params.push(("profanity_filter".into(), v.to_string()));
    }
    for r in &vendor.redact {
        params.push(("redact".into(), r.clone()));
    }
    for k in &vendor.keywords {
        params.push(("keywords".into(), k.clone()));
    }
    for k in &vendor.keyterms {
        params.push(("keyterm".into(), k.clone()));
    }
    if let Some(v) = vendor.detect_entities {
        params.push(("detect_entities".into(), v.to_string()));
    }
    if let Some(v) = vendor.dictation {
        params.push(("dictation".into(), v.to_string()));
    }
    if let Some(v) = vendor.filler_words {
        params.push(("filler_words".into(), v.to_string()));
    }
    for s in &vendor.search {
        params.push(("search".into(), s.clone()));
    }
    for r in &vendor.replace {
        params.push(("replace".into(), r.clone()));
    }
    if let Some(v) = vendor.multichannel {
        params.push(("multichannel".into(), v.to_string()));
    }
    for t in &vendor.tag {
        params.push(("tag".into(), t.clone()));
    }
    if let Some(cb) = &vendor.callback {
        params.push(("callback".into(), cb.clone()));
    }
    if let Some(m) = &vendor.callback_method {
        params.push(("callback_method".into(), m.clone()));
    }
    if let Some(v) = vendor.mip_opt_out {
        params.push(("mip_opt_out".into(), v.to_string()));
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

/// Deepgram's own knobs for its live streaming STT WebSocket.
///
/// Full parameter reference:
/// <https://developers.deepgram.com/reference/speech-to-text-api/listen-streaming>
///
/// Every field is `Option`/`Vec`: `None`/empty means "not set, let
/// Deepgram use its own default"; a value means "send this explicitly".
///
/// Not present here, deliberately:
/// - `encoding`, `sample_rate`, `channels`: fixed by the pipeline, not a
///   per-call choice. Audio always leaves ferry as linear16 (s16le) mono
///   at the rate on [`SttConfig`], so the provider sends those three
///   itself; exposing them here would let a caller ask for something the
///   pipeline can't actually produce.
/// - `language`: lives on [`SttConfig`]'s `languages` field, shared
///   across every provider.
/// - `detect_language`: unsupported for streaming. Deepgram's own docs:
///   "Language Detection is not currently supported for streaming."
///   <https://developers.deepgram.com/docs/language-detection>
impl DeepgramSttConfig {
    /// The subset of Deepgram's knobs ferry benefits from by default,
    /// not Deepgram's own defaults, which are tuned for a generic
    /// caller with no turn detection or LLM downstream of its own.
    ///
    /// - `interim_results`: on. Required for `utterance_end_ms` to ever
    ///   fire (see its doc comment), and separately what
    ///   `MinWordsUserTurnStartStrategy` wants for a fast turn start
    ///   without waiting on a final transcript.
    /// - `utterance_end_ms`: 1000. A real `UserStoppedSpeaking` signal
    ///   from Deepgram itself, rather than relying on `TurnController`'s
    ///   blunt inactivity watchdog for every turn. 1000ms is also
    ///   Deepgram's own documented minimum: interim results arrive about
    ///   once a second, so a lower value has nothing to trigger on.
    ///   <https://developers.deepgram.com/docs/utterance-end>
    /// - `vad_events`: on. A fast `UserStartedSpeaking` signal ahead of
    ///   any transcript. Safe alongside a local VAD too:
    ///   `TurnController::observe` treats a repeated start as a no-op,
    ///   so whichever fires first just wins.
    /// - `smart_format`: on. Every transcript here eventually reaches an
    ///   LLM; unformatted, unpunctuated text only makes that worse. Not
    ///   paired with `punctuate`: Deepgram's docs say smart_format
    ///   already enables punctuation, setting both is redundant.
    ///   <https://developers.deepgram.com/docs/smart-format>
    ///
    /// Everything else (redaction, diarization, billing tags, a
    /// callback URL, ...) stays unset: opt-in features with real
    /// cost/behavior/privacy implications a generic default must not
    /// switch on unasked.
    pub fn new() -> Self {
        Self {
            interim_results: Some(true),
            utterance_end_ms: Some(1000),
            vad_events: Some(true),
            smart_format: Some(true),
            ..Default::default()
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct DeepgramSttConfig {
    /// e.g. "nova-3-general". See Deepgram's model list for what a given
    /// API key has access to.
    pub model: Option<String>,

    /// Add punctuation and capitalization to the transcript. Default
    /// `false`.
    pub punctuate: Option<bool>,

    /// Apply formatting improvements (dates, currency, phone numbers,
    /// etc.) beyond raw punctuation. Default `false`.
    pub smart_format: Option<bool>,

    /// Stream partial results as speech comes in, not just the committed
    /// final for each utterance. Default `false`.
    pub interim_results: Option<bool>,

    /// Silence-based utterance finalization. `None` leaves Deepgram's own
    /// default (10ms) in effect. Disabling is a distinct wire value
    /// (`endpointing=false`), not a duration of zero: without it,
    /// Deepgram flushes on its own internal chunking cadence instead of
    /// waiting for silence.
    /// <https://developers.deepgram.com/docs/endpointing>
    pub endpointing: Option<Endpointing>,

    /// Silence, in ms, before Deepgram emits an UtteranceEnd event.
    /// Works alongside `endpointing` rather than replacing it: endpointing
    /// decides when a transcript is finalized, this decides when the
    /// speaker's turn is considered over.
    ///
    /// Requires `interim_results: Some(true)` — Deepgram derives
    /// UtteranceEnd from interim results, so it silently never fires
    /// without them. [`DeepgramSttProvider::open`] rejects a config that
    /// sets this without also enabling `interim_results`, rather than
    /// connecting and never producing `UserStoppedSpeaking`.
    /// <https://developers.deepgram.com/docs/utterance-end>
    pub utterance_end_ms: Option<u32>,

    /// Emit a "Speech Started" message the moment Deepgram's own VAD
    /// detects speech, ahead of any transcript. Default `false`.
    pub vad_events: Option<bool>,

    /// Tag speaker changes in the transcript. Default `false`. Deepgram
    /// marks this deprecated in favor of `diarize_model`.
    pub diarize: Option<bool>,

    /// Which diarization model version to use ("latest" or "v1"), if
    /// diarization is enabled.
    pub diarize_model: Option<String>,

    /// Convert spoken numbers to numerals ("twenty three" -> "23").
    /// Default `false`.
    pub numerals: Option<bool>,

    /// Filter recognized profanity from the transcript. Default `false`.
    pub profanity_filter: Option<bool>,

    /// Redaction categories to strip from the transcript: broad groups
    /// (`pci`, `pii`, `phi`, `numbers`, `aggressive_numbers`) or specific
    /// entity types (`credit_card`, `email_address`, ...). Repeatable;
    /// each entry becomes its own `redact=` parameter.
    /// <https://developers.deepgram.com/docs/redaction>
    pub redact: Vec<String>,

    /// Words or short phrases to bias recognition toward.
    pub keywords: Vec<String>,

    /// Deepgram's newer keyterm boosting (nova-3 and later models);
    /// prefer this over `keywords` on those models.
    pub keyterms: Vec<String>,

    /// Named entity detection/extraction. Implies punctuation. Default
    /// `false`.
    pub detect_entities: Option<bool>,

    /// Converts spoken commands ("comma", "new line") into the
    /// punctuation/formatting they name, instead of transcribing them
    /// literally. Default `false`.
    pub dictation: Option<bool>,

    /// Keep filler words ("uh", "um") in the transcript instead of
    /// stripping them. Default `false` (fillers stripped). Only affects
    /// English on the Nova, Nova-2, and Nova-3 models.
    /// <https://developers.deepgram.com/docs/filler-words>
    pub filler_words: Option<bool>,

    /// Terms to highlight in the transcript without affecting
    /// recognition.
    pub search: Vec<String>,

    /// Find-and-replace rules applied to the transcript text.
    pub replace: Vec<String>,

    /// Transcribe each audio channel independently. Default `false`.
    /// Ferry's pipeline is always mono, so this rarely applies; present
    /// for completeness and for any future multi-channel source.
    pub multichannel: Option<bool>,

    /// Custom billing/usage tags attached to this request.
    pub tag: Vec<String>,

    /// URL Deepgram POSTs the final result to, for async delivery
    /// alongside (or instead of) the live WebSocket stream.
    pub callback: Option<String>,

    /// HTTP method used for `callback`. Default `POST`.
    pub callback_method: Option<String>,

    /// Opt this request out of Deepgram's model improvement program.
    /// Default `false`.
    pub mip_opt_out: Option<bool>,

    /// Anything Deepgram adds before this struct catches up. Sent as
    /// additional query parameters as-is, the same escape hatch
    /// Pipecat's `extra` dict serves.
    pub extra: HashMap<String, String>,
}

/// See [`DeepgramSttConfig::endpointing`].
#[derive(Debug, Clone)]
pub enum Endpointing {
    /// Finalize after this many ms of silence.
    Ms(u32),
    /// No silence-based finalization.
    Disabled,
}
