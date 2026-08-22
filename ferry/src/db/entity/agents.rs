use sea_orm::entity::prelude::*;

// Enum variants mirror the fixed option sets on mobile's New Agent screen
// (mobile/screens/AgentNew/index.tsx: LANGUAGES, MODES, GENDERS). `mascot`
// stays free text — it's a composite "style:seed" ref, not a fixed set.
// `serde(rename)` per variant keeps the JSON wire format ("en", "formal", ...)
// matching both the DB's string_value and what mobile actually sends,
// instead of serde's default PascalCase variant names.

#[derive(
    Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum, serde::Serialize, serde::Deserialize,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "language")]
pub enum Language {
    #[sea_orm(string_value = "en")]
    #[serde(rename = "en")]
    English,
    #[sea_orm(string_value = "hi")]
    #[serde(rename = "hi")]
    Hindi,
    #[sea_orm(string_value = "te")]
    #[serde(rename = "te")]
    Telugu,
    #[sea_orm(string_value = "ta")]
    #[serde(rename = "ta")]
    Tamil,
    #[sea_orm(string_value = "kn")]
    #[serde(rename = "kn")]
    Kannada,
}

#[derive(
    Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum, serde::Serialize, serde::Deserialize,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "agent_mode")]
pub enum Mode {
    #[sea_orm(string_value = "formal")]
    #[serde(rename = "formal")]
    Formal,
    #[sea_orm(string_value = "modern-colloquial")]
    #[serde(rename = "modern-colloquial")]
    ModernColloquial,
    #[sea_orm(string_value = "classic-colloquial")]
    #[serde(rename = "classic-colloquial")]
    ClassicColloquial,
    #[sea_orm(string_value = "code-mixed")]
    #[serde(rename = "code-mixed")]
    CodeMixed,
}

#[derive(
    Clone, Debug, PartialEq, Eq, EnumIter, DeriveActiveEnum, serde::Serialize, serde::Deserialize,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "agent_gender")]
pub enum Gender {
    #[sea_orm(string_value = "female")]
    #[serde(rename = "female")]
    Female,
    #[sea_orm(string_value = "male")]
    #[serde(rename = "male")]
    Male,
    #[sea_orm(string_value = "neutral")]
    #[serde(rename = "neutral")]
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
