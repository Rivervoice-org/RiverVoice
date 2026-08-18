use std::time::Duration;

use tokio::time::Instant;

use crate::frames::frames::FrameKind;
use crate::turns::user_stop::base::UserTurnStopStrategy;

pub struct SpeechTimeoutUserTurnStopStrategy {
    timeout: Duration,
    deadline: Option<Instant>,
}

impl SpeechTimeoutUserTurnStopStrategy {
    pub fn new(timeout: Duration) -> Self {
        Self {
            timeout,
            deadline: None,
        }
    }

    fn touch(&mut self) {
        self.deadline = Some(Instant::now() + self.timeout);
    }
}

impl UserTurnStopStrategy for SpeechTimeoutUserTurnStopStrategy {
    fn name(&self) -> &'static str {
        "speech-timeout"
    }

    fn observe(&mut self, kind: &FrameKind) -> bool {
        if matches!(kind, FrameKind::Transcription(_)) {
            self.touch();
        }
        false
    }

    fn deadline(&self) -> Option<Instant> {
        self.deadline
    }

    fn timed_out(&mut self) -> bool {
        true
    }

    fn turn_started(&mut self) {
        self.touch();
    }

    fn turn_stopped(&mut self) {
        self.deadline = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn strategy() -> SpeechTimeoutUserTurnStopStrategy {
        SpeechTimeoutUserTurnStopStrategy::new(Duration::from_millis(500))
    }

    #[test]
    fn no_deadline_until_the_turn_starts() {
        let s = strategy();
        assert!(s.deadline().is_none());
    }

    #[test]
    fn turn_started_arms_the_deadline() {
        let mut s = strategy();
        s.turn_started();
        assert!(s.deadline().is_some());
    }

    #[test]
    fn a_transcript_never_finalizes_directly_but_pushes_the_deadline_back() {
        let mut s = strategy();
        s.turn_started();
        let first = s.deadline().expect("armed by turn_started");

        assert!(!s.observe(&FrameKind::Transcription(
            crate::frames::frames::TranscriptionFrame {
                text: "hello".into(),
                is_final: false,
            }
        )));
        assert!(s.deadline().expect("still armed") >= first);
    }

    #[test]
    fn raw_audio_does_not_push_the_deadline_back() {
        let mut s = strategy();
        s.turn_started();
        let armed = s.deadline().expect("armed by turn_started");

        assert!(
            !s.observe(&FrameKind::RawAudio(crate::frames::frames::RawAudioFrame {
                audio: Vec::new(),
                sample_rate: 16_000,
                num_channels: 1,
                num_frames: 0,
            }))
        );
        assert_eq!(s.deadline(), Some(armed), "unchanged, not pushed forward");
    }

    #[test]
    fn timed_out_says_the_turn_is_over() {
        let mut s = strategy();
        s.turn_started();
        assert!(s.timed_out());
    }

    #[test]
    fn turn_stopped_disarms_the_deadline() {
        let mut s = strategy();
        s.turn_started();
        s.turn_stopped();
        assert!(s.deadline().is_none());
    }
}
