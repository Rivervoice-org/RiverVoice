use crate::frames::frames::FrameKind;
use crate::turns::user_start::base::UserTurnStartStrategy;

/// Starts the turn once the user has said at least a minimum number of
/// words — but only while the bot is speaking.
///
/// The problem this solves: without it, a bare transcript ("mm-hmm")
/// interrupts the bot mid-sentence just because the user made a sound of
/// agreement. Two thresholds fix that:
///
/// - bot silent: 1 word is enough — normal turn-taking, no filtering.
/// - bot speaking: `min_words` are required — a backchannel like
///   "mm-hmm" or "yeah" falls short and is ignored; "wait, stop, I meant
///   Tuesday" clears the bar and interrupts.
///
/// Ferry has no bot-speaking signal yet (no TTS stage exists to say when
/// the bot is talking), so `bot_speaking` is always `false` today and
/// this behaves like "1 word starts the turn" — a no-op filter until
/// that signal exists. The threshold logic is written for when it does,
/// rather than left out and rebuilt later.
pub struct MinWordsUserTurnStartStrategy {
    min_words: usize,
    use_interim: bool,
    bot_speaking: bool,
}

impl MinWordsUserTurnStartStrategy {
    pub fn new(min_words: usize) -> Self {
        Self {
            min_words,
            use_interim: true,
            bot_speaking: false,
        }
    }

    /// Whether interim (not yet final) transcripts count toward the word
    /// total. On by default: waiting for a final transcript to count
    /// words would add STT's own latency to every turn start.
    pub fn use_interim(mut self, use_interim: bool) -> Self {
        self.use_interim = use_interim;
        self
    }
}

impl UserTurnStartStrategy for MinWordsUserTurnStartStrategy {
    fn name(&self) -> &'static str {
        "min-words"
    }

    fn observe(&mut self, kind: &FrameKind) -> bool {
        let FrameKind::Transcription(t) = kind else {
            return false;
        };
        // A final transcript always counts — it's the last chance to see
        // this text. use_interim only decides whether an interim one does.
        if !t.is_final && !self.use_interim {
            return false;
        }

        let required = if self.bot_speaking { self.min_words } else { 1 };
        t.text.split_whitespace().count() >= required
    }

    fn turn_started(&mut self) {
        // The next turn starts fresh: whatever made the bot speak during
        // this one is over.
        self.bot_speaking = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frames::frames::TranscriptionFrame;

    fn transcript(text: &str, is_final: bool) -> FrameKind {
        FrameKind::Transcription(TranscriptionFrame {
            text: text.into(),
            is_final,
        })
    }

    #[test]
    fn one_word_is_enough_while_the_bot_is_silent() {
        let mut s = MinWordsUserTurnStartStrategy::new(3);
        assert!(s.observe(&transcript("hi", false)));
    }

    #[test]
    fn a_backchannel_does_not_interrupt_the_bot() {
        let mut s = MinWordsUserTurnStartStrategy::new(3);
        s.bot_speaking = true;
        assert!(
            !s.observe(&transcript("mm-hmm", false)),
            "one word must not clear a 3-word bar"
        );
    }

    #[test]
    fn enough_words_do_interrupt_the_bot() {
        let mut s = MinWordsUserTurnStartStrategy::new(3);
        s.bot_speaking = true;
        assert!(s.observe(&transcript("wait stop please", false)));
    }

    #[test]
    fn interim_transcripts_can_be_excluded() {
        let mut s = MinWordsUserTurnStartStrategy::new(3).use_interim(false);
        assert!(!s.observe(&transcript("hello there", false)));
        assert!(s.observe(&transcript("hello there", true)));
    }

    #[test]
    fn turn_started_clears_bot_speaking() {
        let mut s = MinWordsUserTurnStartStrategy::new(3);
        s.bot_speaking = true;
        s.turn_started();
        assert!(
            s.observe(&transcript("hi", false)),
            "back to the 1-word bar"
        );
    }
}
