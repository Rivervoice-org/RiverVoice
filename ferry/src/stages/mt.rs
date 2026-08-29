use async_trait::async_trait;

use crate::frames::{Frame, FrameKind};
use crate::processor::{FrameIo, FrameProcessor};
use crate::services::mt::provider::MtProvider;
use crate::stages::stage::Stage;

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
    fn name(&self) -> Stage {
        Stage::Mt
    }

    async fn run(self: Box<Self>, mut io: FrameIo) {
        loop {
            let Some(frame) = io.take().await else {
                tracing::info!("MT stage: upstream closed");
                break;
            };

            let text = match frame.into_kind() {
                FrameKind::UserTurnAggregation(t) => t.text,
                other => {
                    if !io.push(Frame::new(other)).await {
                        tracing::info!("MT stage: downstream closed");
                        break;
                    }
                    continue;
                }
            };

            // MT responses aren't streamed, so this measures time to the full
            // response, not time to first byte — the metric name is just reused
            // from FrameIo's TTFB helper.
            io.start_ttfb_metrics();

            tracing::debug!("MT stage: sending text to provider: {}", text);
            match self.provider.send(&text).await {
                Ok((translated, usage)) => {
                    io.stop_ttfb_metrics().await;

                    tracing::debug!(
                        "MT stage: text translated successfully {}",
                        &translated.text
                    );
                    if !io.push(Frame::new(FrameKind::MtText(translated))).await {
                        tracing::info!("MT stage: downstream closed");
                        break;
                    }

                    if !io.push(Frame::new(FrameKind::MtUsage(usage))).await {
                        tracing::info!("MT stage: downstream closed");
                        break;
                    }

                    // Tells TtsStage to flush Sarvam's session — without this,
                    // Sarvam just buffers the text and only synthesizes audio
                    // once its own min_buffer_size threshold happens to be
                    // crossed, which short responses may never reach.
                    if !io.push(Frame::new(FrameKind::MtResponseEnd)).await {
                        tracing::info!("MT stage: downstream closed");
                        break;
                    }
                }
                Err(e) => {
                    tracing::error!(error = %e, "MT provider request failed");
                    io.stop_ttfb_metrics().await;
                }
            }
        }
    }
}
