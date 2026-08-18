pub mod base;
pub mod min_words;
pub mod transcription;

pub use base::UserTurnStartStrategy;
pub use min_words::MinWordsUserTurnStartStrategy;
pub use transcription::TranscriptionUserTurnStartStrategy;

pub fn default_user_turn_start_strategies() -> Vec<Box<dyn UserTurnStartStrategy>> {
    vec![Box::new(TranscriptionUserTurnStartStrategy)]
}
