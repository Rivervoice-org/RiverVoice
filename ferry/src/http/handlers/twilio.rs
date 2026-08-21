use axum::extract::{Form, Path, State, WebSocketUpgrade};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;

use crate::call::{CallId, CallStatus, EndReason, call_span};
use crate::codec::transport::telephony::twilio::TwilioSerializer;
use crate::http::response::ApiResponse;
use crate::http::state::AppState;
use crate::transport::base::BaseTransport;
use crate::transport::websockets::transport::WebSocketClient;
use tracing::Instrument;

pub async fn twilio_ws(
    Path(call_id): Path<String>,
    State(app): State<AppState>,
    ws: WebSocketUpgrade,
) -> Result<Response, ApiResponse<()>> {
    let call_id: CallId = call_id
        .parse()
        .map_err(|_| ApiResponse::fail(StatusCode::BAD_REQUEST, "malformed call id"))?;

    let handle = app
        .call_registry
        .get(&call_id)
        .ok_or_else(|| ApiResponse::fail(StatusCode::NOT_FOUND, "unknown call"))?;

    let b_io = handle.take_b_io().await.ok_or_else(|| {
        ApiResponse::fail(
            StatusCode::CONFLICT,
            "call already connected or already ended",
        )
    })?;

    handle.set_status(CallStatus::Connected);

    let base = BaseTransport::new(b_io, TwilioSerializer::new());
    let client = WebSocketClient::new(base);

    Ok(ws.on_upgrade(move |socket| {
        async move {
            client.on_connect(socket).await;
            // B's leg ended (Twilio closed the stream, callee hung up, ...) —
            // tear down A's leg too: A's WebRtcClient is watching this same
            // status and will hang up once it sees `Ended`.
            if !handle.is_ended() {
                handle.set_status(CallStatus::Ended(EndReason::HungUpByB));
            }
            app.call_registry.remove(&call_id);
        }
        .instrument(call_span(call_id, "b"))
    }))
}

/// Twilio's `CallStatus` values (see their Voice webhook reference). `Other`
/// catches anything not listed here — a status Twilio adds in the future, or
/// anything unexpected — so an unrecognized value degrades to a no-op
/// instead of failing `Form` extraction and rejecting the webhook outright.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TwilioCallStatus {
    Queued,
    Ringing,
    InProgress,
    Completed,
    Busy,
    Failed,
    NoAnswer,
    Canceled,
    #[serde(other)]
    Other,
}

#[derive(Deserialize)]
pub struct TwilioStatusCallback {
    #[serde(rename = "CallStatus")]
    pub call_status: TwilioCallStatus,
}

pub async fn twilio_status(
    Path(call_id): Path<String>,
    State(app): State<AppState>,
    Form(body): Form<TwilioStatusCallback>,
) -> impl IntoResponse {
    let Ok(call_id) = call_id.parse::<CallId>() else {
        return StatusCode::OK;
    };
    let Some(handle) = app.call_registry.get(&call_id) else {
        // Unknown/late/duplicate callback (call already torn down) — Twilio
        // just wants a 200, there's nothing left to update.
        return StatusCode::OK;
    };

    match body.call_status {
        TwilioCallStatus::Busy => handle.set_status(CallStatus::Ended(EndReason::Busy)),
        TwilioCallStatus::NoAnswer => handle.set_status(CallStatus::Ended(EndReason::NoAnswer)),
        TwilioCallStatus::Failed | TwilioCallStatus::Canceled => {
            handle.set_status(CallStatus::Ended(EndReason::Failed))
        }
        TwilioCallStatus::Ringing => handle.set_status(CallStatus::Ringing),
        TwilioCallStatus::InProgress => handle.set_status(CallStatus::Connected),
        TwilioCallStatus::Completed => {
            if !handle.is_ended() {
                handle.set_status(CallStatus::Ended(EndReason::HungUpByB));
            }
        }
        TwilioCallStatus::Queued | TwilioCallStatus::Other => {}
    }

    StatusCode::OK
}
