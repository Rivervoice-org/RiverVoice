use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiError {
    pub message: String,
}

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    #[serde(rename = "statusCode")]
    pub status_code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(status: StatusCode, data: T) -> Self {
        Self {
            status_code: status.as_u16(),
            data: Some(data),
            error: None,
        }
    }

    pub fn fail(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status_code: status.as_u16(),
            data: None,
            error: Some(ApiError {
                message: message.into(),
            }),
        }
    }
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}
