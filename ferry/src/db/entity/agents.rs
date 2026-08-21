use sea_orm::entity::prelude::*;

// Enum variants mirror the fixed option sets on mobile's New Agent screen
// (mobile/screens/AgentNew/index.tsx: LANGUAGES, MODES, GENDERS). `mascot`
// stays free text — it's a composite "style:seed" ref, not a fixed set.

#[derive(Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "language")]
pub enum Language {
    #[sea_orm(string_value = "en")]
    English,
    #[sea_orm(string_value = "hi")]
    Hindi,
    #[sea_orm(string_value = "te")]
    Telugu,
    #[sea_orm(string_value = "ta")]
    Tamil,
    #[sea_orm(string_value = "kn")]
    Kannada,
}

#[derive(Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "agent_mode")]
pub enum Mode {
    #[sea_orm(string_value = "formal")]
    Formal,
    #[sea_orm(string_value = "modern-colloquial")]
    ModernColloquial,
    #[sea_orm(string_value = "classic-colloquial")]
    ClassicColloquial,
    #[sea_orm(string_value = "code-mixed")]
    CodeMixed,
}

#[derive(Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "agent_gender")]
pub enum Gender {
    #[sea_orm(string_value = "female")]
    Female,
    #[sea_orm(string_value = "male")]
    Male,
    #[sea_orm(string_value = "neutral")]
    Neutral,
}

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "agents")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub name: String,
    pub input_language: Language,
    pub output_language: Language,
    pub mode: Option<Mode>,
    pub gender: Option<Gender>,
    pub mascot: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
