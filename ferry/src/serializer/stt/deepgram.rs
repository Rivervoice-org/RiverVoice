use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::frames::frames::{Frame, FrameKind, TranscriptionFrame};
use crate::serializer::serializer::FrameSerializer;

pub struct DeepgramSerializer;

impl DeepgramSerializer {
    pub fn new() -> Self {
        Self
    }
}

impl Default for DeepgramSerializer {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameSerializer for DeepgramSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => Ok(Message::Binary(audio.audio)),
            FrameKind::Transcription(_)
            | FrameKind::UserStartedSpeaking
            | FrameKind::UserStoppedSpeaking
            | FrameKind::ServiceMetadata(_)
            | FrameKind::UserTurnAggregation(_)
            | FrameKind::MtResponseStart
            | FrameKind::MtText(_)
            | FrameKind::MtResponseEnd
            | FrameKind::TtsAudioStart
            | FrameKind::TtsAudio(_)
            | FrameKind::TtsAudioStop
            | FrameKind::Metrics(_)
            | FrameKind::SttUsage(_)
            | FrameKind::MtUsage(_)
            | FrameKind::TtsUsage(_) => {
                anyhow::bail!("deepgram serializer: cannot send this frame to deepgram")
            }
        }
    }

    fn deserialize(&self, msg: Message) -> anyhow::Result<Option<Frame>> {
        match msg {
            Message::Text(text) => match parse_message(&text)? {
                Some(DeepgramEvent::Transcript(transcript)) => Ok(Some(Frame::new(
                    FrameKind::Transcription(TranscriptionFrame {
                        text: transcript.text,
                        is_final: transcript.is_final,
                    }),
                ))),
                Some(DeepgramEvent::UserStartedSpeaking) => {
                    Ok(Some(Frame::new(FrameKind::UserStartedSpeaking)))
                }
                Some(DeepgramEvent::UserStoppedSpeaking) => {
                    Ok(Some(Frame::new(FrameKind::UserStoppedSpeaking)))
                }
                None => Ok(None),
            },
            other => anyhow::bail!("deepgram serializer: unexpected message: {other:?}"),
        }
    }
}

pub struct DeepgramTranscript {
    pub text: String,
    pub is_final: bool,
}

pub enum DeepgramEvent {
    Transcript(DeepgramTranscript),

    UserStartedSpeaking,

    UserStoppedSpeaking,
}

pub fn parse_message(text: &str) -> anyhow::Result<Option<DeepgramEvent>> {
    let message: DeepgramMessage = serde_json::from_str(text)?;
    match message {
        DeepgramMessage::Results(results) => {
            let transcript = results
                .channel
                .alternatives
                .into_iter()
                .next()
                .map(|a| a.transcript)
                .unwrap_or_default();
            if transcript.is_empty() {
                // Deepgram emits empty transcripts constantly during
                // silence; this is "nothing to say", not an error, so skip
                // it rather than warn on every one.
                return Ok(None);
            }
            Ok(Some(DeepgramEvent::Transcript(DeepgramTranscript {
                text: transcript,
                is_final: results.is_final,
            })))
        }
        DeepgramMessage::SpeechStarted => Ok(Some(DeepgramEvent::UserStartedSpeaking)),
        DeepgramMessage::UtteranceEnd => Ok(Some(DeepgramEvent::UserStoppedSpeaking)),
        DeepgramMessage::Other => anyhow::bail!("deepgram: message carries nothing actionable"),
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum DeepgramMessage {
    Results(ResultsMessage),

    SpeechStarted,

    UtteranceEnd,
    #[serde(other)]
    Other,
}

#[derive(Debug, Deserialize)]
struct ResultsMessage {
    is_final: bool,
    channel: Channel,
}

#[derive(Debug, Deserialize)]
struct Channel {
    alternatives: Vec<Alternative>,
}

#[derive(Debug, Deserialize)]
struct Alternative {
    transcript: String,
}
