use std::time::Duration;

use serde::Deserialize;

/// A slow upload (a long call's recording, tens of MB) shouldn't hang
/// forever — same reasoning as `services::twilio::client::TwilioClient`.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// A signed URL this long-lived effectively never expires for a call
/// recording's practical lifetime, without needing a re-signing flow on the
/// mobile client. ~10 years.
const SIGNED_URL_EXPIRY_SECS: u64 = 315_360_000;

/// Talks to Supabase Storage through Kong, the same gateway every other
/// Supabase service in this stack goes through (see docker-compose.yml) —
/// not a direct connection to the storage container. Uses the service-role
/// key, same trust level as ferry's direct Postgres connection: this is
/// server-side only, never forwarded to a client.
pub struct SupabaseStorageClient {
    http: reqwest::Client,
    base_url: String,
    service_role_key: String,
}

#[derive(Debug)]
pub struct StorageError(pub String);

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "supabase storage: {}", self.0)
    }
}

impl std::error::Error for StorageError {}

#[derive(Deserialize)]
struct SignedUrlResponse {
    #[serde(rename = "signedURL")]
    signed_url: String,
}

impl SupabaseStorageClient {
    pub fn new(base_url: String, service_role_key: String) -> Self {
        let http = reqwest::Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .expect("failed to build supabase storage http client");

        Self {
            http,
            base_url,
            service_role_key,
        }
    }

    /// Uploads `bytes` to `bucket`/`path`, overwriting any existing object
    /// at that path (`x-upsert`) — a retry after a partial failure should
    /// replace, not conflict.
    pub async fn upload(
        &self,
        bucket: &str,
        path: &str,
        content_type: &str,
        bytes: Vec<u8>,
    ) -> Result<(), StorageError> {
        let url = format!("{}/storage/v1/object/{bucket}/{path}", self.base_url);
        let response = self
            .http
            .put(url)
            .header("apikey", &self.service_role_key)
            .header("Authorization", format!("Bearer {}", self.service_role_key))
            .header("Content-Type", content_type)
            .header("x-upsert", "true")
            .body(bytes)
            .send()
            .await
            .map_err(|e| StorageError(format!("upload request failed: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(StorageError(format!("upload failed: {status}: {body}")));
        }
        Ok(())
    }

    /// A signed URL is required rather than a bare object path: the
    /// `recordings` bucket is private (call audio is not something any
    /// anon-keyed client should be able to fetch by guessing a path), and
    /// there is no per-request signing step on the mobile client to lean on
    /// instead — RLS covers Postgres rows, not Storage objects.
    pub async fn sign_url(&self, bucket: &str, path: &str) -> Result<String, StorageError> {
        let url = format!("{}/storage/v1/object/sign/{bucket}/{path}", self.base_url);
        let response = self
            .http
            .post(url)
            .header("apikey", &self.service_role_key)
            .header("Authorization", format!("Bearer {}", self.service_role_key))
            .json(&serde_json::json!({ "expiresIn": SIGNED_URL_EXPIRY_SECS }))
            .send()
            .await
            .map_err(|e| StorageError(format!("sign request failed: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(StorageError(format!("sign failed: {status}: {body}")));
        }

        let parsed: SignedUrlResponse = response
            .json()
            .await
            .map_err(|e| StorageError(format!("sign response parse failed: {e}")))?;

        // signedURL comes back as a path relative to /storage/v1
        // ("/object/sign/bucket/path?token=..."), not a full URL.
        Ok(format!("{}/storage/v1{}", self.base_url, parsed.signed_url))
    }
}
