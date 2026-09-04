use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260901_000002_rename_recording_columns"
    }
}

/// These columns stopped holding URLs once recordings moved to Storage's
/// `authenticated` download route (see `m20260901_000001_recording_storage_rls`)
/// — they now hold a bare bucket-relative object path (`{call_id}/original.wav`),
/// which the mobile client turns into a request itself. Renaming to match,
/// so the column name doesn't keep telling the next reader something false.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                alter table public.calls rename column recording_url to recording_path;
                alter table public.calls rename column translated_recording_url to translated_recording_path;
                "#,
            )
            .await
            .map(|_| ())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .get_connection()
            .execute_unprepared(
                r#"
                alter table public.calls rename column recording_path to recording_url;
                alter table public.calls rename column translated_recording_path to translated_recording_url;
                "#,
            )
            .await
            .map(|_| ())
    }
}
