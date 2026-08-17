use axum::{http::StatusCode, response::IntoResponse};

pub async fn health() -> impl IntoResponse {
    (
        StatusCode::OK,
        axum::Json(serde_json::json!({ "status": "ok" })),
    )
}
