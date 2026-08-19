use async_trait::async_trait;

use crate::frames::frames::{Frame, FrameKind};
use crate::processor::processor::{FrameIo, FrameProcessor};
use crate::services::mt::provider::MtProvider;

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

    async fn run(self: Box<Self>, mut io: FrameIo) {
        loop {
            let Some(frame) = io.take().await else {
                tracing::info!("MT stage: upstream closed");
                break;
            };

            let frame_name = frame.get_name();
            let text = match frame.into_kind() {
                FrameKind::UserTurnAggregation(t) => t.text,
                _other => {
                    tracing::warn!("MT stage: ignoring frame {}", frame_name);
                    continue;
                }
            };

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
                }
                Err(e) => {
                    tracing::error!(error = %e, "MT provider request failed");
                    io.stop_ttfb_metrics().await;
                }
            }
        }
    }
}
