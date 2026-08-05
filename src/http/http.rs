use axum::{Router, routing::post};

use super::handlers;

pub async fn start_server() -> Result<(), Box<dyn std::error::Error>> {
    let router = Router::new().route("/dial", post(handlers::dial));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
    println!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}
