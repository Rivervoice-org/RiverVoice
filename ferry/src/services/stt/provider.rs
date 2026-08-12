use std::future::Future;
use std::pin::Pin;

use tokio::sync::mpsc::Receiver;

use crate::services::stt::language::Language;

pub struct Transcript {
    pub text: String,
    pub language: Option<Language>,
    pub is_final: bool,
}

/// One vendor's speech-to-text, behind a shape the STT stage can hold
/// without knowing whose it is. Swapping Sarvam for Deepgram is one new
/// file here and one line where the pipeline is built.
pub trait SttProvider: Send {
    fn name(&self) -> &'static str;

    fn open(
        &self,
        config: SttConfig,
    ) -> Pin<
        Box<
            dyn Future<Output = Result<(Box<dyn SttSession>, Receiver<Transcript>), SttError>>
                + Send,
        >,
    >;
}

pub struct SttConfig {
    pub sample_rate: u32,
    /// Languages the caller may speak; first is primary. Some vendors
    /// pick per utterance and report which one back on the `Transcript`.
    pub languages: Vec<Language>,
    pub kind: SttConfigKind,
}

impl SttConfig {
    pub fn new(sample_rate: u32, languages: Vec<Language>, kind: SttConfigKind) -> Self {
        Self {
            sample_rate,
            languages,
            kind,
        }
    }
}

pub enum SttConfigKind {}

/// A live transcription session: one per call, closed when the call ends.
pub trait SttSession: Send {
    fn send_audio(
        &mut self,
        pcm: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<(), SttError>> + Send + '_>>;

    fn close(self: Box<Self>) -> Pin<Box<dyn Future<Output = ()> + Send>>;
}

#[derive(Debug)]
pub enum SttError {
    Connection(String),
    Rejected(String),
    Protocol(String),
}

impl std::fmt::Display for SttError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Connection(msg) => write!(f, "stt connection error: {msg}"),
            Self::Rejected(msg) => write!(f, "stt rejected: {msg}"),
            Self::Protocol(msg) => write!(f, "stt protocol error: {msg}"),
        }
    }
}

impl std::error::Error for SttError {}
