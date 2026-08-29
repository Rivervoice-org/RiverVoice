use std::sync::Arc;

use axum::{
    Router,
    extract::Request,
    http::{HeaderValue, Method, header},
    middleware,
    middleware::Next,
    response::Response,
    routing::{get, patch, post},
};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing::Instrument;

use super::handlers;
use super::state::AppState;
use crate::auth::middleware::require_user;
use crate::call::CallRegistry;
use crate::config;
use crate::services::twilio::TwilioClient;

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
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true)
}

async fn log_request(req: Request, next: Next) -> Response {
    let req_id = uuid::Uuid::new_v4().simple().to_string()[..8].to_string();
    let span = tracing::info_span!("request", req_id = %req_id);
    async move {
        tracing::debug!(method = %req.method(), uri = %req.uri(), "started processing request");
        next.run(req).await
    }
    .instrument(span)
    .await
}

fn http_routes() -> Router<AppState> {
    Router::new().route("/health", get(axum::Json("OK")))
}

fn protected_call_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/try-agent/offer", post(handlers::webrtc_offer))
        .route("/v1/call/start", post(handlers::start_call))
        .route("/v1/calls", get(handlers::get_recent_calls))
        .route("/v1/calls/{id}", get(handlers::get_call_detail))
        .route_layer(middleware::from_fn(require_user))
}

fn twilio_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/twilio/ws/{call_id}", get(handlers::twilio_ws))
        .route("/v1/twilio/status/{call_id}", post(handlers::twilio_status))
}

fn protected_user_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/users/me", get(handlers::get_me))
        .route_layer(middleware::from_fn(require_user))
}

fn agent_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/v1/agents",
            post(handlers::create_agent).get(handlers::get_agents),
        )
        .route(
            "/v1/agents/{id}",
            patch(handlers::update_agent).delete(handlers::delete_agent),
        )
        .route_layer(middleware::from_fn(require_user))
}

fn voice_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/voices/preview", post(handlers::preview_voice))
        .route_layer(middleware::from_fn(require_user))
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/auth/google", post(handlers::google_sign_in))
        .route("/v1/auth/refresh", post(handlers::refresh))
        .route("/v1/auth/signout", post(handlers::sign_out))
}

pub async fn start_server() -> anyhow::Result<()> {
    let config = config::get().map_err(|e| anyhow::anyhow!("{e}"))?;

    let app_state = AppState {
        call_registry: CallRegistry::new(),
        twilio: Arc::new(TwilioClient::new(
            config.twilio_account_sid.clone(),
            config.twilio_auth_token.clone(),
        )),
    };

    let router = http_routes()
        .merge(protected_call_routes())
        .merge(twilio_routes())
        .merge(protected_user_routes())
        .merge(auth_routes())
        .merge(agent_routes())
        .merge(voice_routes())
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(log_request))
        .layer(cors_layer())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8085").await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
