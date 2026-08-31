use axum::extract::Extension;
use axum::http::StatusCode;
use sea_orm::prelude::DateTimeWithTimeZone;
use sea_orm::{
    ColumnTrait, EntityTrait, FromQueryResult, JoinType, QueryFilter, QueryOrder, QuerySelect,
    RelationTrait,
};
use serde::Serialize;
use uuid::Uuid;

use crate::auth::token::UserSession;
use crate::db;
use crate::db::entity::agents;
use crate::db::entity::calls;
use crate::http::response::ApiResponse;

const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

/// The Home screen shows three and only three. Fixed here rather than taken
/// from the query string: there is no page two to ask for, so a `limit`
/// parameter would only be a way for a client to get an answer the screen
/// cannot use.
const RECENT_AGENT_LIMIT: u64 = 3;

/// Just enough to draw one row: the avatar, the title, and the line of
/// history under it. The agent's configuration — languages, mode, gender,
/// voice — is deliberately absent; this endpoint is only for the "recently
/// used" row, not agent detail (that's a plain PostgREST read against
/// `agents` directly now — see the client's lib/agents/api.ts).
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecentAgentResponse {
    pub id: String,
    pub name: String,
    pub mascot: String,
    /// The most recent call this agent handled — what "recently used" orders
    /// by, and the only reason the calls table is joined at all.
    pub last_used_at: DateTimeWithTimeZone,
    /// `number`, not ts-rs's default `bigint` for i64: COUNT is i64 in
    /// Postgres, but this is one user's calls to one agent, so it is a
    /// JavaScript number long before it is anything else.
    #[ts(type = "number")]
    pub call_count: i64,
}

#[derive(FromQueryResult)]
struct RecentAgentRow {
    id: Uuid,
    name: String,
    mascot: String,
    last_used_at: DateTimeWithTimeZone,
    call_count: i64,
}

impl From<RecentAgentRow> for RecentAgentResponse {
    fn from(row: RecentAgentRow) -> Self {
        Self {
            id: row.id.to_string(),
            name: row.name,
            mascot: row.mascot,
            last_used_at: row.last_used_at,
            call_count: row.call_count,
        }
    }
}

/// The agents this user has actually called, most recent first.
///
/// Derived from `calls`, not from a `last_used_at` column on `agents`: the
/// call history already records when each agent was used, and a denormalised
/// column would be a second copy of that fact for every write path to keep
/// in step. An INNER JOIN is what limits this to agents with a call — an
/// agent that has never run is not "recently used".
///
/// The one agent endpoint still in ferry: everything else (create/read/
/// update/delete on `agents`) is now plain client-side CRUD straight
/// against Postgres via PostgREST, RLS-scoped to the caller — but this is a
/// join-plus-aggregate (MAX/COUNT/GROUP BY) that PostgREST's row-level API
/// can't express without a database view or RPC function, neither of which
/// exist yet.
///
/// Deleting an agent nulls `calls.agent_id` (the history keeps its name
/// snapshot), so a deleted agent drops out of here on its own.
pub async fn get_recent_agents(
    Extension(session): Extension<UserSession>,
) -> Result<ApiResponse<Vec<RecentAgentResponse>>, ApiResponse<()>> {
    let rows = agents::Entity::find()
        .select_only()
        .columns([
            agents::Column::Id,
            agents::Column::Name,
            agents::Column::Mascot,
        ])
        .column_as(calls::Column::CreatedAt.max(), "last_used_at")
        .column_as(calls::Column::Id.count(), "call_count")
        .join_rev(JoinType::InnerJoin, calls::Relation::Agents.def())
        // Both sides are filtered by user: the agent filter is the
        // authorization check, the call filter keeps the aggregates honest if
        // a row ever crosses users.
        .filter(agents::Column::UserId.eq(session.user_id))
        .filter(calls::Column::UserId.eq(session.user_id))
        // Grouping by the primary key is enough for Postgres to accept the
        // other agent columns in the select list.
        .group_by(agents::Column::Id)
        .order_by_desc(calls::Column::CreatedAt.max())
        .limit(RECENT_AGENT_LIMIT)
        .into_model::<RecentAgentRow>()
        .all(db::get())
        .await
        .map_err(|e| {
            tracing::error!("get_recent_agents: failed to list agents: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    Ok(ApiResponse::ok(
        StatusCode::OK,
        rows.into_iter().map(RecentAgentResponse::from).collect(),
    ))
}
