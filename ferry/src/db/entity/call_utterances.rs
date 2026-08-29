use sea_orm::entity::prelude::*;

use super::agents::Language;

/// The two people on the call. The agent is never a speaker — it does not
/// originate a turn, it re-voices one, and its output is `translated_text` on
/// whichever speaker's row it translated.
#[derive(
    Clone,
    Debug,
    PartialEq,
    Eq,
    EnumIter,
    DeriveActiveEnum,
    serde::Serialize,
    serde::Deserialize,
    ts_rs::TS,
)]
#[ts(export)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "call_speaker")]
pub enum Speaker {
    #[sea_orm(string_value = "caller")]
    #[serde(rename = "caller")]
    Caller,
    #[sea_orm(string_value = "callee")]
    #[serde(rename = "callee")]
    Callee,
}

/// One finalized line of speech. Interim STT results are never persisted —
/// they are replaced on every partial and only committed on `is_final`, so
/// storing them would multiply rows for text that is immediately overwritten.
///
/// Original and translation share a row rather than occupying two. They
/// arrive as two separate frames (`UserTurnAggregation` then `MtText`), so the
/// translation is an UPDATE on `(call_id, seq)` rather than a second INSERT —
/// which rides the unique index, halves the row count, and lets the transcript
/// be read back with no pairing logic.
///
/// Valid only while one utterance maps to at most one translation. If output
/// ever fans out to several target languages at once, this has to become child
/// rows.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "call_utterances")]
pub struct Model {
    /// Auto-incrementing rather than a UUID: this is the high-volume table
    /// (~100-200 rows per call) and it is only ever read as an ordered range
    /// for one call, never by random key.
    #[sea_orm(primary_key)]
    pub id: i64,
    pub call_id: Uuid,
    /// Ordering within the call. Unique with `call_id`, and the key the
    /// translation UPDATE targets — timestamps can collide, this cannot.
    pub seq: i32,
    pub speaker: Speaker,

    pub original_text: String,
    pub original_language: Option<Language>,
    /// `None` when this line needed no translation.
    pub translated_text: Option<String>,
    pub translated_language: Option<Language>,

    /// Milliseconds from `calls.connected_at`. Relative, not absolute, because
    /// it is used to scrub the transcript against the recording.
    pub offset_ms: Option<i32>,
    /// How long this turn runs. Needed to know when to *stop* playback when a
    /// line is tapped; deriving the end from the next row's `offset_ms` would
    /// swallow the silence between turns and break on overlapping speech.
    /// Stays NULL until there is a recording to seek into.
    pub duration_ms: Option<i32>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::calls::Entity",
        from = "Column::CallId",
        to = "super::calls::Column::Id",
        on_delete = "Cascade"
    )]
    Calls,
}

impl Related<super::calls::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Calls.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
