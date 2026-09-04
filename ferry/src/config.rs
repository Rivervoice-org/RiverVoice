use std::fmt;
use std::sync::OnceLock;

const PROD_ENV_FILE: &str = "../.env.production";
const DEV_ENV_FILE: &str = "../.env.development";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Dev,
    Prod,
}
pub fn environment() -> Environment {
    let env = std::env::var("ENVIRONMENT").unwrap_or_else(|_| "development".to_string());
    match env.as_str() {
        "production" => Environment::Prod,
        _ => Environment::Dev,
    }
}

pub fn load_dotenv() {
    match dotenvy::dotenv() {
        Ok(_) => tracing::info!("Loaded .env file"),
        Err(_) => tracing::info!("No .env file found, relying on OS environment variables"),
    }

    let environment = environment();

    tracing::info!("ENVIRONMENT={:?}", environment);

    let file = if environment == Environment::Prod {
        PROD_ENV_FILE
    } else {
        DEV_ENV_FILE
    };

    if let Err(e) = dotenvy::from_filename(file) {
        tracing::error!("Failed to load {}: {}", file, e);
        std::process::exit(1);
    }
}

use validator::Validate;

pub struct Config {
    pub jwt_secret: Vec<u8>,
    pub database_url: String,
    pub deepgram_stt_api_key: String,
    pub openrouter_api_key: String,
    pub sarvam_tts_api_key: String,
    pub sarvam_stt_api_key: String,
    pub twilio_account_sid: String,
    pub twilio_auth_token: String,
    pub twilio_twiml_app_sid: String,
    pub twilio_from_number: String,
    pub public_base_url: String,
    pub webrtc_bind_ip: String,
    /// The address callers can actually reach, when it differs from
    /// `webrtc_bind_ip` — e.g. behind AWS/Lightsail-style 1:1 NAT, where the
    /// instance's network interface only ever sees its private address, but
    /// the public one (this) is what has to end up in the SDP answer. Empty
    /// means "no override": `webrtc_bind_ip` is already what's reachable
    /// (same-LAN dev), so nothing gets rewritten.
    pub webrtc_public_ip: String,
    /// Kong's own address, as ferry itself reaches it — used for every
    /// request ferry makes to Supabase (Storage uploads, sign requests).
    pub supabase_url: String,
    /// GoTrue's JWKS endpoint — used to verify Cloud-issued ES256 access
    /// tokens (see auth::jwks). Self-hosted GoTrue still signs HS256 with
    /// `jwt_secret`; that path stays for local dev.
    pub supabase_jwks_url: String,
    /// Bypasses RLS entirely, same trust level as ferry's direct Postgres
    /// connection — used only for the server-side recording upload, never
    /// forwarded to a client.
    pub supabase_secret_key: String,
    pub supabase_recordings_bucket: String,
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
    #[validate(length(min = 1, message = "SARVAM_STT_API_KEY is not set"))]
    sarvam_stt_api_key: String,
    #[validate(length(min = 1, message = "TWILIO_ACCOUNT_SID is not set"))]
    twilio_account_sid: String,
    #[validate(length(min = 1, message = "TWILIO_AUTH_TOKEN is not set"))]
    twilio_auth_token: String,
    #[validate(length(min = 1, message = "TWILIO_TWIML_APP_SID is not set"))]
    twilio_twiml_app_sid: String,
    #[validate(length(min = 1, message = "TWILIO_FROM_NUMBER is not set"))]
    twilio_from_number: String,
    #[validate(length(min = 1, message = "PUBLIC_BASE_URL is not set"))]
    public_base_url: String,
    // No #[validate]: has a sane default (0.0.0.0) for same-machine dev,
    // but must be a real, routable interface address (e.g. the LAN IP
    // mobile clients reach ferry on) for WebRTC audio to actually work.
    webrtc_bind_ip: String,
    // No #[validate]: empty is a valid, common case (dev) — see the field
    // doc on Config.
    webrtc_public_ip: String,
    #[validate(length(min = 1, message = "SUPABASE_URL is not set"))]
    supabase_url: String,
    #[validate(length(min = 1, message = "SUPABASE_JWKS_URL is not set"))]
    supabase_jwks_url: String,
    #[validate(length(min = 1, message = "SUPABASE_SECRET_KEY is not set"))]
    supabase_secret_key: String,
    // No #[validate]: has a sane default, and is a bucket name ferry
    // controls, not a secret or address that must be supplied.
    supabase_recordings_bucket: String,
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
            sarvam_stt_api_key: std::env::var("SARVAM_STT_API_KEY").unwrap_or_default(),
            twilio_account_sid: std::env::var("TWILIO_ACCOUNT_SID").unwrap_or_default(),
            twilio_auth_token: std::env::var("TWILIO_AUTH_TOKEN").unwrap_or_default(),
            twilio_twiml_app_sid: std::env::var("TWILIO_TWIML_APP_SID").unwrap_or_default(),
            twilio_from_number: std::env::var("TWILIO_FROM_NUMBER").unwrap_or_default(),
            public_base_url: std::env::var("PUBLIC_BASE_URL").unwrap_or_default(),
            webrtc_bind_ip: std::env::var("WEBRTC_BIND_IP")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            webrtc_public_ip: std::env::var("WEBRTC_PUBLIC_IP").unwrap_or_default(),
            supabase_url: std::env::var("SUPABASE_URL").unwrap_or_default(),
            supabase_jwks_url: std::env::var("SUPABASE_JWKS_URL").unwrap_or_default(),
            supabase_secret_key: std::env::var("SUPABASE_SECRET_KEY").unwrap_or_default(),
            supabase_recordings_bucket: std::env::var("SUPABASE_RECORDINGS_BUCKET")
                .ok()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "recordings".to_string()),
        };

        raw.validate().map_err(ConfigError)?;

        Ok(Config {
            jwt_secret: raw.jwt_secret.into_bytes(),
            database_url: raw.database_url,
            deepgram_stt_api_key: raw.deepgram_stt_api_key,
            openrouter_api_key: raw.openrouter_api_key,
            sarvam_tts_api_key: raw.sarvam_tts_api_key,
            sarvam_stt_api_key: raw.sarvam_stt_api_key,
            twilio_account_sid: raw.twilio_account_sid,
            twilio_auth_token: raw.twilio_auth_token,
            twilio_twiml_app_sid: raw.twilio_twiml_app_sid,
            twilio_from_number: raw.twilio_from_number,
            public_base_url: raw.public_base_url,
            webrtc_bind_ip: raw.webrtc_bind_ip,
            webrtc_public_ip: raw.webrtc_public_ip,
            supabase_url: raw.supabase_url,
            supabase_jwks_url: raw.supabase_jwks_url,
            supabase_secret_key: raw.supabase_secret_key,
            supabase_recordings_bucket: raw.supabase_recordings_bucket,
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
