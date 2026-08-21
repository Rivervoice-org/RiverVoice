use sea_orm_migration::prelude::extension::postgres::Type;
use sea_orm_migration::prelude::*;

pub struct Migration;

impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20260821_171603_create_agents_table"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_type(
                Type::create()
                    .as_enum(Language::Enum)
                    .values([
                        Language::En,
                        Language::Hi,
                        Language::Te,
                        Language::Ta,
                        Language::Kn,
                    ])
                    .to_owned(),
            )
            .await?;

        manager
            .create_type(
                Type::create()
                    .as_enum(AgentMode::Enum)
                    .values([
                        AgentMode::Formal,
                        AgentMode::ModernColloquial,
                        AgentMode::ClassicColloquial,
                        AgentMode::CodeMixed,
                    ])
                    .to_owned(),
            )
            .await?;

        manager
            .create_type(
                Type::create()
                    .as_enum(AgentGender::Enum)
                    .values([AgentGender::Female, AgentGender::Male, AgentGender::Neutral])
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Agents::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Agents::Id)
                            .uuid()
                            .not_null()
                            .primary_key()
                            .default(Expr::cust("gen_random_uuid()")),
                    )
                    .col(ColumnDef::new(Agents::Name).text().not_null())
                    .col(
                        ColumnDef::new(Agents::InputLanguage)
                            .enumeration(
                                Language::Enum,
                                [
                                    Language::En,
                                    Language::Hi,
                                    Language::Te,
                                    Language::Ta,
                                    Language::Kn,
                                ],
                            )
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Agents::OutputLanguage)
                            .enumeration(
                                Language::Enum,
                                [
                                    Language::En,
                                    Language::Hi,
                                    Language::Te,
                                    Language::Ta,
                                    Language::Kn,
                                ],
                            )
                            .not_null(),
                    )
                    .col(ColumnDef::new(Agents::Mode).enumeration(
                        AgentMode::Enum,
                        [
                            AgentMode::Formal,
                            AgentMode::ModernColloquial,
                            AgentMode::ClassicColloquial,
                            AgentMode::CodeMixed,
                        ],
                    ))
                    .col(ColumnDef::new(Agents::Gender).enumeration(
                        AgentGender::Enum,
                        [AgentGender::Female, AgentGender::Male, AgentGender::Neutral],
                    ))
                    .col(ColumnDef::new(Agents::Mascot).text())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Agents::Table).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(AgentGender::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(AgentMode::Enum).to_owned())
            .await?;
        manager
            .drop_type(Type::drop().name(Language::Enum).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Agents {
    Table,
    Id,
    Name,
    InputLanguage,
    OutputLanguage,
    Mode,
    Gender,
    Mascot,
}

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
enum AgentMode {
    #[sea_orm(iden = "agent_mode")]
    Enum,
    #[sea_orm(iden = "formal")]
    Formal,
    #[sea_orm(iden = "modern-colloquial")]
    ModernColloquial,
    #[sea_orm(iden = "classic-colloquial")]
    ClassicColloquial,
    #[sea_orm(iden = "code-mixed")]
    CodeMixed,
}

#[derive(DeriveIden)]
enum AgentGender {
    #[sea_orm(iden = "agent_gender")]
    Enum,
    #[sea_orm(iden = "female")]
    Female,
    #[sea_orm(iden = "male")]
    Male,
    #[sea_orm(iden = "neutral")]
    Neutral,
}
