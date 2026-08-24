use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::Response,
};
use futures_util::{SinkExt, StreamExt};

use crate::call::CallStatus;
use crate::codec::frame_serializer::FrameSerializer;
use crate::codec::transport::mobile_ws::{CALL_ENDED_TAG, CALL_RINGING_TAG, PEER_CONNECTED_TAG};
use crate::transport::base::BaseTransport;

pub struct WebSocketClient<S: FrameSerializer<Message = Message>> {
    base: BaseTransport<S>,
    /// Fires when the call's `CallRegistry` entry changes — e.g. Twilio
    /// answering/ringing/ending on the other leg — so this side can tell the
    /// client via a bare control byte instead of leaving it to infer status
    /// from the socket eventually closing. `None` for legs with no other
    /// side to watch (Twilio's own leg, the one-way try-agent demo).
    status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
}

enum Event {
    Incoming(Option<Result<Message, axum::Error>>),
    Outgoing(Option<Message>),
    /// The pacing timer ticked — see `BaseTransport::pace_interval`. Only
    /// ever fires when the serializer opted into pacing; otherwise this
    /// branch's `if` guard keeps it from being polled at all.
    Paced,
    /// `status_rx` changed. `Ok` carries the new status; `Err` means the
    /// sender was dropped (the registry entry is gone) without the call
    /// ever reaching `Ended` cleanly.
    StatusChanged(Result<(), ()>),
}

impl<S: FrameSerializer<Message = Message> + 'static> WebSocketClient<S> {
    pub fn new(base: BaseTransport<S>) -> Self {
        Self {
            base,
            status_rx: None,
        }
    }

    /// Like [`new`](Self::new), but also watches `status_rx` for the
    /// duration of the connection — see the field doc on `status_rx`.
    pub fn with_status(
        base: BaseTransport<S>,
        status_rx: Option<tokio::sync::watch::Receiver<CallStatus>>,
    ) -> Self {
        Self { base, status_rx }
    }

    pub fn connect(self, ws: WebSocketUpgrade) -> Response {
        ws.on_upgrade(move |socket| self.on_connect(socket))
    }

    /// `pub(crate)` (rather than private) so a caller that needs to run
    /// cleanup once this loop exits — e.g. tearing down the other leg of a
    /// bridged call — can drive it directly instead of via [`connect`](Self::connect),
    /// which has no hook for "after the loop ends".
    pub(crate) async fn on_connect(mut self, socket: WebSocket) {
        let (mut wire_out, mut wire_in) = socket.split();

        tracing::info!("ws: connected, entering read/write loop");

        // `next_pace_tick` stays `None` (and this whole branch never
        // polled, per its `if` guard below) for any serializer that
        // doesn't opt into pacing — zero behavior change for those.
        let pace_interval = self.base.pace_interval();
        let mut next_pace_tick = pace_interval.map(|d| tokio::time::Instant::now() + d);

        loop {
            let pace_deadline = next_pace_tick.unwrap_or_else(|| {
                tokio::time::Instant::now() + std::time::Duration::from_secs(3600)
            });

            let event = tokio::select! {
                msg = wire_in.next() => Event::Incoming(msg),
                msg = self.base.next_wire_message() => Event::Outgoing(msg),
                _ = tokio::time::sleep_until(pace_deadline), if pace_interval.is_some() => Event::Paced,
                changed = async {
                    self.status_rx.as_mut().unwrap().changed().await
                }, if self.status_rx.is_some() => Event::StatusChanged(changed.map_err(|_| ())),
            };

            match event {
                Event::Incoming(Some(Ok(msg))) => {
                    if !self.base.push_wire_message(msg).await {
                        tracing::info!("ws: loop exiting, pipeline gone");
                        break;
                    }
                }
                // The peer closing the connection (None) or a protocol error
                // (Err) both mean there is nothing left to read — previously
                // fell through to a no-op catch-all, so the loop kept
                // re-polling an already-ended stream forever instead of
                // exiting and running the caller's post-loop cleanup.
                Event::Incoming(Some(Err(e))) => {
                    tracing::warn!("ws: incoming message error, closing: {e}");
                    break;
                }
                Event::Incoming(None) => {
                    tracing::info!("ws: peer closed the connection");
                    break;
                }

                Event::Outgoing(Some(msg)) => {
                    if wire_out.send(msg).await.is_err() {
                        tracing::warn!("ws: failed to send wire message");
                        break;
                    }
                }
                // The pipeline itself ended (its `FrameIo` closed) — same
                // reasoning as above, nothing left to produce more outgoing
                // messages, so the loop should stop instead of spinning.
                Event::Outgoing(None) => {
                    tracing::info!("ws: pipeline closed, ending ws loop");
                    break;
                }

                Event::Paced => {
                    // Guaranteed `Some` — this branch only ever fires when
                    // `pace_interval` was `Some` to begin with.
                    next_pace_tick = Some(tokio::time::Instant::now() + pace_interval.unwrap());
                    if let Some(msg) = self.base.drain_paced()
                        && wire_out.send(msg).await.is_err()
                    {
                        tracing::warn!("ws: failed to send paced wire message");
                        break;
                    }
                }

                // `sender` dropped without the call ever reaching `Ended`
                // cleanly — nothing more to watch, but not itself a reason
                // to hang up (the other branches still govern that).
                Event::StatusChanged(Err(())) => {}

                Event::StatusChanged(Ok(())) => {
                    // Copied out (`CallStatus` is `Copy`) so the borrow on
                    // `status_rx` drops before the `.await` below.
                    let status = *self.status_rx.as_ref().unwrap().borrow();
                    let tag = match status {
                        CallStatus::Ended(_) => Some(CALL_ENDED_TAG),
                        CallStatus::Connected => Some(PEER_CONNECTED_TAG),
                        CallStatus::Ringing => Some(CALL_RINGING_TAG),
                        CallStatus::Dialing => None,
                    };
                    if let Some(tag) = tag {
                        // Best-effort — if the call is ending either way,
                        // the client's own socket-close detection is the
                        // fallback for a failed send.
                        let _ = wire_out.send(Message::Binary(vec![tag].into())).await;
                    }
                    if matches!(status, CallStatus::Ended(_)) {
                        tracing::info!("ws: call ended (other leg), hanging up");
                        break;
                    }
                }
            }
        }

        tracing::info!("ws: on_connect finished");
    }
}
