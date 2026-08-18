use std::time::Duration;

pub trait VadAnalyzer: Send {
    fn name(&self) -> &'static str;

    fn num_frames_required(&self) -> usize;

    fn start(&mut self, sample_rate: u32);

    fn voice_confidence(&mut self, buffer: &[i16]) -> f32;
}

#[derive(Debug, Clone, Copy)]
pub struct VadParams {
    pub confidence: f32,

    pub start: Duration,

    pub stop: Duration,
}

impl Default for VadParams {
    fn default() -> Self {
        Self {
            confidence: 0.7,
            start: Duration::from_millis(200),
            stop: Duration::from_millis(200),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VadTransition {
    Speaking,
    Quiet,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum VadState {
    Quiet,
    Starting,
    Speaking,
    Stopping,
}

pub struct VadStateMachine {
    analyzer: Box<dyn VadAnalyzer>,
    params: VadParams,
    state: VadState,
    pending: Vec<i16>,

    start_frames: u32,
    stop_frames: u32,
    starting_count: u32,
    stopping_count: u32,
}

impl VadStateMachine {
    pub fn new(analyzer: Box<dyn VadAnalyzer>, params: VadParams) -> Self {
        Self {
            analyzer,
            params,
            state: VadState::Quiet,
            pending: Vec::new(),
            start_frames: 0,
            stop_frames: 0,
            starting_count: 0,
            stopping_count: 0,
        }
    }

    pub fn start(&mut self, sample_rate: u32) {
        self.analyzer.start(sample_rate);

        let frame_size = self.analyzer.num_frames_required().max(1);
        let frames_per_sec = sample_rate as f32 / frame_size as f32;

        self.start_frames =
            ((self.params.start.as_secs_f32() * frames_per_sec).round() as u32).max(1);
        self.stop_frames =
            ((self.params.stop.as_secs_f32() * frames_per_sec).round() as u32).max(1);

        self.state = VadState::Quiet;
        self.pending.clear();
        self.starting_count = 0;
        self.stopping_count = 0;
    }

    pub fn push(&mut self, samples: &[i16]) -> Option<VadTransition> {
        self.pending.extend_from_slice(samples);

        let frame_size = self.analyzer.num_frames_required();
        let mut confirmed = None;

        let mut consumed = 0;
        while self.pending.len() - consumed >= frame_size {
            let chunk = &self.pending[consumed..consumed + frame_size];
            let confidence = self.analyzer.voice_confidence(chunk);
            consumed += frame_size;

            let speaking = confidence >= self.params.confidence;
            if let Some(transition) = self.advance(speaking) {
                confirmed = Some(transition);
            }
        }
        self.pending.drain(..consumed);

        confirmed
    }

    fn advance(&mut self, speaking: bool) -> Option<VadTransition> {
        if speaking {
            match self.state {
                VadState::Quiet => {
                    self.state = VadState::Starting;
                    self.starting_count = 1;
                }
                VadState::Starting => self.starting_count += 1,
                VadState::Stopping => {
                    self.state = VadState::Speaking;
                    self.stopping_count = 0;
                }
                VadState::Speaking => {}
            }
        } else {
            match self.state {
                VadState::Starting => {
                    self.state = VadState::Quiet;
                    self.starting_count = 0;
                }
                VadState::Speaking => {
                    self.state = VadState::Stopping;
                    self.stopping_count = 1;
                }
                VadState::Stopping => self.stopping_count += 1,
                VadState::Quiet => {}
            }
        }

        if self.state == VadState::Starting && self.starting_count >= self.start_frames {
            self.state = VadState::Speaking;
            self.starting_count = 0;
            return Some(VadTransition::Speaking);
        }
        if self.state == VadState::Stopping && self.stopping_count >= self.stop_frames {
            self.state = VadState::Quiet;
            self.stopping_count = 0;
            return Some(VadTransition::Quiet);
        }
        None
    }
}
