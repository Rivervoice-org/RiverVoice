use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Serialize, ts_rs::TS)]
#[ts(export)]
pub struct ApiError {
    pub message: String,
}

/// The envelope every ferry route returns. Generic, so the generated
/// TypeScript is generic too and the client keeps its payload type.
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ApiResponse<T: ts_rs::TS> {
    pub status_code: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[ts(optional)]
    pub error: Option<ApiError>,
}

impl<T: Serialize + ts_rs::TS> ApiResponse<T> {
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

impl<T: Serialize + ts_rs::TS> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status =
            StatusCode::from_u16(self.status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
        (status, Json(self)).into_response()
    }
}
