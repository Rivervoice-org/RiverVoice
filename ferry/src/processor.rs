use std::sync::Arc;
use std::time::Instant;

use async_trait::async_trait;
use tokio::sync::mpsc::{Receiver, Sender};

use crate::frames::{Frame, FrameKind, MetricsFrame};
use crate::observer::frame_observer::FrameObserver;
use crate::stages::stage::Stage;

pub struct FrameIo {
    name: Stage,
    upstream: Receiver<Frame>,
    downstream: Sender<Frame>,

    observers: Arc<[Arc<dyn FrameObserver>]>,

    ttfb_start: Option<Instant>,
}

impl FrameIo {
    pub fn new(
        name: Stage,
        upstream: Receiver<Frame>,
        downstream: Sender<Frame>,
        observers: Arc<[Arc<dyn FrameObserver>]>,
    ) -> Self {
        Self {
            name,
            upstream,
            downstream,
            observers,
            ttfb_start: None,
        }
    }

    pub fn name(&self) -> Stage {
        self.name
    }

    pub async fn take(&mut self) -> Option<Frame> {
        let frame = self.upstream.recv().await;
        if let Some(frame) = &frame {
            for observer in self.observers.iter() {
                observer.on_take(self.name, frame);
            }
        }
        frame
    }

    pub async fn push(&self, frame: Frame) -> bool {
        for observer in self.observers.iter() {
            observer.on_push(self.name, &frame);
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
            stage: self.name,
            ttfb_ms: start.elapsed().as_millis() as u64,
        })))
        .await
    }

    pub fn cancel_ttfb_metrics(&mut self) {
        self.ttfb_start = None;
    }

    /// Breaks a pipeline's `FrameIo` into its raw halves — the entrance
    /// sender (push a frame in, it enters the first stage) and exit receiver
    /// (take a frame out, it left the last stage). Used to cross-wire two
    /// participants' pipelines: a transport's `FrameIo` is rebuilt from one
    /// call's exit `Receiver` and the *other* call's entrance `Sender`, so
    /// each side's translated speech comes out the other side's transport
    /// instead of looping back to itself.
    pub fn into_parts(self) -> (Receiver<Frame>, Sender<Frame>) {
        (self.upstream, self.downstream)
    }
}

#[async_trait]
pub trait FrameProcessor: Send {
    fn name(&self) -> Stage;

    async fn run(self: Box<Self>, io: FrameIo);
}
