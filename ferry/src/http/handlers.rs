use crate::audio::rnnoise::RnnoiseFilter;
use crate::http::response::ApiResponse;
use crate::pipeline::pipeline::Pipeline;
use crate::serializer::transport::browser::BrowserSerializer;
use crate::stages::denoiser::DenoiserStage;
use crate::transport::base::BaseTransport;
use crate::transport::websockets::transport::WebSocketClient;
use axum::{
    extract::ws::WebSocketUpgrade,
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};

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
        return ApiResponse::<()>::fail(StatusCode::FORBIDDEN, "Origin not allowed")
            .into_response();
    }

    // Stages in order; the pipeline creates the channels between them,
    // spawns them, and returns the transport's two ends. The caller hears
    // their own voice back, denoised.
    let io = Pipeline::spawn(
        "browser",
        vec![Box::new(DenoiserStage::new(vec![Box::new(
            RnnoiseFilter::new(),
        )]))],
    );

    let serializer = BrowserSerializer::new(BROWSER_SAMPLE_RATE, BROWSER_NUM_CHANNELS);
    let base = BaseTransport::new(io, serializer);

    WebSocketClient::new(base).connect(ws)
}
