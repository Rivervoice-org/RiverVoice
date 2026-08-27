use std::sync::Mutex;

use base64::Engine;
use serde::{Deserialize, Serialize};
use tokio_tungstenite::tungstenite::Message;

use crate::audio::resampler::SampleRateAdapter;
use crate::codec::frame_serializer::FrameSerializer;
use crate::frames::{Frame, FrameKind, TranscriptionFrame};

pub struct SarvamSttSerializer {
    target_sample_rate: u32,
    rate_adapter: Mutex<Option<(u32, SampleRateAdapter)>>,
}

impl SarvamSttSerializer {
    pub fn new(target_sample_rate: u32) -> Self {
        Self {
            target_sample_rate,
            rate_adapter: Mutex::new(None),
        }
    }
}

impl FrameSerializer for SarvamSttSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => {
                let mut rate_adapter = self
                    .rate_adapter
                    .lock()
                    .map_err(|_| anyhow::anyhow!("sarvam stt: rate adapter lock poisoned"))?;
                let (adapter_rate, adapter) = rate_adapter.get_or_insert_with(|| {
                    (
                        audio.sample_rate,
                        SampleRateAdapter::new(audio.sample_rate, self.target_sample_rate),
                    )
                });
                if *adapter_rate != audio.sample_rate {
                    tracing::warn!(
                        expected = *adapter_rate,
                        got = audio.sample_rate,
                        "sarvam stt: sample rate changed mid-call, resampling from the original rate"
                    );
                }

                let samples: Vec<i16> = audio
                    .audio
                    .chunks_exact(2)
                    .map(|b| i16::from_le_bytes([b[0], b[1]]))
                    .collect();
                let mut resampled = Vec::new();
                adapter.push(&samples, &mut resampled);
                let pcm: Vec<u8> = resampled.iter().flat_map(|s| s.to_le_bytes()).collect();
                let audio_b64 = base64::engine::general_purpose::STANDARD.encode(pcm);

                let msg = ClientMessage::AudioInput { audio: audio_b64 };
                Ok(Message::Text(serde_json::to_string(&msg)?))
            }
            _other => {
                anyhow::bail!("sarvam stt serializer: no wire representation for this frame yet")
            }
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Option<Frame>> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                Some(SarvamSttEvent::Transcript { text, is_final }) => Ok(Some(Frame::new(
                    FrameKind::Transcription(TranscriptionFrame { text, is_final }),
                ))),
                Some(SarvamSttEvent::UserStartedSpeaking) => {
                    Ok(Some(Frame::new(FrameKind::UserStartedSpeaking)))
                }
                Some(SarvamSttEvent::UserStoppedSpeaking) => {
                    Ok(Some(Frame::new(FrameKind::UserStoppedSpeaking)))
                }
                None => Ok(None),
            },
            other => anyhow::bail!("sarvam stt serializer: unexpected message: {other:?}"),
        }
    }
}

// docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming
#[derive(Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
enum ClientMessage {
    AudioInput { audio: String },
}

pub enum SarvamSttEvent {
    Transcript { text: String, is_final: bool },

    UserStartedSpeaking,

    UserStoppedSpeaking,
}

pub fn parse_message(text: &str) -> anyhow::Result<Option<SarvamSttEvent>> {
    let message: ServerMessage = serde_json::from_str(text)?;
    match message {
        ServerMessage::TranscriptPartial { text } if !text.is_empty() => {
            Ok(Some(SarvamSttEvent::Transcript {
                text,
                is_final: false,
            }))
        }
        ServerMessage::TranscriptFinal { text } if !text.is_empty() => {
            Ok(Some(SarvamSttEvent::Transcript {
                text,
                is_final: true,
            }))
        }
        ServerMessage::TranscriptPartial { .. } | ServerMessage::TranscriptFinal { .. } => Ok(None),
        ServerMessage::VadSpeechStart => Ok(Some(SarvamSttEvent::UserStartedSpeaking)),
        ServerMessage::VadSpeechEnd => Ok(Some(SarvamSttEvent::UserStoppedSpeaking)),
        ServerMessage::Error { message, .. } => {
            anyhow::bail!("sarvam stt: server error: {message}")
        }
        ServerMessage::Other => anyhow::bail!("sarvam stt: message carries nothing actionable"),
    }
}

#[derive(Deserialize)]
#[serde(tag = "event")]
enum ServerMessage {
    #[serde(rename = "transcript.partial")]
    TranscriptPartial { text: String },

    #[serde(rename = "transcript.final")]
    TranscriptFinal { text: String },

    #[serde(rename = "vad.speech_start")]
    VadSpeechStart,

    #[serde(rename = "vad.speech_end")]
    VadSpeechEnd,

    #[serde(rename = "error")]
    Error {
        #[allow(dead_code)]
        code: Option<String>,
        message: String,
    },

    #[serde(other)]
    Other,
}
