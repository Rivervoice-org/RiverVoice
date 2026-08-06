use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;

#[derive(Serialize)]
pub struct ApiError {
    message: String,
}

fn serialize_status<S>(status: &StatusCode, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_u16(status.as_u16())
}

#[derive(Serialize)]
pub struct ApiResponse<T> {
    #[serde(serialize_with = "serialize_status")]
    status: StatusCode,
    data: Option<T>,
    error: Option<ApiError>,
}

impl<T: Serialize> IntoResponse for ApiResponse<T> {
    fn into_response(self) -> Response {
        let status = self.status;
        (status, Json(self)).into_response()
    }
}

impl<T> ApiResponse<T> {
    pub fn ok(status: StatusCode, data: T) -> Self {
        Self {
            status,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(status: StatusCode, message: String) -> Self {
        Self {
            status,
            data: None,
            error: Some(ApiError { message }),
        }
    }
}
