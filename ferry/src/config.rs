use std::fmt;
use std::sync::OnceLock;

/// Loads `.env` file contents into the process environment, before
/// anything reads `std::env::var` — including [`crate::logging::init`],
/// which runs before [`init`] and reads `LOG_FORMAT` directly, so this
/// has to happen first and separately rather than folded into [`init`]
/// itself. Missing files are fine, not an error: a real deployment sets
/// environment variables directly (Docker, systemd, ...) rather than
/// shipping a `.env` file, so both lookups below just no-op there.
///
/// Two locations, in order:
/// - the repo root's `.env` (`../.env` from ferry's usual working
///   directory), shared with harbor/docker-compose
/// - the current directory's `.env`, for whoever runs the binary from
///   somewhere else (repo root directly, a ferry-local override, ...)
pub fn load_dotenv() {
    let _ = dotenvy::from_filename("../.env");
    let _ = dotenvy::dotenv();
}

use validator::Validate;

pub struct Config {
    pub jwt_secret: Vec<u8>,
    pub deepgram_stt_api_key: String,
    pub openrouter_api_key: String,
    pub sarvam_tts_api_key: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LogFormat {
    Pretty,
    Json,
}

pub fn log_format() -> LogFormat {
    match std::env::var("LOG_FORMAT").as_deref() {
        Ok("json") => LogFormat::Json,
        _ => LogFormat::Pretty,
    }
}

#[derive(Validate)]
struct RawConfig {
    #[validate(length(min = 32, message = "JWT_SECRET must be at least 32 bytes"))]
    jwt_secret: String,
    #[validate(length(min = 1, message = "DEEPGRAM_STT_API_KEY is not set"))]
    deepgram_stt_api_key: String,
    #[validate(length(min = 1, message = "OPENROUTER_API_KEY is not set"))]
    openrouter_api_key: String,
    #[validate(length(min = 1, message = "SARVAM_TTS_API_KEY is not set"))]
    sarvam_tts_api_key: String,
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
            deepgram_stt_api_key: std::env::var("DEEPGRAM_STT_API_KEY").unwrap_or_default(),
            openrouter_api_key: std::env::var("OPENROUTER_API_KEY").unwrap_or_default(),
            sarvam_tts_api_key: std::env::var("SARVAM_TTS_API_KEY").unwrap_or_default(),
        };

        raw.validate().map_err(ConfigError)?;

        Ok(Config {
            jwt_secret: raw.jwt_secret.into_bytes(),
            deepgram_stt_api_key: raw.deepgram_stt_api_key,
            openrouter_api_key: raw.openrouter_api_key,
            sarvam_tts_api_key: raw.sarvam_tts_api_key,
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
