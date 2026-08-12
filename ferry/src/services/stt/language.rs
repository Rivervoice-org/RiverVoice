/// A language STT/TTS can be configured for.
///
/// Indic languages plus the code-mixed varieties (Hindi-English,
/// Telugu-English, ...) that Sarvam and similar vendors recognize as their
/// own distinct option. That is how people actually speak, not two
/// languages forced apart.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    /// English.
    En,
    /// Hindi.
    Hi,
    /// Telugu.
    Te,
    /// Tamil.
    Ta,
    /// Kannada.
    Kn,
    /// Malayalam.
    Ml,
    /// Marathi.
    Mr,
    /// Gujarati.
    Gu,
    /// Bengali.
    Bn,
    /// Punjabi.
    Pa,
    /// Odia.
    Or,
    /// Urdu.
    Ur,

    /// Hindi-English code-mixed.
    Hinglish,
    /// Telugu-English code-mixed.
    Tenglish,
    /// Tamil-English code-mixed.
    Tanglish,
    /// Kannada-English code-mixed.
    Kanglish,
    /// Malayalam-English code-mixed.
    Manglish,
}

impl Language {
    /// The tag a vendor's API expects. Plain languages use BCP-47. The
    /// code-mixed varieties have no such standard, so each vendor names
    /// them its own way; these are Sarvam's.
    pub fn code(&self) -> &'static str {
        match self {
            Self::En => "en-IN",
            Self::Hi => "hi-IN",
            Self::Te => "te-IN",
            Self::Ta => "ta-IN",
            Self::Kn => "kn-IN",
            Self::Ml => "ml-IN",
            Self::Mr => "mr-IN",
            Self::Gu => "gu-IN",
            Self::Bn => "bn-IN",
            Self::Pa => "pa-IN",
            Self::Or => "or-IN",
            Self::Ur => "ur-IN",
            Self::Hinglish => "hi-en",
            Self::Tenglish => "te-en",
            Self::Tanglish => "ta-en",
            Self::Kanglish => "kn-en",
            Self::Manglish => "ml-en",
        }
    }
}
