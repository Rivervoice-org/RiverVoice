use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use futures_util::{SinkExt, StreamExt};

use crate::serializer::serializer::FrameSerializer;
use crate::transport::base::BaseTransport;

pub struct WebSocketClient<S: FrameSerializer<Message = Message>> {
    base: BaseTransport<S>,
}

enum Event {
    Incoming(Option<Result<Message, axum::Error>>),
    Outgoing(Option<Message>),
}

impl<S: FrameSerializer<Message = Message> + 'static> WebSocketClient<S> {
    pub fn new(base: BaseTransport<S>) -> Self {
        Self { base }
    }

    pub fn connect(self, ws: WebSocketUpgrade) -> Response {
        ws.on_upgrade(move |socket| self.on_connect(socket))
    }

    async fn on_connect(mut self, socket: WebSocket) {
        let (mut wire_out, mut wire_in) = socket.split();

        tracing::info!("ws: connected, entering read/write loop");

        loop {
            let event = tokio::select! {
                msg = wire_in.next() => Event::Incoming(msg),
                msg = self.base.next_wire_message() => Event::Outgoing(msg),
            };

            match event {
                Event::Incoming(Some(Ok(msg))) => {
                    if !self.base.push_wire_message(msg).await {
                        tracing::info!("ws: loop exiting, pipeline gone");
                        break;
                    }
                }

                Event::Outgoing(Some(msg)) => {
                    if wire_out.send(msg).await.is_err() {
                        tracing::warn!("ws: failed to send wire message");
                        break;
                    }
                }
                _ => {}
            }
        }

        tracing::info!("ws: on_connect finished");
    }
}
