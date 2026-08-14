use async_trait::async_trait;
use tokio::sync::mpsc::Receiver;

use crate::frames::frames::{Frame, FrameKind, LlmTextFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::services::llm::provider::{LlmEvent, LlmGeneration, LlmMessage, LlmProvider};

/// Turns an [`LlmProvider`] into a pipeline stage: a
/// [`FrameKind::UserTurnAggregation`] arriving from upstream (built by
/// [`UserAggregatorStage`](crate::stages::user_aggregator::UserAggregatorStage))
/// starts a generation, whose streamed reply comes out downstream as
/// [`FrameKind::LlmResponseStart`]/[`FrameKind::LlmText`]/[`FrameKind::LlmResponseEnd`].
/// Every other frame passes through untouched, except
/// [`FrameKind::Interruption`], which additionally cancels an in-flight
/// generation.
///
/// Unlike Pipecat, there's no separate context-aggregator stage: this
/// stage is the only thing that ever reads or appends to `history`, so a
/// shared mutable context object between stages would only add a layer
/// around a single owner. If a second stage ever needs the same
/// conversation history, that's the point to factor it out — not before.
pub struct LlmStage {
    provider: Box<dyn LlmProvider>,
    history: Vec<LlmMessage>,
}

impl LlmStage {
    pub fn new(provider: Box<dyn LlmProvider>, system_prompt: Option<String>) -> Self {
        let history = match system_prompt {
            Some(prompt) => vec![LlmMessage::system(prompt)],
            None => Vec::new(),
        };
        Self { provider, history }
    }
}

#[async_trait]
impl FrameProcessor for LlmStage {
    fn name(&self) -> &'static str {
        "llm"
    }

    async fn run(mut self: Box<Self>, mut io: FrameIo) {
        // `Some` only while a generation is actually streaming; most of
        // this stage's life has nothing to race `io.take()` against.
        let mut generation: Option<Box<dyn LlmGeneration>> = None;
        let mut events: Option<Receiver<LlmEvent>> = None;
        let mut response = String::new();

        loop {
            enum Next {
                Upstream(Option<Frame>),
                Event(Option<LlmEvent>),
            }

            let next = match &mut events {
                Some(rx) => tokio::select! {
                    frame = io.take() => Next::Upstream(frame),
                    event = rx.recv() => Next::Event(event),
                },
                None => Next::Upstream(io.take().await),
            };

            match next {
                Next::Upstream(None) => break, // upstream closed: run ends, dropping `io`
                Next::Upstream(Some(frame)) => match frame.into_kind() {
                    FrameKind::Interruption => {
                        if let Some(generation) = generation.take() {
                            generation.cancel();
                        }
                        events = None;
                        response.clear();
                        io.cancel_ttfb_metrics();
                        if !io.push(Frame::new(FrameKind::Interruption)).await {
                            break;
                        }
                    }
                    FrameKind::UserTurnAggregation(agg) => {
                        // Normally redundant with the `Interruption` arm
                        // above, which always precedes a new turn — kept
                        // here so a still-streaming generation is never
                        // silently overwritten (and left running,
                        // ungoverned) if that ordering invariant doesn't
                        // hold for some reason.
                        if let Some(generation) = generation.take() {
                            generation.cancel();
                        }
                        events = None;
                        self.history.push(LlmMessage::user(agg.text));
                        // Started before the request, not after — the
                        // network round-trip lives inside
                        // `provider.stream()`'s own `await` (its POST,
                        // e.g. `openrouter.rs`'s `.send().await`), so
                        // starting the clock only once that returns would
                        // measure just the leftover channel handoff, not
                        // the real TTFB. Mirrors pipecat's own LLM
                        // services (e.g. `anthropic/llm.py`:
                        // `start_ttfb_metrics()` precedes
                        // `_create_message_stream(...)`, not the reverse).
                        io.start_ttfb_metrics();
                        // Awaited inline, same as `SttStage` awaiting
                        // `provider.open()` before its loop starts: an
                        // interruption arriving during this specific
                        // window won't be seen until it returns. Not
                        // addressed here — it would mean spawning a task
                        // per turn, which nothing has asked for yet.
                        match self.provider.stream(self.history.clone()).await {
                            Ok((new_generation, new_events)) => {
                                response.clear();
                                generation = Some(new_generation);
                                events = Some(new_events);
                                if !io.push(Frame::new(FrameKind::LlmResponseStart)).await {
                                    break;
                                }
                            }
                            Err(e) => {
                                io.cancel_ttfb_metrics();
                                tracing::error!("llm: failed to start generation: {e}");
                            }
                        }
                    }
                    other => {
                        if !io.push(Frame::new(other)).await {
                            break;
                        }
                    }
                },
                Next::Event(None) => {
                    // Channel closed: the generation is done, successfully
                    // or otherwise. Only a reply that actually produced
                    // text joins the conversation — a generation that
                    // errored out immediately, or was cancelled before
                    // any text arrived, has nothing worth remembering.
                    generation = None;
                    events = None;
                    // A no-op if `TextDelta` already stopped it. Guards
                    // the case that never fires it at all — a generation
                    // that closes with zero text — so a still-running
                    // clock doesn't leak into whichever turn's first
                    // token arrives next.
                    io.cancel_ttfb_metrics();
                    if !response.is_empty() {
                        self.history
                            .push(LlmMessage::assistant(std::mem::take(&mut response)));
                    }
                    if !io.push(Frame::new(FrameKind::LlmResponseEnd)).await {
                        break;
                    }
                }
                Next::Event(Some(LlmEvent::TextDelta(delta))) => {
                    if !io.stop_ttfb_metrics().await {
                        break;
                    }
                    response.push_str(&delta);
                    if !io
                        .push(Frame::new(FrameKind::LlmText(LlmTextFrame { text: delta })))
                        .await
                    {
                        break;
                    }
                }
            }
        }

        if let Some(generation) = generation {
            generation.cancel();
        }
    }
}
