use axum::{Router, middleware, routing::get};

use super::handlers;
use crate::auth::middleware::require_session;

fn http_routes() -> Router {
    Router::new().route("/health", get(handlers::health))
}

fn ws_routes() -> Router {
    Router::new()
        .route("/browser-call", get(handlers::browser_stream))
        .route_layer(middleware::from_fn(require_session))
}

pub async fn start_server() -> Result<(), Box<dyn std::error::Error>> {
    let router = http_routes().merge(ws_routes());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
    println!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
