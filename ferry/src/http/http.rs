use axum::{
    Router,
    http::{HeaderValue, Method, header},
    middleware,
    routing::{get, post},
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use super::handlers;
use crate::auth::middleware::require_session;

/// The browser talks to ferry cross-origin (web app on one port, ferry on
/// another) and sends the session cookie along (`credentials: "include"`
/// on `fetch`, automatic on the WebSocket handshake) — so this must name
/// the exact allowed origin and turn credentials on. A wildcard (`*`)
/// origin is rejected outright by the CORS spec once credentials are
/// allowed, and would defeat the point anyway. `POST` (WebRTC's SDP
/// offer/answer exchange) with a JSON body triggers a CORS preflight
/// (`OPTIONS`) that this must also answer, unlike the WS upgrade which
/// isn't preflighted at all.
fn cors_layer() -> CorsLayer {
    let origins: Vec<HeaderValue> = handlers::ALLOWED_ORIGINS
        .iter()
        .map(|origin| {
            origin
                .parse()
                .unwrap_or_else(|_| panic!("invalid ALLOWED_ORIGINS entry: {origin}"))
        })
        .collect();

    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET, Method::POST])
        .allow_headers([header::CONTENT_TYPE])
        .allow_credentials(true)
}

fn http_routes() -> Router {
    Router::new().route("/health", get(handlers::health))
}

/// Both ways a browser call can reach ferry: the WebSocket upgrade
/// (`GET /browser-call`) and WebRTC signaling (`POST /browser-call/webrtc`,
/// which only exchanges the SDP offer/answer — see
/// `handlers::browser_stream_webrtc`'s doc comment for why the actual
/// call runs on a separately spawned task, not this request).
fn call_routes() -> Router {
    Router::new()
        .route("/browser-call", get(handlers::browser_stream))
        .route(
            "/browser-call/webrtc",
            post(handlers::browser_stream_webrtc),
        )
        .route_layer(middleware::from_fn(require_session))
}

pub async fn start_server() -> anyhow::Result<()> {
    let router = http_routes()
        .merge(call_routes())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:8085").await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
