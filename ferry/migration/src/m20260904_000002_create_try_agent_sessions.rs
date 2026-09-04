use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260904_000002_create_try_agent_sessions"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TryAgentSessions::Table)
                    .if_not_exists()
                    // Minted by ferry, not the database — see
                    // db::entity::try_agent_sessions::Model::id: this call_id
                    // is already in use (session registry, tracing span,
                    // BillingObserver) before any row exists to generate it.
                    .col(
                        ColumnDef::new(TryAgentSessions::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(TryAgentSessions::UserId).uuid().not_null())
                    .col(ColumnDef::new(TryAgentSessions::AgentId).uuid().not_null())
                    .col(
                        ColumnDef::new(TryAgentSessions::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .col(ColumnDef::new(TryAgentSessions::ConnectedAt).timestamp_with_time_zone())
                    .col(ColumnDef::new(TryAgentSessions::EndedAt).timestamp_with_time_zone())
                    .foreign_key(
                        ForeignKey::create()
                            .name("try_agent_sessions_user_id_fkey")
                            .from(TryAgentSessions::Table, TryAgentSessions::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("try_agent_sessions_agent_id_fkey")
                            .from(TryAgentSessions::Table, TryAgentSessions::AgentId)
                            .to(Agents::Table, Agents::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();

        // Same SELECT-only-by-owner shape as credit_ledger/credit_balances
        // (m20260904_000000): ferry is the only writer, mobile only ever
        // reads its own sessions (and only does so indirectly, via
        // credit_ledger — nothing queries this table directly yet).
        db.execute_unprepared(
            r#"
            alter table public.try_agent_sessions enable row level security;
            create policy try_agent_sessions_owner_select on public.try_agent_sessions
              for select
              to authenticated
              using (user_id = auth.uid());
            "#,
        )
        .await?;

        // credit_ledger.call_id can now point at either `calls` or
        // `try_agent_sessions`, depending on call_type — a real per-table
        // foreign key can't express "one of these two tables", so the
        // constraint is dropped and call_type alone is trusted to say which
        // table a given call_id belongs to (see BillingObserver::charge and
        // credit_ledger::Model::call_id).
        db.execute_unprepared(
            "ALTER TABLE credit_ledger DROP CONSTRAINT credit_ledger_call_id_fkey",
        )
        .await?;

        // credit_ledger_charge_call_idx (m20260904_000000) enforced at most
        // one charge row per call_id — silently correct only because every
        // try-agent charge left call_id null (distinct NULLs never collide
        // in a unique index) and no phone call had lived long enough to hit
        // its second charge. BillingObserver bills per usage stage
        // (stt/mt/tts), so several charge rows legitimately share one
        // call_id; now that try-agent charges get a real call_id too, this
        // would start rejecting every charge past a session's first. Drop
        // it — nothing was actually relying on it for retry-safety, since
        // charges aren't retried in the first place.
        db.execute_unprepared("DROP INDEX credit_ledger_charge_call_idx")
            .await
            .map(|_| ())
    }

    /// Not implemented, same reasoning as
    /// `m20260904_000001_add_credits_exhausted_end_reason::down`: reversing
    /// this migration means recreating `credit_ledger_charge_call_idx` and
    /// `credit_ledger_call_id_fkey` exactly as they were, but by the time
    /// `down()` runs there may be real data that violates both — a phone
    /// call with more than one charge row (the unique index's whole reason
    /// for going away), or a try-agent charge whose `call_id` points into
    /// `try_agent_sessions` rather than `calls` (which the old FK never
    /// allowed). Recreating them unconditionally would either fail outright
    /// or silently constrain future writes against data that already
    /// breaks the constraint.
    async fn down(&self, _manager: &SchemaManager) -> Result<(), DbErr> {
        Err(DbErr::Migration(
            "down migration not supported: would require recreating \
             credit_ledger_charge_call_idx and credit_ledger_call_id_fkey, \
             which data written under this migration may already violate"
                .to_string(),
        ))
    }
}

#[derive(DeriveIden)]
enum TryAgentSessions {
    Table,
    Id,
    UserId,
    AgentId,
    CreatedAt,
    ConnectedAt,
    EndedAt,
}

/// Already created by m20260821_180339_create_users_table — referenced here,
/// never re-created.
#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

/// Already created by m20260821_171603_create_agents_table — referenced
/// here, never re-created.
#[derive(DeriveIden)]
enum Agents {
    Table,
    Id,
}
