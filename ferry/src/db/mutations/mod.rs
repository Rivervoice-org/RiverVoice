//! The only two writes ferry ever makes to billing data, both SECURITY
//! DEFINER functions (harbor/db/migrations/0009_credits.sql) — app_worker
//! has no table-level insert/update grant on call_usage, org_credits, or
//! credit_transactions, only `execute` on these. dsl.rs holds the raw
//! diesel bindings against those existing functions; calls.rs is what the
//! rest of the app should actually import.

mod calls;
mod dsl;

pub use calls::*;
