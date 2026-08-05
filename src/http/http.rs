use axum::{Json, Router, routing::post};
use serde_json::Value;

pub async fn start_server() -> Result<(), Box<dyn std::error::Error>> {
    let router = Router::new().route("/dial", post(do_somethign));

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
    println!("listening on http://{}", listener.local_addr()?);

    axum::serve(listener, router).await?;

    Ok(())
}

async fn do_somethign(Json(body) : Json<Value>) -> &'static str {
    let formatted_body = format!("{body}");
    println!("formatted body : {}", formatted_body);
    "ok"
}
