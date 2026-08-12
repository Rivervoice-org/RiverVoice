use axum::{
    extract::ws::WebSocketUpgrade,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use tokio::sync::mpsc;

use crate::frames::frames::Frame;
use crate::processor::processor::FrameIo;
use crate::serializer::browser::BrowserSerializer;
use crate::transport::base::BaseTransport;
use crate::transport::websockets::transport::WebSocketClient;

pub async fn health() -> StatusCode {
    StatusCode::OK
}

const ALLOWED_ORIGINS: &[&str] = &["http://localhost:3000"];

const BROWSER_SAMPLE_RATE: u32 = 16_000;
const BROWSER_NUM_CHANNELS: u16 = 1;

pub async fn browser_stream(ws: WebSocketUpgrade, header: HeaderMap) -> Response {
    let origin = header
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    if !ALLOWED_ORIGINS.contains(&origin) {
        return StatusCode::FORBIDDEN.into_response();
    }

    // No stages exist yet, so wire the transport back onto itself: frames
    // it pushes come straight back to it, echoing the caller's audio.
    // Once stages exist, this becomes: transport -> stage1 -> ... -> transport.
    let (tx, rx) = mpsc::channel::<Frame>(64);
    let io = FrameIo::new("browser", rx, tx);

    let serializer = BrowserSerializer::new(BROWSER_SAMPLE_RATE, BROWSER_NUM_CHANNELS);
    let base = BaseTransport::new(io, Box::new(serializer));

    WebSocketClient::new(base).connect(ws)
}
