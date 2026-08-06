use axum::{
    Router,
    routing::{get, post},
};

use super::handlers;
use crate::state::AppState;

pub async fn start_server() -> Result<(), Box<dyn std::error::Error>> {
    let state = AppState::from_env()?;

    let router = Router::new()
        .route("/dial", post(handlers::dial))
        .route("/audioStream", get(handlers::audio_stream))
        .route("/twilio/status", post(handlers::twilio_status))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
    println!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
