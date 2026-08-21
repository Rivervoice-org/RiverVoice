use std::fmt;
use std::sync::OnceLock;

pub fn load_dotenv() {
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();
}

use validator::Validate;

pub struct Config {
    pub jwt_secret: Vec<u8>,
    pub database_url: String,
    pub deepgram_stt_api_key: String,
    pub openrouter_api_key: String,
    pub sarvam_tts_api_key: String,
    pub twilio_account_sid: String,
    pub twilio_auth_token: String,
    pub twilio_twiml_app_sid: String,
    pub twilio_from_number: String,
    pub twilio_to_number: String,
    pub public_base_url: String,
    pub webrtc_bind_ip: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Dev,
    Prod,
}
pub fn environment() -> Environment {
    match std::env::var("ENVIRONMENT").as_deref() {
        Ok("dev") => Environment::Dev,
        _ => Environment::Prod,
    }
}

#[derive(Validate)]
struct RawConfig {
    #[validate(length(min = 32, message = "JWT_SECRET must be at least 32 bytes"))]
    jwt_secret: String,
    #[validate(length(min = 1, message = "DATABASE_URL is not set"))]
    database_url: String,
    #[validate(length(min = 1, message = "DEEPGRAM_STT_API_KEY is not set"))]
    deepgram_stt_api_key: String,
    #[validate(length(min = 1, message = "OPENROUTER_API_KEY is not set"))]
    openrouter_api_key: String,
    #[validate(length(min = 1, message = "SARVAM_TTS_API_KEY is not set"))]
    sarvam_tts_api_key: String,
    #[validate(length(min = 1, message = "TWILIO_ACCOUNT_SID is not set"))]
    twilio_account_sid: String,
    #[validate(length(min = 1, message = "TWILIO_AUTH_TOKEN is not set"))]
    twilio_auth_token: String,
    #[validate(length(min = 1, message = "TWILIO_TWIML_APP_SID is not set"))]
    twilio_twiml_app_sid: String,
    #[validate(length(min = 1, message = "TWILIO_FROM_NUMBER is not set"))]
    twilio_from_number: String,
    #[validate(length(min = 1, message = "TWILIO_TO_NUMBER is not set"))]
    twilio_to_number: String,
    #[validate(length(min = 1, message = "PUBLIC_BASE_URL is not set"))]
    public_base_url: String,
    // No #[validate]: has a sane default (0.0.0.0) for same-machine dev,
    // but must be a real, routable interface address (e.g. the LAN IP
    // mobile clients reach ferry on) for WebRTC audio to actually work.
    webrtc_bind_ip: String,
}

#[derive(Clone)]
pub struct ConfigError(validator::ValidationErrors);

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "invalid configuration: {}", self.0)
    }
}

impl fmt::Debug for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, f)
    }
}

static CONFIG: OnceLock<Result<Config, ConfigError>> = OnceLock::new();

impl Config {
    fn load() -> Result<Self, ConfigError> {
        let raw = RawConfig {
            jwt_secret: std::env::var("JWT_SECRET").unwrap_or_default(),
            database_url: std::env::var("DATABASE_URL").unwrap_or_default(),
            deepgram_stt_api_key: std::env::var("DEEPGRAM_STT_API_KEY").unwrap_or_default(),
            openrouter_api_key: std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            sarvam_tts_api_key: std::env::var("SARVAM_TTS_API_KEY").unwrap_or_default(),
            twilio_account_sid: std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default(),
            twilio_auth_token: std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default(),
            twilio_twiml_app_sid: std::env::var("TWILIO_TWIML_APP_SID").unwrap_or_default(),
            twilio_from_number: std::env::var("TWILIO_FROM_NUMBER").unwrap_or_default(),
            twilio_to_number: std::env::var("TWILIO_TO_NUMBER").unwrap_or_default(),
            public_base_url: std::env::var("PUBLIC_BASE_URL").unwrap_or_default(),
            webrtc_bind_ip: std::env::var("WEBRTC_BIND_IP")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
        };

        raw.validate().map_err(ConfigError)?;

        Ok(Config {
            jwt_secret: raw.jwt_secret.into_bytes(),
            database_url: raw.database_url,
            deepgram_stt_api_key: raw.deepgram_stt_api_key,
            openrouter_api_key: raw.openrouter_api_key,
            sarvam_tts_api_key: raw.sarvam_tts_api_key,
            twilio_account_sid: raw.twilio_account_sid,
            twilio_auth_token: raw.twilio_auth_token,
            twilio_twiml_app_sid: raw.twilio_twiml_app_sid,
            twilio_from_number: raw.twilio_from_number,
            twilio_to_number: raw.twilio_to_number,
            public_base_url: raw.public_base_url,
            webrtc_bind_ip: raw.webrtc_bind_ip,
        })
    }
}

pub fn init() {
    let result = Config::load();
    if let Err(e) = &result {
        tracing::error!("{e}");
        std::process::exit(1);
    }
    CONFIG
        .set(result)
        .unwrap_or_else(|_| panic!("config::init called more than once"));
}

pub fn get() -> Result<&'static Config, &'static ConfigError> {
    CONFIG
        .get()
        .expect("config::get() called before config::init()")
        .as_ref()
}
