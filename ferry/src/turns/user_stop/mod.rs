//! Deciding that a user turn has ended.
//!
//! Unlike the start side, these do not race: whoever fires first would
//! always win, and the most impatient detector would cut people off
//! mid-sentence. Several may run, but exactly one may finalize the turn;
//! the others only report that now is a sensible moment to judge.

pub mod base;
pub mod external;
pub mod speech_timeout;

pub use base::UserTurnStopStrategy;
pub use external::ExternalUserTurnStopStrategy;
pub use speech_timeout::SpeechTimeoutUserTurnStopStrategy;
