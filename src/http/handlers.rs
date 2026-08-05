use axum::{
    Form, Json,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    http::StatusCode,
    response::Response,
};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64_STANDARD};
use garde::{Report, Validate};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{http::types::ApiResponse, retry::CallPayload, state::AppState};

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
    status: String,
}

pub async fn dial(
    State(state): State<AppState>,
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

    let created = match state.twilio.create_call(&call_payload.phone_number).await {
        Ok(c) => c,
        Err(e) => {
            println!("twilio create_call failed: {e}");
            return Err(ApiResponse::error(StatusCode::BAD_GATEWAY, e));
        }
    };

    println!("call created: sid={} status={}", created.sid, created.status);

    Ok(ApiResponse::ok(
        StatusCode::OK,
        DialResponse {
            call: created.sid,
            status: created.status,
        },
    ))
}

/// Twilio connects here after the `<Stream>` TwiML; carries the call audio.
pub async fn audio_stream(ws: WebSocketUpgrade) -> Response {
    ws.on_upgrade(handle_audio_socket)
}

/// Rough loudness of a μ-law frame. In μ-law the magnitude bits are inverted,
/// so `!b & 0x7F` is small for silence and large for speech.
fn mulaw_level(frame: &[u8]) -> u32 {
    if frame.is_empty() {
        return 0;
    }

    let total: u32 = frame.iter().map(|b| u32::from(!b & 0x7F)).sum();

    total / frame.len() as u32
}

/// Runs for the lifetime of one call.
async fn handle_audio_socket(mut socket: WebSocket) {
    let mut chunks: u32 = 0;
    let mut bytes: usize = 0;

    while let Some(Ok(message)) = socket.recv().await {
        let Message::Text(text) = message else {
            continue;
        };

        let event: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(e) => {
                println!("ws: unparsable frame ({e}): {text}");
                continue;
            }
        };

        match event["event"].as_str() {
            Some("connected") => println!("ws: connected"),

            Some("start") => println!(
                "ws: start call_sid={} stream_sid={} format={}",
                event["start"]["callSid"], event["start"]["streamSid"], event["start"]["mediaFormat"]
            ),

            Some("media") => {
                let payload = event["media"]["payload"].as_str().unwrap_or_default();

                let frame = match BASE64_STANDARD.decode(payload) {
                    Ok(f) => f,
                    Err(e) => {
                        println!("ws: bad base64 ({e})");
                        continue;
                    }
                };

                chunks += 1;
                bytes += frame.len();

                // 50 frames/sec, so this prints roughly once a second.
                if chunks % 50 == 0 {
                    let level = mulaw_level(&frame);
                    let bar = "#".repeat((level / 4) as usize);

                    println!("ws: {chunks:>5} frames  {bytes:>7} bytes  |{bar:<32}| {level}");
                }
            }

            Some("stop") => {
                println!("ws: stop");
                break;
            }

            other => println!("ws: event {other:?}"),
        }
    }

    println!("ws: closed after {chunks} frames ({bytes} bytes, ~{}s)", chunks / 50);
}

/// Twilio's call-progress callbacks. Form-encoded, not JSON.
/// `CallStatus` is what feeds retry decisions: completed / busy / no-answer / failed.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct StatusCallback {
    pub call_sid: String,
    pub call_status: String,
    pub call_duration: Option<String>,
}

pub async fn twilio_status(Form(cb): Form<StatusCallback>) -> StatusCode {
    println!(
        "status: sid={} status={} duration={:?}",
        cb.call_sid, cb.call_status, cb.call_duration
    );

    StatusCode::NO_CONTENT
}
