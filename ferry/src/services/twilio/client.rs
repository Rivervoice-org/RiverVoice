use std::time::Duration;

use serde::Deserialize;

/// `reqwest::Client` has no request timeout by default — without one, a
/// stalled Twilio response leaves the caller (e.g. `spawn_twilio_dial`)
/// hanging indefinitely, with no `Ok`/`Err` ever arriving to update the
/// call's status.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

/// Thin wrapper over Twilio's REST API for the two things ferry needs: fire
/// an outbound call (leg B) correlated to a `CallId` via the URLs we hand
/// Twilio, and force-hang-up that same call later via its Twilio-assigned
/// `CallSid` when leg A ends first.
pub struct TwilioClient {
    http: reqwest::Client,
    account_sid: String,
    auth_token: String,
}

#[derive(Debug)]
pub struct TwilioError(pub String);

impl std::fmt::Display for TwilioError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "twilio: {}", self.0)
    }
}

impl std::error::Error for TwilioError {}

pub struct CreateCallParams<'a> {
    pub to: &'a str,
    pub from: &'a str,
    /// wss:// URL Twilio should open a Media Streams WS connection to once
    /// the call is answered — carries the `CallId` so `/v1/twilio/ws/{id}`
    /// can find this call's registry entry.
    pub stream_url: String,
    /// https:// URL Twilio POSTs call-status events to (busy/no-answer/
    /// failed/completed/...) — carries the same `CallId`.
    pub status_callback_url: String,
}

#[derive(Deserialize)]
struct CallResource {
    sid: String,
}

impl TwilioClient {
    pub fn new(account_sid: String, auth_token: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("failed to build twilio http client");

        Self {
            http,
            account_sid,
            auth_token,
        }
    }

    /// Fires the outbound call and returns immediately with Twilio's
    /// `CallSid` — this is a "fire and forget" dial. Whether it's answered,
    /// busy, or fails arrives later as a separate POST to `status_callback_url`,
    /// not from this call.
    pub async fn create_call(&self, params: CreateCallParams<'_>) -> Result<String, TwilioError> {
        let twiml = format!(
            "<Response><Connect><Stream url=\"{}\"/></Connect></Response>",
            xml_escape(&params.stream_url)
        );

        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Calls.json",
            self.account_sid
        );

        let form: [(&str, &str); 6] = [
            ("To", params.to),
            ("From", params.from),
            ("Twiml", &twiml),
            ("StatusCallback", &params.status_callback_url),
            ("StatusCallbackMethod", "POST"),
            (
                "StatusCallbackEvent",
                "initiated ringing answered completed",
            ),
        ];

        let resp = self
            .http
            .post(url)
            .basic_auth(&self.account_sid, Some(&self.auth_token))
            .form(&form)
            .send()
            .await
            .map_err(|e| TwilioError(format!("create_call request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(TwilioError(format!("create_call failed: {status}: {body}")));
        }

        let call: CallResource = resp
            .json()
            .await
            .map_err(|e| TwilioError(format!("create_call: bad response: {e}")))?;

        Ok(call.sid)
    }

    /// Ends a call in progress — used to propagate a hangup from leg A (the
    /// WebRTC side) onto leg B (the PSTN side), since closing the Twilio
    /// media-stream WS alone does not end the underlying phone call.
    pub async fn hangup_call(&self, call_sid: &str) -> Result<(), TwilioError> {
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Calls/{}.json",
            self.account_sid, call_sid
        );

        let resp = self
            .http
            .post(url)
            .basic_auth(&self.account_sid, Some(&self.auth_token))
            .form(&[("Status", "completed")])
            .send()
            .await
            .map_err(|e| TwilioError(format!("hangup_call request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(TwilioError(format!("hangup_call failed: {status}: {body}")));
        }

        Ok(())
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
