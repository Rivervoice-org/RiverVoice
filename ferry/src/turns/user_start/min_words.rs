use crate::frames::frames::FrameKind;
use crate::turns::user_start::base::UserTurnStartStrategy;

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

        if !t.is_final && !self.use_interim {
            return false;
        }

        let required = if self.bot_speaking { self.min_words } else { 1 };
        t.text.split_whitespace().count() >= required
    }

    fn turn_started(&mut self) {
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
