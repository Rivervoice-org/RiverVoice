use axum::{
    extract::ws::{WebSocket, WebSocketUpgrade},
    http::HeaderMap,
    response::Response,
};

use crate::serializer::serializer::FrameSerializer;

pub struct WebSocketClient {
    serializer: Box<dyn FrameSerializer>,
}

impl WebSocketClient {
    pub fn new(serializer: Box<dyn FrameSerializer>) -> Self {
        Self { serializer }
    }
}

pub struct WebSocketConnectParams<'a> {
    ws: WebSocketUpgrade,
    headers: HeaderMap,
    allowed_origins: &'a [&'a str],
}

impl<'a> WebSocketConnectParams<'a> {
    pub fn new(ws: WebSocketUpgrade, headers: HeaderMap, allowed_origins: &'a [&'a str]) -> Self {
        Self {
            ws,
            headers,
            allowed_origins,
        }
    }
}

impl WebSocketClient {
    pub fn connect(params: WebSocketConnectParams) -> Result<Response, Box<dyn std::error::Error>> {
        let origin = params
            .headers
            .get(axum::http::header::ORIGIN)
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();

        if !params.allowed_origins.contains(&origin) {
            return Err("origin not allowed".into());
        }

        Ok(params.ws.on_upgrade(Self::on_connect))
    }

    pub async fn on_connect(_ws: WebSocket) {}
}
