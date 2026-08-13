//! Deciding that a user turn has begun.
//!
//! Each strategy here watches frames and says whether what it saw means
//! the user started a turn. Several run together and the first to say yes
//! wins: the controller opens the turn once and ignores the rest for that
//! turn. Adding detectors can therefore only make the start earlier or
//! more likely, never wrong, which is why this side is a list.

pub mod base;
pub mod min_words;
pub mod transcription;

pub use base::UserTurnStartStrategy;
pub use min_words::MinWordsUserTurnStartStrategy;
pub use transcription::TranscriptionUserTurnStartStrategy;

/// The default local start detectors — pipecat pairs VAD with a
/// transcription fallback (`default_user_turn_start_strategies` in
/// `pipecat.turns.user_turn_strategies`); ferry has no VAD stage yet (see
/// [`MinWordsUserTurnStartStrategy`]'s doc comment for why), so for now
/// this is transcription alone. Swap this out once a VAD stage exists,
/// same as pipecat's own list would change if it dropped VAD.
pub fn default_user_turn_start_strategies() -> Vec<Box<dyn UserTurnStartStrategy>> {
    vec![Box::new(TranscriptionUserTurnStartStrategy)]
}
