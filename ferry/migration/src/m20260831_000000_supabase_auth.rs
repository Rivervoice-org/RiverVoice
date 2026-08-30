use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260831_000000_supabase_auth"
    }
}

/// Identity moves to Supabase Auth (GoTrue) — ferry no longer issues or
/// verifies its own tokens, so the columns/table that existed only to
/// support that (Google-account linkage, email verification tracked
/// separately from Supabase's own, and the whole refresh-token rotation
/// scheme) are dead weight. `users.id` is still the primary key, but it's
/// now set explicitly to the caller's Supabase `auth.users.id` on first
/// sight (see auth::middleware::ensure_user_row) rather than generated —
/// no column-level change needed for that, `gen_random_uuid()` was always
/// just a default, and an explicit `Set` already overrides it.
#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(RefreshTokens::Table).to_owned())
            .await?;

        manager
            .drop_index(
                Index::drop()
                    .name("users_google_id_key")
                    .table(Users::Table)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::GoogleId)
                    .drop_column(Users::EmailVerified)
                    .drop_column(Users::LastLoginAt)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .add_column(ColumnDef::new(Users::GoogleId).text().not_null())
                    .add_column(
                        ColumnDef::new(Users::EmailVerified)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .add_column(ColumnDef::new(Users::LastLoginAt).timestamp_with_time_zone())
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("users_google_id_key")
                    .table(Users::Table)
                    .col(Users::GoogleId)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(RefreshTokens::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(RefreshTokens::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .default(Expr::cust("gen_random_uuid()")),
                    )
                    .col(ColumnDef::new(RefreshTokens::UserId).uuid().not_null())
                    .col(ColumnDef::new(RefreshTokens::TokenHash).text().not_null())
                    .col(ColumnDef::new(RefreshTokens::FamilyId).uuid().not_null())
                    .col(
                        ColumnDef::new(RefreshTokens::ExpiresAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(ColumnDef::new(RefreshTokens::RevokedAt).timestamp_with_time_zone())
                    .col(
                        ColumnDef::new(RefreshTokens::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("refresh_tokens_user_id_fkey")
                            .from(RefreshTokens::Table, RefreshTokens::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("refresh_tokens_token_hash_key")
                    .table(RefreshTokens::Table)
                    .col(RefreshTokens::TokenHash)
                    .unique()
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("refresh_tokens_family_id_idx")
                    .table(RefreshTokens::Table)
                    .col(RefreshTokens::FamilyId)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    GoogleId,
    EmailVerified,
    LastLoginAt,
}

#[derive(DeriveIden)]
enum RefreshTokens {
    Table,
    Id,
    UserId,
    TokenHash,
    FamilyId,
    ExpiresAt,
    RevokedAt,
    CreatedAt,
}
