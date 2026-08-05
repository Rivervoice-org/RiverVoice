use serde::{Deserialize, Serialize};

use crate::config::Config;

/// What Twilio returns from `POST /Calls.json`. The call has not happened yet —
/// `status` is `queued` and outcomes arrive later on the status webhook.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallCreated {
    pub sid: String,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct TwilioClient {
    /// `reqwest::Client` is internally reference-counted, so cloning is cheap
    /// and the connection pool is shared. Build it once.
    http: reqwest::Client,
    config: Config,
}

impl TwilioClient {
    pub fn new(config: Config) -> Self {
        Self {
            http: reqwest::Client::new(),
            config,
        }
    }

    /// Places an outbound call that streams its audio to `/audioStream`.
    ///
    /// The TwiML is sent inline, so Twilio never fetches a webhook for it.
    pub async fn create_call(&self, to: &str) -> Result<CallCreated, String> {
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Calls.json",
            self.config.twilio_account_sid
        );

        let twiml = format!(
            r#"<Response><Connect><Stream url="{}"/></Connect></Response>"#,
            self.config.audio_stream_url()
        );

        let status_callback = format!("{}/twilio/status", self.config.public_base_url);

        let response = self
            .http
            .post(url)
            .basic_auth(
                &self.config.twilio_account_sid,
                Some(&self.config.twilio_auth_token),
            )
            .form(&[
                ("To", to),
                ("From", &self.config.twilio_from_number),
                ("Twiml", &twiml),
                ("StatusCallback", &status_callback),
                ("StatusCallbackEvent", "initiated"),
                ("StatusCallbackEvent", "ringing"),
                ("StatusCallbackEvent", "answered"),
                ("StatusCallbackEvent", "completed"),
            ])
            .send()
            .await
            .map_err(|e| format!("twilio request failed: {e}"))?;

        // Twilio puts a useful JSON error body on 4xx, so read it before bailing.
        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|e| format!("twilio response unreadable: {e}"))?;

        if !status.is_success() {
            return Err(format!("twilio returned {status}: {body}"));
        }

        serde_json::from_str(&body).map_err(|e| format!("twilio response unparsable: {e}: {body}"))
    }
}
