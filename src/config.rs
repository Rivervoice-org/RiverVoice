/// Everything the process needs from the environment, read once at startup.
#[derive(Debug, Clone)]
pub struct Config {
    pub twilio_account_sid: String,
    pub twilio_auth_token: String,
    pub twilio_from_number: String,
    /// Public HTTPS origin Twilio can reach, e.g. the cloudflared URL.
    /// No trailing slash.
    pub public_base_url: String,
}

impl Config {
    /// Fails loudly at startup rather than on the first request.
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            twilio_account_sid: required("TWILIO_ACCOUNT_SID")?,
            twilio_auth_token: required("TWILIO_AUTH_TOKEN")?,
            twilio_from_number: required("TWILIO_FROM_NUMBER")?,
            public_base_url: required("PUBLIC_BASE_URL")?
                .trim_end_matches('/')
                .to_string(),
        })
    }

    /// `wss://host/audioStream`, derived from the public origin.
    pub fn audio_stream_url(&self) -> String {
        let host = self
            .public_base_url
            .trim_start_matches("https://")
            .trim_start_matches("http://");

        format!("wss://{host}/audioStream")
    }
}

fn required(key: &str) -> Result<String, String> {
    std::env::var(key).map_err(|_| format!("missing env var {key}"))
}
