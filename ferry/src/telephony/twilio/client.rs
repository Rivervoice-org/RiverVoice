use serde::Deserialize;

use crate::telephony::provider::{
    CallHandle, CallStatus, OutboundCall, ProviderError, TelephonyProvider,
};

#[derive(Debug, Clone)]
pub struct TwilioConfig {
    pub account_sid: String,
    pub phone_number: String,
    pub token: String,
}

impl TwilioConfig {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            account_sid: required("TWILIO_ACCOUNT_SID")?,
            phone_number: required("TWILIO_FROM_NUMBER")?,
            token: required("TWILIO_AUTH_TOKEN")?,
        })
    }
}

fn required(key: &str) -> Result<String, String> {
    std::env::var(key).map_err(|_| format!("missing env var {key}"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TwilioCallStatus {
    Queued,
    Ringing,
    InProgress,
    Completed,
    Busy,
    NoAnswer,
    Canceled,
    Failed,
}

impl From<TwilioCallStatus> for CallStatus {
    fn from(s: TwilioCallStatus) -> Self {
        match s {
            TwilioCallStatus::Queued => Self::Queued,
            TwilioCallStatus::Ringing => Self::Ringing,
            TwilioCallStatus::InProgress => Self::InProgress,
            TwilioCallStatus::Completed => Self::Completed,
            TwilioCallStatus::Busy => Self::Busy,
            TwilioCallStatus::NoAnswer => Self::NoAnswer,
            TwilioCallStatus::Canceled => Self::Canceled,
            TwilioCallStatus::Failed => Self::Failed,
        }
    }
}

#[derive(Debug, Deserialize)]
struct CallCreatedResponse {
    sid: String,
    status: TwilioCallStatus,
}

#[derive(Debug, Deserialize)]
struct TwilioErrorBody {
    code: Option<u32>,
    message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TwilioProvider {
    http: reqwest::Client,
    config: TwilioConfig,
}

impl TwilioProvider {
    pub fn new(config: TwilioConfig) -> Self {
        Self {
            http: reqwest::Client::new(),
            config,
        }
    }

    fn calls_url(&self) -> String {
        format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Calls.json",
            self.config.account_sid
        )
    }

    fn map_error(http_status: u16, body: &str) -> ProviderError {
        let parsed: Option<TwilioErrorBody> = serde_json::from_str(body).ok();
        let code = parsed.as_ref().and_then(|b| b.code);
        let message = parsed
            .and_then(|b| b.message)
            .unwrap_or_else(|| body.to_string());

        match (http_status, code) {
            (401, _) | (_, Some(20003)) => ProviderError::Unauthorized,
            (_, Some(21211 | 21212 | 21214 | 21219)) => ProviderError::InvalidNumber(message),
            (429, _) | (_, Some(20429)) => ProviderError::RateLimited,
            (500..=599, _) => ProviderError::Unavailable(message),
            _ => ProviderError::Other(match code {
                Some(c) => format!("{c}: {message}"),
                None => message,
            }),
        }
    }
}

impl TelephonyProvider for TwilioProvider {
    async fn create_call(&self, call: OutboundCall) -> Result<CallHandle, ProviderError> {
        let twiml = format!(
            r#"<Response><Connect><Stream url="{}"/></Connect></Response>"#,
            call.stream_url
        );

        let response = self
            .http
            .post(self.calls_url())
            .basic_auth(&self.config.account_sid, Some(&self.config.token))
            .form(&[
                ("To", call.to.as_str()),
                ("From", self.config.phone_number.as_str()),
                ("Twiml", twiml.as_str()),
                ("StatusCallback", call.status_url.as_str()),
                ("StatusCallbackEvent", "initiated"),
                ("StatusCallbackEvent", "ringing"),
                ("StatusCallbackEvent", "answered"),
                ("StatusCallbackEvent", "completed"),
            ])
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable(e.to_string()))?;

        let http_status = response.status().as_u16();
        let body = response
            .text()
            .await
            .map_err(|e| ProviderError::Unavailable(e.to_string()))?;

        if !(200..300).contains(&http_status) {
            return Err(Self::map_error(http_status, &body));
        }

        let created: CallCreatedResponse = serde_json::from_str(&body)
            .map_err(|e| ProviderError::Other(format!("unparsable response: {e}: {body}")))?;

        Ok(CallHandle {
            id: created.sid,
            status: created.status.into(),
        })
    }

    fn parse_status(&self, raw: &str) -> Option<CallStatus> {
        let status: TwilioCallStatus =
            serde_json::from_value(serde_json::Value::String(raw.to_string())).ok()?;

        Some(status.into())
    }
}
