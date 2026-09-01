use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260901_000001_recording_storage_rls"
    }
}

/// Recordings are no longer served via signed URLs (a standing bearer token,
/// checked once at creation and never again). Instead the mobile client
/// fetches `/storage/v1/object/authenticated/recordings/{path}` with its own
/// session JWT, and Storage re-checks this policy on every single request —
/// same trust model as the RLS on `calls` itself (see
/// `m20260831_000003_enable_rls`), just extended to the object storage.
///
/// Objects are uploaded at `{call_id}/original.wav` / `{call_id}/translated.wav`
/// (see `call_record_observer.rs`), so `(storage.foldername(name))[1]` is the
/// call id — ownership is resolved by joining back to `calls.user_id`.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                create policy recordings_owner_select on storage.objects
                  for select
                  to authenticated
                  using (
                    bucket_id = 'recordings'
                    and exists (
                      select 1 from public.calls
                      where calls.id::text = (storage.foldername(name))[1]
                        and calls.user_id = auth.uid()
                    )
                  );
                "#,
            )
            .await
            .map(|_| ())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared("drop policy if exists recordings_owner_select on storage.objects;")
            .await
            .map(|_| ())
    }
}
