use crate::frames::frames::FrameKind;
use crate::turns::user_stop::base::UserTurnStopStrategy;

pub struct ExternalUserTurnStopStrategy;

impl UserTurnStopStrategy for ExternalUserTurnStopStrategy {
    fn name(&self) -> &'static str {
        "external"
    }

    fn observe(&mut self, kind: &FrameKind) -> bool {
        matches!(kind, FrameKind::UserStoppedSpeaking)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frames::frames::{RawAudioFrame, TranscriptionFrame};

    #[test]
    fn user_stopped_speaking_ends_the_turn() {
        let mut s = ExternalUserTurnStopStrategy;
        assert!(s.observe(&FrameKind::UserStoppedSpeaking));
    }

    #[test]
    fn nothing_else_does() {
        let mut s = ExternalUserTurnStopStrategy;
        assert!(!s.observe(&FrameKind::UserStartedSpeaking));
        assert!(!s.observe(&FrameKind::Transcription(TranscriptionFrame {
            text: "hello".into(),
            is_final: true,
        })));
        assert!(!s.observe(&FrameKind::RawAudio(RawAudioFrame {
            audio: Vec::new(),
            sample_rate: 16_000,
            num_channels: 1,
            num_frames: 0,
        })));
    }
}
