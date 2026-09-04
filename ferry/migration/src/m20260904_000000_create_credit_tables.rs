use sea_orm_migration::prelude::extension::postgres::Type;
use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260904_000000_create_credit_tables"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_type(
                Type::create()
                    .as_enum(CreditEntryType::Enum)
                    .values([
                        CreditEntryType::Charge,
                        CreditEntryType::Topup,
                        CreditEntryType::Refund,
                        CreditEntryType::Bonus,
                        CreditEntryType::Adjustment,
                    ])
                    .to_owned(),
            )
            .await?;

        // What kind of usage a charge billed. Needed because try-agent (see
        // http::handlers::try_agent) is a one-way demo with its own call_id
        // that is never written to `calls` — so once call_id is null for
        // both a try-agent charge and a non-charge entry, this is what tells
        // a try-agent charge apart from those.
        manager
            .create_type(
                Type::create()
                    .as_enum(CreditCallType::Enum)
                    .values([CreditCallType::PhoneCall, CreditCallType::TryAgent])
                    .to_owned(),
            )
            .await?;

        // Append-only. This is the source of truth; credit_balances below is
        // a cache kept in sync with it, not the other way around.
        manager
            .create_table(
                Table::create()
                    .table(CreditLedger::Table)
                    .if_not_exists()
                    // Auto-incrementing, not a UUID: same reasoning as
                    // call_utterances.id — high-volume, only ever read as an
                    // ordered range for one user, never by random key.
                    .col(
                        ColumnDef::new(CreditLedger::Id)
                            .big_integer()
                            .not_null()
                            .auto_increment()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(CreditLedger::UserId).uuid().not_null())
                    // Set only when entry_type = 'charge' and call_type =
                    // 'phone_call' — a try-agent charge has no `calls` row
                    // to point at, so it leaves this null and relies on
                    // call_type instead.
                    .col(ColumnDef::new(CreditLedger::CallId).uuid())
                    // Set only when entry_type = 'charge'; null otherwise.
                    .col(ColumnDef::new(CreditLedger::CallType).enumeration(
                        CreditCallType::Enum,
                        [CreditCallType::PhoneCall, CreditCallType::TryAgent],
                    ))
                    .col(
                        ColumnDef::new(CreditLedger::EntryType)
                            .enumeration(
                                CreditEntryType::Enum,
                                [
                                    CreditEntryType::Charge,
                                    CreditEntryType::Topup,
                                    CreditEntryType::Refund,
                                    CreditEntryType::Bonus,
                                    CreditEntryType::Adjustment,
                                ],
                            )
                            .not_null(),
                    )
                    // Signed: negative for a charge, positive otherwise.
                    // Summing this column for a user is, by definition,
                    // their balance.
                    .col(
                        ColumnDef::new(CreditLedger::AmountCredits)
                            .big_integer()
                            .not_null(),
                    )
                    // Real-money cost this entry represents, snapshotted from
                    // crate::pricing at charge time — a later price change
                    // must never rewrite what a past call was billed. Null
                    // for bonus/adjustment, where no money changed hands.
                    .col(ColumnDef::new(CreditLedger::CostMicros).big_integer())
                    // Payment provider's own id for a topup (Razorpay/Stripe
                    // order id). Free text, not a foreign key — ferry doesn't
                    // own that record.
                    .col(ColumnDef::new(CreditLedger::ProviderRef).text())
                    .col(ColumnDef::new(CreditLedger::Note).text())
                    .col(
                        ColumnDef::new(CreditLedger::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("credit_ledger_user_id_fkey")
                            .from(CreditLedger::Table, CreditLedger::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    // SetNull, not Cascade: purging a call must not erase the
                    // billing record of it having happened.
                    .foreign_key(
                        ForeignKey::create()
                            .name("credit_ledger_call_id_fkey")
                            .from(CreditLedger::Table, CreditLedger::CallId)
                            .to(Calls::Table, Calls::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        // What powers the Credits History screen's paging, same shape as
        // calls_user_created_idx.
        manager
            .create_index(
                Index::create()
                    .name("credit_ledger_user_created_idx")
                    .table(CreditLedger::Table)
                    .col(CreditLedger::UserId)
                    .col((CreditLedger::CreatedAt, IndexOrder::Desc))
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();

        // A partial unique index has no schema-builder equivalent. This is
        // what makes charging idempotent at the database level: a retried
        // billing event for the same call can't double-charge it.
        db.execute_unprepared(
            "CREATE UNIQUE INDEX credit_ledger_charge_call_idx \
             ON credit_ledger (call_id) WHERE entry_type = 'charge'",
        )
        .await?;

        // Cached current balance, one row per user. Not the source of
        // truth — kept in sync with credit_ledger by incrementing/
        // decrementing in the same transaction as each ledger insert, so the
        // hot path (can this call keep running?) checks one row instead of
        // summing history on every frame.
        manager
            .create_table(
                Table::create()
                    .table(CreditBalances::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(CreditBalances::UserId)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(
                        ColumnDef::new(CreditBalances::BalanceCredits)
                            .big_integer()
                            .not_null()
                            .default(0),
                    )
                    .col(
                        ColumnDef::new(CreditBalances::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("credit_balances_user_id_fkey")
                            .from(CreditBalances::Table, CreditBalances::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        // Both tables are only ever written by ferry, same as calls/
        // call_utterances (see m20260831_000003_enable_rls) — the mobile
        // client only reads its own history, so SELECT-only policies scoped
        // to auth.uid() are all PostgREST needs.
        db.execute_unprepared(
            r#"
            alter table public.credit_ledger enable row level security;
            create policy credit_ledger_owner_select on public.credit_ledger
              for select
              to authenticated
              using (user_id = auth.uid());

            alter table public.credit_balances enable row level security;
            create policy credit_balances_owner_select on public.credit_balances
              for select
              to authenticated
              using (user_id = auth.uid());
            "#,
        )
        .await
        .map(|_| ())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        let db = manager.get_connection();
        db.execute_unprepared(
            r#"
            drop policy if exists credit_balances_owner_select on public.credit_balances;
            alter table public.credit_balances disable row level security;

            drop policy if exists credit_ledger_owner_select on public.credit_ledger;
            alter table public.credit_ledger disable row level security;
            "#,
        )
        .await?;

        manager
            .drop_table(Table::drop().table(CreditBalances::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(CreditLedger::Table).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CreditEntryType::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(CreditCallType::Enum).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum CreditLedger {
    Table,
    Id,
    UserId,
    CallId,
    CallType,
    EntryType,
    AmountCredits,
    CostMicros,
    ProviderRef,
    Note,
    CreatedAt,
}

#[derive(DeriveIden)]
enum CreditBalances {
    Table,
    UserId,
    BalanceCredits,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum CreditEntryType {
    #[sea_orm(iden = "credit_entry_type")]
    Enum,
    #[sea_orm(iden = "charge")]
    Charge,
    #[sea_orm(iden = "topup")]
    Topup,
    #[sea_orm(iden = "refund")]
    Refund,
    #[sea_orm(iden = "bonus")]
    Bonus,
    #[sea_orm(iden = "adjustment")]
    Adjustment,
}

#[derive(DeriveIden)]
enum CreditCallType {
    #[sea_orm(iden = "credit_call_type")]
    Enum,
    #[sea_orm(iden = "phone_call")]
    PhoneCall,
    #[sea_orm(iden = "try_agent")]
    TryAgent,
}

/// Already created by m20260821_180339_create_users_table — referenced here,
/// never re-created.
#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

/// Already created by m20260829_000000_create_calls_tables — referenced
/// here, never re-created.
#[derive(DeriveIden)]
enum Calls {
    Table,
    Id,
}
