/// App-level settings. Provider credentials live with their provider.
#[derive(Debug, Clone)]
pub struct Config {
    /// Public HTTPS origin the provider can reach, e.g. the cloudflared URL.
    /// No trailing slash.
    pub public_base_url: String,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        Ok(Self {
            public_base_url: std::env::var("PUBLIC_BASE_URL")
                .map_err(|_| "missing env var PUBLIC_BASE_URL".to_string())?
                .trim_end_matches('/')
                .to_string(),
        })
    }

    pub fn audio_stream_url(&self) -> String {
        let host = self
            .public_base_url
            .trim_start_matches("https://")
            .trim_start_matches("http://");

        format!("wss://{host}/audioStream")
    }

    pub fn status_url(&self) -> String {
        format!("{}/twilio/status", self.public_base_url)
    }
}
