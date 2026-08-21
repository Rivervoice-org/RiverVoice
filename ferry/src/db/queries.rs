use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::models::{Agent, AgentVersion};
use crate::db::schema::{agent_versions, agents};

pub async fn get_agent(
    pool: &diesel_async::pooled_connection::deadpool::Pool<diesel_async::AsyncPgConnection>,
    agent_id: Uuid,
    caller_org_id: Uuid,
) -> anyhow::Result<Option<Agent>> {
    let mut conn = pool.get().await?;

    let agent = agents::table
        .filter(agents::id.eq(agent_id))
        .filter(agents::org_id.eq(caller_org_id))
        .select(Agent::as_select())
        .first(&mut conn)
        .await
        .optional()?;

    Ok(agent)
}

pub async fn get_agent_version(
    pool: &diesel_async::pooled_connection::deadpool::Pool<diesel_async::AsyncPgConnection>,
    agent_id: Uuid,
    version: i32,
    caller_org_id: Uuid,
) -> anyhow::Result<Option<AgentVersion>> {
    let mut conn = pool.get().await?;

    let agent_version = agent_versions::table
        .filter(agent_versions::agent_id.eq(agent_id))
        .filter(agent_versions::version.eq(version))
        .filter(agent_versions::org_id.eq(caller_org_id))
        .select(AgentVersion::as_select())
        .first(&mut conn)
        .await
        .optional()?;

    Ok(agent_version)
}
