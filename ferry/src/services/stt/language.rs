#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Language {
    En,

    Hi,

    Te,

    Ta,

    Kn,

    Ml,

    Mr,

    Gu,

    Bn,

    Pa,

    Or,

    Ur,

    Hinglish,

    Tenglish,

    Tanglish,

    Kanglish,

    Manglish,
}

impl Language {
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
