use std::sync::Arc;

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
use tracing::Instrument;

use super::handlers;
use super::state::AppState;
use crate::auth::middleware::require_user;
use crate::call::{CallRegistry, UserSessionRegistry};
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

// Plain CRUD on `agents`/`users`, and read-only access to `calls`, all went
// direct client-to-PostgREST (RLS-scoped to the caller) instead of routing
// through ferry — see docker-compose.yml's `rest`/`kong` services. What's
// left here is only what PostgREST's row-level API can't express (the
// join+aggregate in get_recent_agents) or that needs real server-side
// orchestration (starting a call, the try-agent demo, TTS preview).
fn protected_call_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/try-agent/offer", post(handlers::try_agent_offer))
        .route("/v1/call/start", post(handlers::start_call))
        .route_layer(middleware::from_fn(require_user))
}

fn twilio_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/twilio/ws/{call_id}", get(handlers::twilio_ws))
        .route("/v1/twilio/status/{call_id}", post(handlers::twilio_status))
}

fn agent_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/agents/recent", get(handlers::get_recent_agents))
        .route_layer(middleware::from_fn(require_user))
}

fn credits_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/credits/history", get(handlers::get_credit_history))
        .route_layer(middleware::from_fn(require_user))
}

fn voice_routes() -> Router<AppState> {
    Router::new()
        .route("/v1/voices/preview", post(handlers::preview_voice))
        .route_layer(middleware::from_fn(require_user))
}

pub async fn start_server() -> anyhow::Result<()> {
    let config = config::get().map_err(|e| anyhow::anyhow!("{e}"))?;

    let app_state = AppState {
        call_registry: CallRegistry::new(),
        user_sessions: UserSessionRegistry::new(),
        twilio: Arc::new(TwilioClient::new(
            config.twilio_account_sid.clone(),
            config.twilio_auth_token.clone(),
        )),
    };

    let router = http_routes()
        .merge(protected_call_routes())
        .merge(twilio_routes())
        .merge(agent_routes())
        .merge(voice_routes())
        .merge(credits_routes())
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(log_request))
        .layer(cors_layer())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8085").await?;
    tracing::info!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
