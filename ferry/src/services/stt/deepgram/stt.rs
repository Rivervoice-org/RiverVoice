use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use axum::http::HeaderName;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tokio_tungstenite::tungstenite::Message;

use super::percent_encode;
use crate::frames::frames::{Frame, FrameKind, RawAudioFrame};
use crate::serializer::serializer::FrameSerializer;
use crate::services::stt::deepgram::{
    EVENT_CHANNEL_CAPACITY, KEEPALIVE_INTERVAL, MAX_RECONNECT_ATTEMPTS, RECONNECT_DELAY,
};
use crate::services::stt::provider::{
    SttConfig, SttConfigKind, SttError, SttEvent, SttProvider, SttSession, Transcript,
    WsOutboundClient,
};

const ENDPOINT: &str = "wss://api.deepgram.com/v1/listen";

const AUDIO_ENCODING: &str = "linear16";

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
        let vendor = match &config.kind {
            SttConfigKind::DeepgramSttConfig(vendor) => vendor,
        };

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
        let read_task = Self::spawn_read_task(
            "deepgram",
            read,
            serializer.clone(),
            tx,
            move |frame| match frame.into_kind() {
                FrameKind::Transcription(t) => vec![SttEvent::Transcript(Transcript {
                    text: t.text,
                    language,
                    is_final: t.is_final,
                })],
                FrameKind::UserStartedSpeaking => vec![SttEvent::UserStartedSpeaking],
                FrameKind::UserStoppedSpeaking => vec![SttEvent::UserStoppedSpeaking],
                _ => vec![],
            },
        );

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
                serializer,
            }) as Box<dyn SttSession>,
            rx,
        ))
    }
}

struct DeepgramSttSession {
    client: WsOutboundClient,
    read_task: JoinHandle<()>,
    keepalive_task: JoinHandle<()>,
    serializer: Arc<dyn FrameSerializer<Message = Message>>,
}

#[async_trait]
impl SttSession for DeepgramSttSession {
    async fn send_audio(&mut self, frame: RawAudioFrame) -> Result<(), SttError> {
        let msg = self
            .serializer
            .serialize(Frame::new(FrameKind::RawAudio(frame)))
            .map_err(|e| SttError::Protocol(e.to_string()))?;

        self.client.send(msg).await.map_err(Into::into)
    }

    async fn close(self: Box<Self>) {
        let _ = self
            .client
            .send(Message::Text(r#"{"type":"CloseStream"}"#.into()))
            .await;
        self.read_task.abort();
        self.keepalive_task.abort();
    }
}

fn build_url(config: &SttConfig, vendor: &DeepgramSttConfig) -> String {
    let mut params: Vec<(String, String)> = vec![
        ("encoding".into(), AUDIO_ENCODING.into()),
        ("sample_rate".into(), config.sample_rate.to_string()),
        ("channels".into(), "1".into()),
    ];

    if let Some(language) = config.languages.first() {
        let code = language.code();
        let deepgram_lang = code.split('-').next().unwrap_or(code);
        params.push(("language".into(), deepgram_lang.into()));
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

impl DeepgramSttConfig {
    pub fn new() -> Self {
        Self {
            model: "nova-3".to_string().into(),
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
    pub model: Option<String>,

    pub punctuate: Option<bool>,

    pub smart_format: Option<bool>,

    pub interim_results: Option<bool>,

    pub endpointing: Option<Endpointing>,

    pub utterance_end_ms: Option<u32>,

    pub vad_events: Option<bool>,

    pub diarize: Option<bool>,

    pub diarize_model: Option<String>,

    pub numerals: Option<bool>,

    pub profanity_filter: Option<bool>,

    pub redact: Vec<String>,

    pub keywords: Vec<String>,

    pub keyterms: Vec<String>,

    pub detect_entities: Option<bool>,

    pub dictation: Option<bool>,

    pub filler_words: Option<bool>,

    pub search: Vec<String>,

    pub replace: Vec<String>,

    pub multichannel: Option<bool>,

    pub tag: Vec<String>,

    pub callback: Option<String>,

    pub callback_method: Option<String>,

    pub mip_opt_out: Option<bool>,

    pub extra: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub enum Endpointing {
    Ms(u32),

    Disabled,
}
