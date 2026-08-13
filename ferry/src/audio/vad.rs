use std::time::Duration;

/// One VAD model's job: turn a fixed-size buffer of samples into a
/// confidence that it contains speech. Everything else, buffering,
/// thresholds, debouncing state, is generic and lives in
/// [`VadStateMachine`], the same split [`AudioFilter`](crate::audio::filters::AudioFilter)
/// uses between a model and its driver.
pub trait VadAnalyzer: Send {
    fn name(&self) -> &'static str;

    /// How many samples one call to `voice_confidence` needs, at
    /// whatever rate `start` was told. Silero, for example, wants
    /// exactly 512 samples at 16 kHz.
    fn num_frames_required(&self) -> usize;

    /// Told once, before any audio, what rate it will arrive at.
    fn start(&mut self, sample_rate: u32);

    /// Confidence, 0.0-1.0, that this buffer of exactly
    /// `num_frames_required()` samples contains speech.
    fn voice_confidence(&mut self, buffer: &[i16]) -> f32;
}

#[derive(Debug, Clone, Copy)]
pub struct VadParams {
    /// Confidence at/above which a frame counts as speech.
    pub confidence: f32,
    /// How long confidence must stay above the threshold before a
    /// tentative start is confirmed as real speech. Debounces a single
    /// spike (a cough, a click) from opening a turn.
    pub start: Duration,
    /// The same debounce on the way back down, so one quiet frame in the
    /// middle of a sentence doesn't end the turn early.
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

/// Only the two states a caller of [`VadStateMachine::push`] ever sees:
/// a confirmed transition either into or out of speech. The engine also
/// tracks two transitional states internally (rising toward speech,
/// falling toward quiet) but never reports them, they exist purely to
/// implement the debounce.
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

/// The buffering + threshold + debounce engine every VAD model shares,
/// driving whatever [`VadAnalyzer`] is plugged in. Buffers samples into
/// whatever fixed size the model wants, runs it on each whole frame, and
/// only reports a transition once it has held for long enough
/// (`VadParams::start`/`stop`) to not be a blip.
pub struct VadStateMachine {
    analyzer: Box<dyn VadAnalyzer>,
    params: VadParams,
    state: VadState,
    pending: Vec<i16>,
    /// How many consecutive speech/silence frames confirm a transition,
    /// derived from `params.start`/`params.stop` and the model's own
    /// frame size once `start` tells us the sample rate.
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

    /// Told once, before any audio, what rate it will arrive at. Works
    /// out how many model-frames make up `start`/`stop` at that rate,
    /// and starts from a clean slate.
    pub fn start(&mut self, sample_rate: u32) {
        self.analyzer.start(sample_rate);

        let frame_size = self.analyzer.num_frames_required().max(1);
        let frames_per_sec = sample_rate as f32 / frame_size as f32;
        // At least one frame: a debounce window of zero would confirm a
        // transition on the same frame that opened it, which defeats
        // the point of debouncing at all.
        self.start_frames =
            ((self.params.start.as_secs_f32() * frames_per_sec).round() as u32).max(1);
        self.stop_frames =
            ((self.params.stop.as_secs_f32() * frames_per_sec).round() as u32).max(1);

        self.state = VadState::Quiet;
        self.pending.clear();
        self.starting_count = 0;
        self.stopping_count = 0;
    }

    /// Feeds one chunk of audio through, running the model on every
    /// whole frame it completes. Returns the transition this chunk
    /// caused, if any; a chunk can complete several model-frames but at
    /// most one transition is reported, the most recent one (an earlier
    /// one in the same chunk is already stale by the time the caller
    /// sees it). If a single chunk both opens and closes a turn, the
    /// opening transition is silently dropped along with it. That
    /// requires a chunk at least as long as `start`/`stop`'s debounce
    /// window, which the small chunks this pipeline actually uses
    /// (~20-30ms against a ~200ms debounce) never approach, but a much
    /// larger chunk size or a much shorter debounce could hit it.
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
