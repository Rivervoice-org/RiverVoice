use garde::Validate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RetryOn {
    Busy,
    NoAnswer,
    Failed,
    ShortDuration,
    ProviderError,
    InternalError,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Validate)]
pub struct RetryPolicy {
    #[garde(range(min = 1, max = 20))]
    pub max_retries: u8,
    #[garde(range(min = 1, max = 3600))]
    pub interval_secs: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Validate)]
pub struct ConfigRules {
    #[garde(skip)]
    pub retry_on: RetryOn,
    #[garde(dive)]
    pub retry_policy: RetryPolicy,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, Validate)]
pub struct CallRetryConfig {
    #[garde(length(max = 6), dive)]
    pub rules: Vec<ConfigRules>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CallPayload {
    #[garde(length(min = 7, max = 20))]
    pub phone_number: String,
    #[garde(length(min = 1, max = 4000))]
    pub prompt: String,
    #[garde(dive)]
    pub config: CallRetryConfig,
}
