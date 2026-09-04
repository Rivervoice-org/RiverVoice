use sea_orm::entity::prelude::*;

/// A try-agent session's entire database footprint: just enough to give its
/// charges a `call_id` to group under, so Credits History can summarize a
/// session's stt/mt/tts charges into one row the same way it does for a
/// phone call. No transcript, no recording — try-agent is a short one-off
/// demo of an agent, not a real call worth keeping history for; the only
/// reason this table exists at all is billing.
#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "try_agent_sessions")]
pub struct Model {
    /// Not auto-generated — ferry mints this UUID up front
    /// (`http::handlers::try_agent`) and reuses it as `credit_ledger.call_id`
    /// for every charge the session produces.
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: Uuid,
    pub agent_id: Uuid,

    pub created_at: DateTimeWithTimeZone,
    /// Same pattern as `calls.connected_at`/`ended_at`: duration is derived
    /// from the gap between the two rather than stored redundantly, and
    /// `connected_at` stays null if the session never got past signaling.
    pub connected_at: Option<DateTimeWithTimeZone>,
    pub ended_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::users::Entity",
        from = "Column::UserId",
        to = "super::users::Column::Id",
        on_delete = "Cascade"
    )]
    Users,
    #[sea_orm(
        belongs_to = "super::agents::Entity",
        from = "Column::AgentId",
        to = "super::agents::Column::Id",
        on_delete = "Cascade"
    )]
    Agents,
}

impl Related<super::users::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}

impl Related<super::agents::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Agents.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
