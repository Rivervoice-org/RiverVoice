use axum::{Json, http::StatusCode};
use garde::{Report, Validate};
use serde::Serialize;
use serde_json::Value;

use crate::{http::types::ApiResponse, retry::CallPayload};

fn get_user_friendly_msg_from_garde(report: &Report) -> String {
    report
        .iter()
        .next()
        .map(|(path, error)| format!("{path}: {error}"))
        .unwrap_or_else(|| "validation failed".to_string())
}

#[derive(Debug, Serialize)]
pub struct DialResponse {
    call: String,
}

pub async fn dial(
    Json(body): Json<Value>,
) -> Result<ApiResponse<DialResponse>, ApiResponse<DialResponse>> {
    let call_payload: CallPayload = match serde_json::from_value(body) {
        Ok(p) => p,
        Err(e) => return Err(ApiResponse::error(StatusCode::BAD_REQUEST, e.to_string())),
    };

    if let Err(report) = call_payload.validate() {
        return Err(ApiResponse::error(
            StatusCode::UNPROCESSABLE_ENTITY,
            get_user_friendly_msg_from_garde(&report),
        ));
    }

    println!("dial payload: {call_payload:?}");

        



    Ok(ApiResponse::ok(
        StatusCode::OK,
        DialResponse {
            call: "queued".to_string(),
        },
    ))
}
