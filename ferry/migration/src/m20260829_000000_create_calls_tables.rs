use sea_orm_migration::prelude::extension::postgres::Type;
use sea_orm_migration::prelude::*;
use sea_orm_migration::sea_orm::ConnectionTrait;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260829_000000_create_calls_tables"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_type(
                Type::create()
                    .as_enum(CallDirection::Enum)
                    .values([CallDirection::Outbound, CallDirection::Inbound])
                    .to_owned(),
            )
            .await?;

        // Mirrors crate::call::registry's CallStatus. Rust models the terminal
        // state as `Ended(EndReason)`; SQL can't nest, so it is flattened into
        // `status` + a nullable `end_reason`, with the CHECK below keeping the
        // two in agreement.
        manager
            .create_type(
                Type::create()
                    .as_enum(CallStatus::Enum)
                    .values([
                        CallStatus::Dialing,
                        CallStatus::Ringing,
                        CallStatus::Connected,
                        CallStatus::Ended,
                    ])
                    .to_owned(),
            )
            .await?;

        manager
            .create_type(
                Type::create()
                    .as_enum(CallEndReason::Enum)
                    .values([
                        CallEndReason::Busy,
                        CallEndReason::NoAnswer,
                        CallEndReason::Failed,
                        CallEndReason::HungUpByA,
                        CallEndReason::HungUpByB,
                    ])
                    .to_owned(),
            )
            .await?;

        // `caller` and `callee` are the only two speakers. The agent never
        // originates a turn — it re-voices one, and its output lives in
        // `call_utterances.translated_text`.
        manager
            .create_type(
                Type::create()
                    .as_enum(CallSpeaker::Enum)
                    .values([CallSpeaker::Caller, CallSpeaker::Callee])
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Calls::Table)
                    .if_not_exists()
                    // Deliberately no default: the id is the CallId minted in
                    // crate::call::registry, already embedded in every URL
                    // handed to the telephony provider.
                    .col(ColumnDef::new(Calls::Id).uuid().not_null().primary_key())
                    .col(ColumnDef::new(Calls::UserId).uuid().not_null())
                    .col(ColumnDef::new(Calls::AgentId).uuid())
                    .col(
                        ColumnDef::new(Calls::Direction)
                            .enumeration(
                                CallDirection::Enum,
                                [CallDirection::Outbound, CallDirection::Inbound],
                            )
                            .not_null()
                            .default("outbound"),
                    )
                    .col(ColumnDef::new(Calls::FromNumber).text().not_null())
                    .col(ColumnDef::new(Calls::ToNumber).text().not_null())
                    // Snapshot of the agent as configured at call time: agents
                    // are mutable and deletable, so a live join would let a
                    // rename rewrite history and a delete blank it.
                    .col(ColumnDef::new(Calls::AgentName).text())
                    .col(ColumnDef::new(Calls::InputLanguage).enumeration(
                        Language::Enum,
                        [
                            Language::En,
                            Language::Hi,
                            Language::Te,
                            Language::Ta,
                            Language::Kn,
                        ],
                    ))
                    .col(ColumnDef::new(Calls::OutputLanguage).enumeration(
                        Language::Enum,
                        [
                            Language::En,
                            Language::Hi,
                            Language::Te,
                            Language::Ta,
                            Language::Kn,
                        ],
                    ))
                    .col(
                        ColumnDef::new(Calls::Status)
                            .enumeration(
                                CallStatus::Enum,
                                [
                                    CallStatus::Dialing,
                                    CallStatus::Ringing,
                                    CallStatus::Connected,
                                    CallStatus::Ended,
                                ],
                            )
                            .not_null()
                            .default("dialing"),
                    )
                    .col(ColumnDef::new(Calls::EndReason).enumeration(
                        CallEndReason::Enum,
                        [
                            CallEndReason::Busy,
                            CallEndReason::NoAnswer,
                            CallEndReason::Failed,
                            CallEndReason::HungUpByA,
                            CallEndReason::HungUpByB,
                        ],
                    ))
                    .col(ColumnDef::new(Calls::Error).text())
                    // Free text, not an enum, so adding a telephony provider is
                    // a config change and never a schema change.
                    .col(ColumnDef::new(Calls::TelephonyProvider).text())
                    .col(ColumnDef::new(Calls::ProviderCallRef).text())
                    .col(
                        ColumnDef::new(Calls::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(ColumnDef::new(Calls::RingingAt).timestamp_with_time_zone())
                    // The anchor every call_utterances.offset_ms is measured
                    // from, and what a recording must be aligned to.
                    .col(ColumnDef::new(Calls::ConnectedAt).timestamp_with_time_zone())
                    .col(ColumnDef::new(Calls::EndedAt).timestamp_with_time_zone())
                    // Stored, not derived from ended_at - connected_at: billing
                    // rounds up, and that rule belongs on the server.
                    .col(
                        ColumnDef::new(Calls::BillableSeconds)
                            .integer()
                            .not_null()
                            .default(0),
                    )
                    // INR micros, matching crate::pricing::dollars_to_micros.
                    .col(
                        ColumnDef::new(Calls::CostMicros)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(ColumnDef::new(Calls::RecordingUrl).text())
                    .col(
                        ColumnDef::new(Calls::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("calls_user_id_fkey")
                            .from(Calls::Table, Calls::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    // SetNull, not Cascade: deleting an agent must not delete
                    // the call history that used it.
                    .foreign_key(
                        ForeignKey::create()
                            .name("calls_agent_id_fkey")
                            .from(Calls::Table, Calls::AgentId)
                            .to(Agents::Table, Agents::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("calls_user_created_idx")
                    .table(Calls::Table)
                    .col(Calls::UserId)
                    .col((Calls::CreatedAt, IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();

        // Partial indexes and CHECK constraints have no schema-builder
        // equivalent, so these three are raw.
        db.execute_unprepared(
            "ALTER TABLE calls ADD CONSTRAINT calls_end_reason_iff_ended \
             CHECK ((status = 'ended') = (end_reason IS NOT NULL))",
        )
        .await?;

        db.execute_unprepared(
            "CREATE INDEX calls_active_idx ON calls (status) WHERE status <> 'ended'",
        )
        .await?;

        // What makes a replayed provider status callback a no-op at the
        // database level rather than application-level guesswork.
        db.execute_unprepared(
            "CREATE UNIQUE INDEX calls_provider_ref_idx \
             ON calls (telephony_provider, provider_call_ref) \
             WHERE provider_call_ref IS NOT NULL",
        )
        .await?;

        manager
            .create_table(
                Table::create()
                    .table(CallUtterances::Table)
                    .if_not_exists()
                    // Auto-incrementing, not a UUID: this is the high-volume
                    // table (~100-200 rows per call) and is only ever read as
                    // an ordered range for one call, never by random key.
                    .col(
                        ColumnDef::new(CallUtterances::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(CallUtterances::CallId).uuid().not_null())
                    .col(ColumnDef::new(CallUtterances::Seq).integer().not_null())
                    .col(
                        ColumnDef::new(CallUtterances::Speaker)
                            .enumeration(
                                CallSpeaker::Enum,
                                [CallSpeaker::Caller, CallSpeaker::Callee],
                            )
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CallUtterances::OriginalText)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(CallUtterances::OriginalLanguage).enumeration(
                            Language::Enum,
                            [
                                Language::En,
                                Language::Hi,
                                Language::Te,
                                Language::Ta,
                                Language::Kn,
                            ],
                        ),
                    )
                    // Null when this line needed no translation.
                    .col(ColumnDef::new(CallUtterances::TranslatedText).text())
                    .col(
                        ColumnDef::new(CallUtterances::TranslatedLanguage).enumeration(
                            Language::Enum,
                            [
                                Language::En,
                                Language::Hi,
                                Language::Te,
                                Language::Ta,
                                Language::Kn,
                            ],
                        ),
                    )
                    // Milliseconds from calls.connected_at. Relative, because
                    // they are used to seek into the recording.
                    .col(ColumnDef::new(CallUtterances::OffsetMs).integer())
                    .col(ColumnDef::new(CallUtterances::DurationMs).integer())
                    .col(
                        ColumnDef::new(CallUtterances::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("call_utterances_call_id_fkey")
                            .from(CallUtterances::Table, CallUtterances::CallId)
                            .to(Calls::Table, Calls::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // The read path (one call's lines, in order) and the uniqueness
        // guarantee, in one index.
        manager
            .create_index(
                Index::create()
                    .name("call_utterances_call_seq_key")
                    .table(CallUtterances::Table)
                    .col(CallUtterances::CallId)
                    .col(CallUtterances::Seq)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(CallUtterances::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Calls::Table).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CallSpeaker::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CallEndReason::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CallStatus::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CallDirection::Enum).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Calls {
    Table,
    Id,
    UserId,
    AgentId,
    Direction,
    FromNumber,
    ToNumber,
    AgentName,
    InputLanguage,
    OutputLanguage,
    Status,
    EndReason,
    Error,
    TelephonyProvider,
    ProviderCallRef,
    CreatedAt,
    RingingAt,
    ConnectedAt,
    EndedAt,
    BillableSeconds,
    CostMicros,
    RecordingUrl,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CallUtterances {
    Table,
    Id,
    CallId,
    Seq,
    Speaker,
    OriginalText,
    OriginalLanguage,
    TranslatedText,
    TranslatedLanguage,
    OffsetMs,
    DurationMs,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Agents {
    Table,
    Id,
}

/// Already created by m20260821_171603_create_agents_table — referenced here,
/// never re-created.
#[derive(DeriveIden)]
enum Language {
    #[sea_orm(iden = "language")]
    Enum,
    #[sea_orm(iden = "en")]
    En,
    #[sea_orm(iden = "hi")]
    Hi,
    #[sea_orm(iden = "te")]
    Te,
    #[sea_orm(iden = "ta")]
    Ta,
    #[sea_orm(iden = "kn")]
    Kn,
}

#[derive(DeriveIden)]
enum CallDirection {
    #[sea_orm(iden = "call_direction")]
    Enum,
    #[sea_orm(iden = "outbound")]
    Outbound,
    #[sea_orm(iden = "inbound")]
    Inbound,
}

#[derive(DeriveIden)]
enum CallStatus {
    #[sea_orm(iden = "call_status")]
    Enum,
    #[sea_orm(iden = "dialing")]
    Dialing,
    #[sea_orm(iden = "ringing")]
    Ringing,
    #[sea_orm(iden = "connected")]
    Connected,
    #[sea_orm(iden = "ended")]
    Ended,
}

#[derive(DeriveIden)]
enum CallEndReason {
    #[sea_orm(iden = "call_end_reason")]
    Enum,
    #[sea_orm(iden = "busy")]
    Busy,
    #[sea_orm(iden = "no_answer")]
    NoAnswer,
    #[sea_orm(iden = "failed")]
    Failed,
    #[sea_orm(iden = "hung_up_by_a")]
    HungUpByA,
    #[sea_orm(iden = "hung_up_by_b")]
    HungUpByB,
}

#[derive(DeriveIden)]
enum CallSpeaker {
    #[sea_orm(iden = "call_speaker")]
    Enum,
    #[sea_orm(iden = "caller")]
    Caller,
    #[sea_orm(iden = "callee")]
    Callee,
}
