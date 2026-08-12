use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use serde::Deserialize;
use tokio::sync::mpsc::{self, Receiver};
use tokio::task::JoinHandle;

use crate::services::stt::language::Language;
use crate::services::stt::provider::{
    SttConfig, SttConfigKind, SttError, SttProvider, SttSession, Transcript,
};

const ENDPOINT: &str = "wss://api.deepgram.com/v1/listen";

/// What `RawAudioFrame` always contains: linear16 (s16le) PCM, mono. Not
/// a config field: there is no code path in ferry that produces anything
/// else, so exposing it as settable would let a caller ask Deepgram to
/// decode audio that was never actually sent in that format.
const AUDIO_ENCODING: &str = "linear16";

/// Deepgram closes an idle connection after ~10s of silence (its
/// NET-0001 error). A normal pause in conversation is enough to hit
/// that, so a keepalive runs for the life of every session.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(5);

/// Reconnect attempts before giving up on a connection that keeps
/// failing immediately (e.g. a bad API key rejected at the handshake).
const MAX_RECONNECT_ATTEMPTS: u32 = 5;
const RECONNECT_DELAY: Duration = Duration::from_millis(750);

/// [`SttProvider`] backed by Deepgram's live streaming WebSocket.
pub struct DeepgramSttProvider {
    api_key: String,
}

impl DeepgramSttProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
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
