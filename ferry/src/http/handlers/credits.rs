use axum::extract::{Extension, Query};
use axum::http::StatusCode;
use sea_orm::prelude::DateTimeWithTimeZone;
use sea_orm::{ConnectionTrait, DatabaseBackend, QueryResult, Statement};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::token::UserSession;
use crate::db;
use crate::db::entity::agents::Language;
use crate::db::entity::credit_ledger::{CallType, EntryType};
use crate::http::response::ApiResponse;

const GENERIC_SERVER_ERROR: &str = "Something went wrong. Please try again.";

/// Same page size `lib/calls/api.ts`'s `getRecentCalls` uses for the same
/// kind of infinite-scrolling list.
const HISTORY_PAGE_SIZE: i64 = 50;

#[derive(Deserialize)]
pub struct CreditHistoryQuery {
    /// The previous page's `next_before` — opaque to the client, same
    /// contract as `getRecentCalls`'s `before` cursor.
    before: Option<String>,
}

/// `created_at|group_key` — same shape as `getRecentCalls`'s
/// `created_at|id` cursor, with `group_key` as the tiebreak for the (rare,
/// but possible) case of two groups whose most recent charge landed in the
/// same instant.
fn encode_cursor(created_at: &str, group_key: &str) -> String {
    format!("{created_at}|{group_key}")
}

fn decode_cursor(cursor: &str) -> Option<(&str, &str)> {
    let (created_at, group_key) = cursor.split_once('|')?;
    Some((created_at, group_key))
}

/// One row (or one call's worth of rows, summed) in Credits History. What
/// used to be `lib/credits/api.ts`'s `getCreditHistory` doing this grouping
/// client-side in JS, now done once in SQL: PostgREST has no GROUP BY, and
/// grouping in JS meant fetching every underlying stt/mt/tts row over the
/// wire just to collapse them again on-device.
#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreditHistoryEntryResponse {
    /// `call:<call_id>` for a grouped call/session summary, the ledger row's
    /// own id otherwise — same scheme the client used to build itself.
    pub id: String,
    pub entry_type: EntryType,
    pub call_type: Option<CallType>,
    pub is_call_summary: bool,
    #[ts(type = "number")]
    pub amount_credits: i64,
    pub agent_name: Option<String>,
    pub input_language: Option<Language>,
    pub output_language: Option<Language>,
    /// Raw `BillingObserver` note ("stt"/"mt"/"tts") for a standalone charge
    /// row; null for a grouped summary or any non-charge entry — display
    /// labels live client-side (`lib/credits/format.ts`), not here.
    pub stage: Option<String>,
    pub created_at: DateTimeWithTimeZone,
}

#[derive(Serialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreditHistoryResponse {
    pub entries: Vec<CreditHistoryEntryResponse>,
    /// Pass back as `before` to fetch the next page; null once this was the
    /// last one — same contract as `RecentCallsResponse::nextBefore`.
    pub next_before: Option<String>,
}

fn parse_entry_type(raw: &str) -> EntryType {
    match raw {
        "topup" => EntryType::Topup,
        "refund" => EntryType::Refund,
        "bonus" => EntryType::Bonus,
        "adjustment" => EntryType::Adjustment,
        // Every group this query produces is either a real charge or a
        // single non-charge row read back as-is, so anything else here is a
        // charge by elimination.
        _ => EntryType::Charge,
    }
}

fn parse_call_type(raw: &str) -> CallType {
    match raw {
        "try_agent" => CallType::TryAgent,
        _ => CallType::PhoneCall,
    }
}

fn parse_language(raw: &str) -> Language {
    match raw {
        "hi" => Language::Hindi,
        "te" => Language::Telugu,
        "ta" => Language::Tamil,
        "kn" => Language::Kannada,
        _ => Language::English,
    }
}

/// The entry, plus the raw `group_key` this row's page-cursor is built
/// from — `group_key` has no place on the response DTO itself, it is
/// implementation detail of how rows were collapsed, not something the
/// client renders.
struct Row {
    entry: CreditHistoryEntryResponse,
    group_key: String,
}

fn row_to_entry(row: &QueryResult) -> db::Result<Row> {
    let group_key: String = row.try_get("", "group_key")?;
    let is_call_summary: bool = row.try_get("", "is_call_summary")?;
    let call_id: Option<Uuid> = row.try_get("", "call_id")?;
    let ledger_id: i64 = row.try_get("", "ledger_id")?;
    let id = match call_id {
        Some(call_id) => format!("call:{call_id}"),
        None => ledger_id.to_string(),
    };

    let entry_type_raw: String = row.try_get("", "entry_type")?;
    let call_type_raw: Option<String> = row.try_get("", "call_type")?;
    let input_language_raw: Option<String> = row.try_get("", "input_language")?;
    let output_language_raw: Option<String> = row.try_get("", "output_language")?;

    Ok(Row {
        entry: CreditHistoryEntryResponse {
            id,
            entry_type: parse_entry_type(&entry_type_raw),
            call_type: call_type_raw.as_deref().map(parse_call_type),
            is_call_summary,
            amount_credits: row.try_get("", "amount_credits")?,
            agent_name: row.try_get("", "agent_name")?,
            input_language: input_language_raw.as_deref().map(parse_language),
            output_language: output_language_raw.as_deref().map(parse_language),
            stage: row.try_get("", "stage")?,
            created_at: row.try_get("", "created_at")?,
        },
        group_key,
    })
}

/// Credits History, grouped server-side: every charge row sharing a
/// `call_id` (one phone call, or — once `try_agent.rs` starts writing
/// `try_agent_sessions` — one try-agent session) collapses into a single
/// summed row, the same rule `getCreditHistory` used to apply in JS after
/// fetching every row individually. A row with no `call_id` (a non-charge
/// entry, or a try-agent charge from before that wiring exists) is its own
/// group of one, via the `'row:' || id` fallback in `group_key`.
///
/// Raw SQL, not the query builder: `get_recent_agents` already set the
/// precedent for reaching past PostgREST's row-level API for a join+
/// aggregate it can't express, but this grouping key — "this call's id, or
/// else this row's own id" — has no query-builder equivalent either.
pub async fn get_credit_history(
    Extension(session): Extension<UserSession>,
    Query(query): Query<CreditHistoryQuery>,
) -> Result<ApiResponse<CreditHistoryResponse>, ApiResponse<()>> {
    // Cursor filter lives outside the GROUP BY (it compares each group's own
    // aggregated created_at/group_key, not a raw column), so the grouping
    // has to happen in a CTE the outer query can then filter, order, and
    // page against — same reason `getRecentCalls` pages by a
    // (created_at, tiebreak) cursor rather than an offset: new charges land
    // at the head of this list too, and an offset would skip or repeat rows
    // as the user scrolls.
    let cursor = query.before.as_deref().and_then(decode_cursor);
    let cursor_created_at = cursor.map(|(created_at, _)| created_at);
    let cursor_group_key = cursor.map(|(_, group_key)| group_key).unwrap_or("");

    let rows = db::get()
        .query_all_raw(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            with grouped as (
              select
                coalesce(l.call_id::text, 'row:' || l.id::text) as group_key,
                bool_or(l.call_id is not null) as is_call_summary,
                max(l.call_id) as call_id,
                max(l.id) as ledger_id,
                max(l.entry_type::text) as entry_type,
                max(l.call_type::text) as call_type,
                sum(l.amount_credits) as amount_credits,
                max(l.created_at) as created_at,
                max(l.note) filter (where l.call_id is null) as stage,
                max(c.agent_name) as agent_name,
                max(c.input_language::text) as input_language,
                max(c.output_language::text) as output_language
              from credit_ledger l
              left join calls c on c.id = l.call_id and l.call_type = 'phone_call'
              where l.user_id = $1
              group by group_key
            )
            select *
            from grouped
            where $2::timestamptz is null
               or created_at < $2::timestamptz
               or (created_at = $2::timestamptz and group_key < $3)
            order by created_at desc, group_key desc
            limit $4
            "#,
            [
                session.user_id.into(),
                cursor_created_at.into(),
                cursor_group_key.into(),
                // One extra row over the page size: whether it comes back is
                // how "is there a next page" is detected, instead of a
                // second COUNT(*) over the user's whole ledger.
                (HISTORY_PAGE_SIZE + 1).into(),
            ],
        ))
        .await
        .map_err(|e| {
            tracing::error!("get_credit_history: query failed: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    let mut rows = rows
        .iter()
        .map(row_to_entry)
        .collect::<db::Result<Vec<_>>>()
        .map_err(|e| {
            tracing::error!("get_credit_history: failed to read a row: {e}");
            ApiResponse::fail(StatusCode::INTERNAL_SERVER_ERROR, GENERIC_SERVER_ERROR)
        })?;

    let has_more = rows.len() > HISTORY_PAGE_SIZE as usize;
    if has_more {
        rows.truncate(HISTORY_PAGE_SIZE as usize);
    }
    let next_before = has_more
        .then(|| rows.last())
        .flatten()
        .map(|row| encode_cursor(&row.entry.created_at.to_rfc3339(), &row.group_key));

    Ok(ApiResponse::ok(
        StatusCode::OK,
        CreditHistoryResponse {
            entries: rows.into_iter().map(|row| row.entry).collect(),
            next_before,
        },
    ))
}
