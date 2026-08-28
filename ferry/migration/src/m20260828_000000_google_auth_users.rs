use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260828_000000_google_auth_users"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::MobileNumber)
                    .add_column(ColumnDef::new(Users::GoogleId).text().not_null())
                    .add_column(ColumnDef::new(Users::Email).text().not_null())
                    .add_column(
                        ColumnDef::new(Users::EmailVerified)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .add_column(
                        ColumnDef::new(Users::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
                    )
                    .add_column(
                        ColumnDef::new(Users::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null()
                            .default(Expr::current_timestamp()),
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
            .create_index(
                Index::create()
                    .name("users_email_key")
                    .table(Users::Table)
                    .col(Users::Email)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Users::Table)
                    .drop_column(Users::GoogleId)
                    .drop_column(Users::Email)
                    .drop_column(Users::EmailVerified)
                    .drop_column(Users::CreatedAt)
                    .drop_column(Users::UpdatedAt)
                    .drop_column(Users::LastLoginAt)
                    .add_column(ColumnDef::new(Users::MobileNumber).text().not_null())
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Users {
    Table,
    MobileNumber,
    Mascot,
    GoogleId,
    Email,
    EmailVerified,
    CreatedAt,
    UpdatedAt,
    LastLoginAt,
}
