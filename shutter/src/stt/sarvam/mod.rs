use serde_json::{Value, json};

use crate::stt::provider::{AudioEncoding, DialectEvent, SttEvent, WsDialect, WsSession};

pub struct Sarvam {
    api_key: String,
}

impl Sarvam {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            api_key: std::env::var("SARVAM_API_KEY")
                .map_err(|_| "missing env var SARVAM_API_KEY".to_string())?,
        })
    }

    pub async fn open(
        self,
        language_code: &str,
        encoding: AudioEncoding,
    ) -> Result<WsSession<Self>, String> {
        WsSession::open(self, language_code, encoding).await
    }
}

impl WsDialect for Sarvam {
    fn url(&self, language_code: &str, encoding: AudioEncoding) -> String {
        let (name, rate) = match encoding {
            AudioEncoding::Mulaw8k => ("mulaw", 8000),
            AudioEncoding::Linear16At8k => ("linear16", 8000),
            AudioEncoding::Linear16At16k => ("linear16", 16000),
        };

        format!(
            "wss://api.sarvam.ai/speech-to-text-realtime/ws\
             ?language_code={language_code}\
             &encoding={name}\
             &sample_rate={rate}\
             &stream_type=fast"
        )
    }

    fn auth_header(&self) -> (&'static str, String) {
        ("api-subscription-key", self.api_key.clone())
    }

    fn audio_message(&self, frame_b64: &str) -> String {
        json!({ "event": "audio_input", "audio": frame_b64 }).to_string()
    }

    fn keepalive_message(&self) -> Option<String> {
        Some(json!({ "event": "ping" }).to_string())
    }

    fn end_message(&self) -> Option<String> {
        Some(json!({ "event": "end" }).to_string())
    }

    fn parse_event(&self, message: &Value) -> DialectEvent {
        let text = || message["text"].as_str().unwrap_or_default().to_string();

        match message["event"].as_str().unwrap_or_default() {
            "vad.speech_start" => DialectEvent::Stt(SttEvent::SpeechStart),
            "vad.speech_end" => DialectEvent::Stt(SttEvent::SpeechEnd),
            "transcript.partial" => DialectEvent::Stt(SttEvent::Partial(text())),
            "transcript.final" => DialectEvent::Stt(SttEvent::Final {
                text: text(),
                language: message["language"].as_str().map(str::to_string),
            }),

            "session.end" => {
                println!(
                    "sarvam session ended, billed {}s",
                    message["audio_duration_s"]
                );
                DialectEvent::Ended
            }

            "error" => {
                let detail = message["message"].as_str().unwrap_or("unknown");
                let code = message["code"].as_str().unwrap_or("");

                if message["is_fatal"].as_bool().unwrap_or(false) {
                    DialectEvent::Failed(format!("{code}: {detail}"))
                } else {
                    println!("sarvam warning {code}: {detail}");
                    DialectEvent::Ignored
                }
            }

            _ => DialectEvent::Ignored,
        }
    }
}
