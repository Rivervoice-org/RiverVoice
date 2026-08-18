use std::sync::Mutex;

use crate::frames::frames::{Frame, FrameKind, MtUsageFrame, SttUsageFrame, TtsUsageFrame};
use crate::observer::observer::FrameObserver;

pub struct UsageObserver {
    stt: Mutex<SttUsageFrame>,
    mt: Mutex<MtUsageFrame>,
    tts: Mutex<TtsUsageFrame>,
}

impl UsageObserver {
    pub fn new() -> Self {
        Self {
            stt: Mutex::new(SttUsageFrame::default()),
            mt: Mutex::new(MtUsageFrame::default()),
            tts: Mutex::new(TtsUsageFrame::default()),
        }
    }

    pub fn stt_usage(&self) -> SttUsageFrame {
        *self.stt.lock().unwrap()
    }

    pub fn mt_usage(&self) -> MtUsageFrame {
        *self.mt.lock().unwrap()
    }

    pub fn tts_usage(&self) -> TtsUsageFrame {
        *self.tts.lock().unwrap()
    }
}

impl Default for UsageObserver {
    fn default() -> Self {
        Self::new()
    }
}

impl FrameObserver for UsageObserver {
    fn on_push(&self, stage: &str, frame: &Frame) {
        if let FrameKind::SttUsage(usage) = frame.kind()
            && stage == "stt"
        {
            let total = {
                let mut total = self.stt.lock().unwrap();
                total.audio_seconds += usage.audio_seconds;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "stt",
                audio_seconds = usage.audio_seconds,
                total_audio_seconds = total.audio_seconds,
                "stt_usage"
            );
        }

        if let FrameKind::MtUsage(usage) = frame.kind()
            && stage == "mt"
        {
            let total = {
                let mut total = self.mt.lock().unwrap();
                total.prompt_tokens += usage.prompt_tokens;
                total.completion_tokens += usage.completion_tokens;
                total.total_tokens += usage.total_tokens;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "mt",
                prompt_tokens = usage.prompt_tokens,
                completion_tokens = usage.completion_tokens,
                total_tokens = usage.total_tokens,
                total_prompt_tokens = total.prompt_tokens,
                total_completion_tokens = total.completion_tokens,
                "mt_usage"
            );
        }

        if let FrameKind::TtsUsage(usage) = frame.kind()
            && stage == "tts"
        {
            let total = {
                let mut total = self.tts.lock().unwrap();
                total.characters += usage.characters;
                *total
            };
            tracing::info!(
                target: "ferry::usage",
                stage = "tts",
                characters = usage.characters,
                total_characters = total.characters,
                "tts_usage"
            );
        }
    }
}
