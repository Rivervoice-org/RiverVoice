use axum::{
    Router,
    extract::Request,
    http::{HeaderValue, Method, header},
    middleware,
    middleware::Next,
    response::Response,
    routing::{get, post},
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

use super::handlers;
// use crate::auth::middleware::require_session;

const ALLOWED_ORIGINS: &[&str] = &["http://localhost:3000"];

fn cors_layer() -> CorsLayer {
    let origins: Vec<HeaderValue> = ALLOWED_ORIGINS
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

async fn log_request(req: Request, next: Next) -> Response {
    tracing::debug!(method = %req.method(), uri = %req.uri(), "started processing request");
    next.run(req).await
}

fn http_routes() -> Router {
    Router::new().route("/health", get(axum::Json("OK")))
}

fn call_routes() -> Router {
    Router::new()
        .route("/v1/webrtc/offer", post(handlers::webrtc_offer))
        .route("/v1/test/mt", get(handlers::test_mt))
    // .route_layer(middleware::from_fn(require_session))
}

// fn twilio_routes() -> Router {
//     Router::new()
//         .route(
//             "/v1/twilio/voice",
//             get(call::twilio_voice).post(call::twilio_voice),
//         )
//         .route("/v1/twilio/ws/{call_id}", get(call::twilio_ws))
// }

pub async fn start_server() -> anyhow::Result<()> {
    let router = http_routes()
        .merge(call_routes())
        // .merge(twilio_routes())
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(log_request))
        .layer(cors_layer());

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8085").await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
