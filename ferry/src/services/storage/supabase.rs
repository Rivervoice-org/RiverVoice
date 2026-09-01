use std::time::Duration;

/// A stalled upload shouldn't hang forever — same reasoning as
/// `services::twilio::client::TwilioClient`. An idle-read timeout rather
/// than a whole-request one: a long call's recording (tens of MB) can
/// legitimately take longer than this to finish on a slow-but-still-
/// transferring connection, and a flat total-duration timeout would abort
/// it mid-upload even though bytes are still flowing. This only fires when
/// no progress happens for this long.
const IDLE_READ_TIMEOUT: Duration = Duration::from_secs(30);

/// Talks to Supabase Storage through Kong, the same gateway every other
/// Supabase service in this stack goes through (see docker-compose.yml) —
/// not a direct connection to the storage container. Uses the service-role
/// key, same trust level as ferry's direct Postgres connection: this is
/// server-side only, never forwarded to a client.
///
/// Upload-only: recordings are read back through Storage's `authenticated`
/// download route, straight from the mobile client with its own session
/// JWT (checked by the `recordings_owner_select` RLS policy on every
/// request — see `m20260901_000001_recording_storage_rls`), not through a
/// signed URL minted here.
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

impl SupabaseStorageClient {
    pub fn new(base_url: String, service_role_key: String) -> Self {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(IDLE_READ_TIMEOUT)
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
}
