use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use ferry::audio::rnnoise::RnnoiseFilter;
use ferry::frames::frames::{Frame, FrameKind, RawAudioFrame};
use ferry::pipeline::pipeline::Pipeline;
use ferry::processor::processor::{FrameIo, FrameProcessor};
use ferry::services::stt::deepgram::DeepgramSttConfig;
use ferry::services::stt::language::Language;
use ferry::services::stt::provider::{
    SttConfig, SttConfigKind, SttError, SttEvent, SttProvider, SttSession, Transcript,
};
use ferry::stages::denoiser::DenoiserStage;
use ferry::stages::stt::SttStage;
use ferry::stages::user_aggregator::UserAggregatorStage;
use ferry::turns::controller::TurnController;
use ferry::turns::strategy::TurnStrategy;
use ferry::turns::user_start::MinWordsUserTurnStartStrategy;
use tokio::sync::mpsc::{self, Receiver};

const SAMPLE_RATE: u32 = 16_000;
const CHUNK_BYTES: usize = 320; // 160 samples, 10ms at 16 kHz
const AUDIO_CHUNKS: usize = 5;

#[tokio::main]
async fn main() {
    vendor_only().await;
    system_strategy_only().await;
    custom_model().await;
    vendor_plus_system().await;
}

async fn vendor_only() {
    run_case(
        "vendor-only: the STT provider announces UserStartedSpeaking itself, no local strategy configured",
        TurnController::new(None, Duration::from_secs(5)),
        FakeSttProvider::new(
            "fake-deepgram-vad",
            None,
            vec![
                ScriptEvent::UserStartedSpeaking,
                ScriptEvent::Transcript { text: "hello there".into(), is_final: true },
                ScriptEvent::UserStoppedSpeaking,
            ],
        ),
    )
    .await;
}

async fn system_strategy_only() {
    run_case(
        "system strategy only: the STT provider never announces a boundary itself, TranscriptionUserTurnStartStrategy catches the transcript",
        TurnController::new(None, Duration::from_secs(5)).with_default_start_strategies(),
        FakeSttProvider::new(
            "fake-transcribe-only",
            None,
            vec![ScriptEvent::Transcript { text: "hi".into(), is_final: true }],
        ),
    )
    .await;
}

async fn custom_model() {
    println!(
        "\nnote: MinWordsUserTurnStartStrategy's 3-word bar only applies while the bot is speaking; \
         ferry has no bot-speaking signal yet, so this behaves like a 1-word bar today"
    );

    run_case(
        "custom model: MinWordsUserTurnStartStrategy(3) instead of the default TranscriptionUserTurnStartStrategy",
        TurnController::new(None, Duration::from_secs(5))
            .with_start_strategy(Box::new(MinWordsUserTurnStartStrategy::new(3))),
        FakeSttProvider::new(
            "fake-transcribe-only",
            None,
            vec![ScriptEvent::Transcript { text: "hi".into(), is_final: true }],
        ),
    )
    .await;
}

async fn vendor_plus_system() {
    run_case(
        "vendor + system together: the vendor's UserStartedSpeaking wins the race, the local strategy never gets asked",
        TurnController::new(None, Duration::from_secs(5)).with_default_start_strategies(),
        FakeSttProvider::new(
            "fake-deepgram-vad",
            None,
            vec![
                ScriptEvent::UserStartedSpeaking,
                ScriptEvent::Transcript { text: "hello".into(), is_final: true },
            ],
        ),
    )
    .await;
}

/// The real chain: browser audio in, denoised, handed to STT, turn
/// state and interruptions come out. Swap `FakeSttProvider` for
/// `ferry::services::stt::deepgram::DeepgramSttProvider::new(api_key)`
/// to run this against real Deepgram instead.
async fn run_case(name: &str, controller: TurnController, provider: FakeSttProvider) {
    println!("\n== {name} ==");

    let config = SttConfig::new(
        SAMPLE_RATE,
        vec![Language::En],
        SttConfigKind::DeepgramSttConfig(DeepgramSttConfig::default()),
    );

    let stages: Vec<Box<dyn FrameProcessor>> = vec![
        Box::new(DenoiserStage::new(vec![Box::new(RnnoiseFilter::new())])),
        Box::new(SttStage::new(Box::new(provider), config)),
        Box::new(UserAggregatorStage::new(controller)),
    ];

    let mut io = Pipeline::spawn("example", stages);

    println!("-> push {AUDIO_CHUNKS} chunks of silent \"browser\" audio");
    for _ in 0..AUDIO_CHUNKS {
        io.push(Frame::new(FrameKind::RawAudio(RawAudioFrame {
            audio: vec![0u8; CHUNK_BYTES],
            sample_rate: SAMPLE_RATE,
            num_channels: 1,
            num_frames: (CHUNK_BYTES / 2) as u32,
        })))
        .await;
    }

    for frame in drain(&mut io).await {
        println!("<- {}", frame.get_name());
    }
}

async fn drain(io: &mut FrameIo) -> Vec<Frame> {
    let mut frames = Vec::new();
    while let Ok(Some(frame)) = tokio::time::timeout(Duration::from_millis(200), io.take()).await {
        frames.push(frame);
    }
    frames
}

/// A scripted stand-in for a real STT vendor connection — no network,
/// no API key, deterministic. Fires each event on its own short delay
/// after the session opens, independent of the audio it's fed (a real
/// provider would trigger on the audio; this one doesn't need to).
#[derive(Clone)]
enum ScriptEvent {
    UserStartedSpeaking,
    UserStoppedSpeaking,
    Transcript { text: String, is_final: bool },
}

struct FakeSttProvider {
    name: &'static str,
    recommended_turn_strategy: Option<TurnStrategy>,
    script: Vec<ScriptEvent>,
}

impl FakeSttProvider {
    fn new(
        name: &'static str,
        recommended_turn_strategy: Option<TurnStrategy>,
        script: Vec<ScriptEvent>,
    ) -> Self {
        Self {
            name,
            recommended_turn_strategy,
            script,
        }
    }
}

impl SttProvider for FakeSttProvider {
    fn name(&self) -> &'static str {
        self.name
    }

    fn recommended_turn_strategy(&self) -> Option<TurnStrategy> {
        self.recommended_turn_strategy
    }

    fn open(
        &self,
        _config: SttConfig,
    ) -> Pin<
        Box<
            dyn Future<Output = Result<(Box<dyn SttSession>, Receiver<SttEvent>), SttError>> + Send,
        >,
    > {
        let script = self.script.clone();
        Box::pin(async move {
            let (tx, rx) = mpsc::channel(8);
            tokio::spawn(async move {
                for event in script {
                    tokio::time::sleep(Duration::from_millis(20)).await;
                    let sent = match event {
                        ScriptEvent::UserStartedSpeaking => {
                            tx.send(SttEvent::UserStartedSpeaking).await
                        }
                        ScriptEvent::UserStoppedSpeaking => {
                            tx.send(SttEvent::UserStoppedSpeaking).await
                        }
                        ScriptEvent::Transcript { text, is_final } => {
                            tx.send(SttEvent::Transcript(Transcript {
                                text,
                                language: None,
                                is_final,
                            }))
                            .await
                        }
                    };
                    if sent.is_err() {
                        break;
                    }
                }
            });
            Ok((Box::new(FakeSttSession) as Box<dyn SttSession>, rx))
        })
    }
}

struct FakeSttSession;

impl SttSession for FakeSttSession {
    fn send_audio(
        &mut self,
        _pcm: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<(), SttError>> + Send + '_>> {
        Box::pin(async { Ok(()) })
    }

    fn close(self: Box<Self>) -> Pin<Box<dyn Future<Output = ()> + Send>> {
        Box::pin(async {})
    }
}
