use async_trait::async_trait;
use tokio::sync::mpsc::Receiver;

use crate::frames::frames::{Frame, FrameKind, MtTextFrame};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::services::mt::provider::{MtEvent, MtGeneration, MtProvider};

pub struct MtStage {
    provider: Box<dyn MtProvider>,
}

impl MtStage {
    pub fn new(provider: Box<dyn MtProvider>) -> Self {
        Self { provider }
    }
}

#[async_trait]
impl FrameProcessor for MtStage {
    fn name(&self) -> &'static str {
        "mt"
    }

    async fn run(mut self: Box<Self>, mut io: FrameIo) {
        let mut generation: Option<Box<dyn MtGeneration>> = None;
        let mut events: Option<Receiver<MtEvent>> = None;

        loop {
            enum Next {
                Upstream(Option<Frame>),
                Event(Option<MtEvent>),
            }

            // While a generation is streaming, leave the upstream channel
            // alone: a new turn (or any pass-through frame) waits there
            // instead of aborting the in-flight translation. When the
            // generation ends, we resume reading and start the next turn.
            // The channel is the queue — nothing to buffer here.
            let next = match &mut events {
                Some(rx) => tokio::select! {
                    event = rx.recv() => Next::Event(event),
                },
                None => Next::Upstream(io.take().await),
            };

            match next {
                Next::Upstream(None) => break,
                Next::Upstream(Some(frame)) => match frame.into_kind() {
                    FrameKind::UserTurnAggregation(agg) => {
                        if agg.text.trim().is_empty() {
                            continue;
                        }
                        io.start_ttfb_metrics();

                        match self.provider.stream(&agg.text).await {
                            Ok((new_generation, new_events)) => {
                                generation = Some(new_generation);
                                events = Some(new_events);
                                if !io.push(Frame::new(FrameKind::MtResponseStart)).await {
                                    break;
                                }
                            }
                            Err(e) => {
                                io.cancel_ttfb_metrics();
                                tracing::error!("mt: failed to start generation: {e}");
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
                    generation = None;
                    events = None;

                    io.cancel_ttfb_metrics();
                    if !io.push(Frame::new(FrameKind::MtResponseEnd)).await {
                        break;
                    }
                }
                Next::Event(Some(MtEvent::TextDelta(delta))) => {
                    if !io.stop_ttfb_metrics().await {
                        break;
                    }
                    if !io
                        .push(Frame::new(FrameKind::MtText(MtTextFrame { text: delta })))
                        .await
                    {
                        break;
                    }
                }
                Next::Event(Some(MtEvent::Usage(usage))) => {
                    if !io.push(Frame::new(FrameKind::MtUsage(usage))).await {
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
