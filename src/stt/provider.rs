#[derive(Debug, Clone)]
pub enum SttEvent {
    SpeechStart,
    SpeechEnd,
    /// Text so far for the current utterance; superseded by later events.
    Partial(String),
    Final {
        text: String,
        language: Option<String>,
    },
}

