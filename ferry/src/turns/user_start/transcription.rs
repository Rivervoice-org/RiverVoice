use crate::frames::frames::FrameKind;
use crate::turns::user_start::base::UserTurnStartStrategy;

/// Starts the turn as soon as any transcript arrives.
///
/// A backstop for VAD: a transcript is proof someone spoke, even when
/// they spoke too quietly for a VAD threshold to trip. Slower than VAD —
/// the audio had to reach STT and come back as text — so run both and
/// let whichever fires first win.
pub struct TranscriptionUserTurnStartStrategy;

impl UserTurnStartStrategy for TranscriptionUserTurnStartStrategy {
    fn name(&self) -> &'static str {
        "transcription"
    }

    fn observe(&mut self, kind: &FrameKind) -> bool {
        matches!(kind, FrameKind::Transcription(_))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::frames::frames::TranscriptionFrame;

    #[test]
    fn a_transcript_starts_the_turn() {
        let mut s = TranscriptionUserTurnStartStrategy;
        let frame = FrameKind::Transcription(TranscriptionFrame {
            text: "hello".into(),
            is_final: false,
        });
        assert!(s.observe(&frame));
    }

    #[test]
    fn interim_transcripts_count_too() {
        let mut s = TranscriptionUserTurnStartStrategy;
        let frame = FrameKind::Transcription(TranscriptionFrame {
            text: "hel".into(),
            is_final: false,
        });
        assert!(
            s.observe(&frame),
            "a partial transcript is still proof someone is speaking"
        );
    }

    #[test]
    fn audio_alone_does_not_start_the_turn() {
        let mut s = TranscriptionUserTurnStartStrategy;
        let frame = FrameKind::RawAudio(crate::frames::frames::RawAudioFrame {
            audio: Vec::new(),
            sample_rate: 16_000,
            num_channels: 1,
            num_frames: 0,
        });
        assert!(!s.observe(&frame));
    }
}
