use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260831_000001_recording_timing"
    }
}

/// Call recordings come in two tracks: the original (each party's own mic)
/// and the translated (what the call's owner actually heard live — their own
/// voice plus the TTS translation of the other party). `calls.recording_url`
/// already covers the original; this adds its counterpart for the translated
/// track, plus per-utterance timing into that second track so a transcript
/// line can seek into either recording. `call_utterances.offset_ms`/
/// `duration_ms` already exist and cover the original track's timing.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Calls::Table)
                    .add_column(ColumnDef::new(Calls::TranslatedRecordingUrl).text())
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(CallUtterances::Table)
                    .add_column(ColumnDef::new(CallUtterances::TranslatedOffsetMs).integer())
                    .add_column(ColumnDef::new(CallUtterances::TranslatedDurationMs).integer())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(CallUtterances::Table)
                    .drop_column(CallUtterances::TranslatedOffsetMs)
                    .drop_column(CallUtterances::TranslatedDurationMs)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Calls::Table)
                    .drop_column(Calls::TranslatedRecordingUrl)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Calls {
    Table,
    TranslatedRecordingUrl,
}

#[derive(DeriveIden)]
enum CallUtterances {
    Table,
    TranslatedOffsetMs,
    TranslatedDurationMs,
}
