use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};

use crate::frames::frames::{Frame, FrameKind, MetricsFrame};
use crate::observer::observer::FrameObserver;

pub struct FrameIo {
    name: String,
    upstream: Receiver<Frame>,
    downstream: Sender<Frame>,

    observers: Arc<[Arc<dyn FrameObserver>]>,

    ttfb_start: Option<Instant>,
}

impl FrameIo {
    pub fn new(
        name: impl Into<String>,
        upstream: Receiver<Frame>,
        downstream: Sender<Frame>,
        observers: Arc<[Arc<dyn FrameObserver>]>,
    ) -> Self {
        Self {
            name: name.into(),
            upstream,
            downstream,
            observers,
            ttfb_start: None,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub async fn take(&mut self) -> Option<Frame> {
        let frame = self.upstream.recv().await;
        if let Some(frame) = &frame {
            for observer in self.observers.iter() {
                observer.on_take(&self.name, frame);
            }
        }
        frame
    }

    pub async fn push(&self, frame: Frame) -> bool {
        for observer in self.observers.iter() {
            observer.on_push(&self.name, &frame);
        }

        self.downstream.send(frame).await.is_ok()
    }

    pub fn start_ttfb_metrics(&mut self) {
        if self.ttfb_start.is_none() {
            self.ttfb_start = Some(Instant::now());
        }
    }

    pub async fn stop_ttfb_metrics(&mut self) -> bool {
        let start = match self.ttfb_start.take() {
            Some(start) => start,
            None => return true,
        };
        self.push(Frame::new(FrameKind::Metrics(MetricsFrame {
            stage: self.name.clone(),
            ttfb_ms: start.elapsed().as_millis() as u64,
        })))
        .await
    }

    pub fn cancel_ttfb_metrics(&mut self) {
        self.ttfb_start = None;
    }
}

#[async_trait]
pub trait FrameProcessor: Send {
    fn name(&self) -> &'static str;

    async fn run(self: Box<Self>, io: FrameIo);
}
