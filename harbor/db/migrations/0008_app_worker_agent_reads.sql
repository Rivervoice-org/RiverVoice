-- +goose Up
-- app_worker (ferry) needs to read agent config to run a call. The
-- existing agents_read/agent_versions_read policies are scoped `to
-- app_user` via app.current_org_id(), which depends on a session-local
-- setting ferry's connections never set — so app_worker sees zero rows
-- through them regardless of table grants. Org scoping for app_worker is
-- enforced in ferry itself (queries::get_agent filters by caller_org_id),
-- not here: this policy is intentionally unconditional.
grant select on agents,
agent_versions to app_worker;

create policy agents_read_worker on agents for
select
  to app_worker using (true);

create policy agent_versions_read_worker on agent_versions for
select
  to app_worker using (true);
