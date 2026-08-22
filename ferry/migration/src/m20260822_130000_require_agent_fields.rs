use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260822_130000_require_agent_fields"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Agents::Table)
                    .modify_column(ColumnDef::new(Agents::Mode).not_null())
                    .modify_column(ColumnDef::new(Agents::Gender).not_null())
                    .modify_column(ColumnDef::new(Agents::Mascot).not_null())
                    .modify_column(ColumnDef::new(Agents::Voice).not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Agents::Table)
                    .modify_column(ColumnDef::new(Agents::Mode).null())
                    .modify_column(ColumnDef::new(Agents::Gender).null())
                    .modify_column(ColumnDef::new(Agents::Mascot).null())
                    .modify_column(ColumnDef::new(Agents::Voice).null())
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Agents {
    Table,
    Mode,
    Gender,
    Mascot,
    Voice,
}
