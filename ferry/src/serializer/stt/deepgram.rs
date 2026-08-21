use std::sync::Mutex;

use serde::Deserialize;
use tokio_tungstenite::tungstenite::Message;

use crate::audio::resampler::SampleRateAdapter;
use crate::frames::frames::{Frame, FrameKind, TranscriptionFrame};
use crate::serializer::serializer::FrameSerializer;

pub struct DeepgramSerializer {
    target_sample_rate: u32,
    rate_adapter: Mutex<Option<(u32, SampleRateAdapter)>>,
}

impl DeepgramSerializer {
    pub fn new(target_sample_rate: u32) -> Self {
        Self {
            target_sample_rate,
            rate_adapter: Mutex::new(None),
        }
    }
}

impl FrameSerializer for DeepgramSerializer {
    type Message = Message;

    fn serialize(&self, frame: Frame) -> anyhow::Result<Message> {
        match frame.into_kind() {
            FrameKind::RawAudio(audio) => {
                let mut rate_adapter = self
                    .rate_adapter
                    .lock()
                    .map_err(|_| anyhow::anyhow!("deepgram: rate adapter lock poisoned"))?;
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
                        "stt: sample rate changed mid-call, resampling from the original rate"
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
                Ok(Message::Binary(pcm))
            }
            _other => {
                anyhow::bail!("deepgram serializer: no wire representation for this frame yet")
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
