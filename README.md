# RiverVoice

Voice agents that answer the phone in Indian languages. You describe an agent in
a browser, give it a voice and a few tools, and it takes calls.

Three services, three languages, one Postgres:

| | what it does | stack |
|---|---|---|
| **web** | the builder and dashboard | Next.js, TypeScript |
| **harbor** | accounts, agents, tools — everything that persists | Go, pgx |
| **ferry** | the live call: telephony, speech, audio | Rust, axum, tokio |

The split is by *shape of work*, not by fashion. harbor answers HTTP requests and
writes rows. ferry holds thousands of open sockets and moves audio frames with a
latency budget measured in milliseconds. Those want different runtimes.

---

## Contents

- [The shape of the system](#the-shape-of-the-system)
- [Running it](#running-it)
- [web](#web)
- [harbor](#harbor)
- [ferry](#ferry)
- [The database](#the-database)
- [Multi-tenancy, in depth](#multi-tenancy-in-depth)
- [Migrations](#migrations)
- [Type safety across the stack](#type-safety-across-the-stack)
- [Conventions](#conventions)

---

## The shape of the system

```
                    ┌──────────────────────────────┐
   browser ────────▶│  web        :3000            │
                    │  Next.js — builder, dashboard│
                    └───────────────┬──────────────┘
                                    │ fetch, cookie
                                    ▼
                    ┌──────────────────────────────┐
                    │  harbor     :8080            │
                    │  Go — accounts, agents, tools│
                    └───────────────┬──────────────┘
                                    │ pgx
                                    ▼
                    ┌──────────────────────────────┐
                    │  Postgres   :5432            │
                    │  row-level security per org  │
                    └───────────────▲──────────────┘
                                    │
                    ┌───────────────┴──────────────┐
   phone ──Twilio──▶│  ferry      :3000            │
                    │  Rust — telephony, STT, audio│
                    └──────────────────────────────┘
```

**web never talks to Postgres.** **ferry never talks to harbor.** Both read the
same database, which is the only thing they share.

A call, end to end:

```
caller dials
   │
   ▼
Twilio ──webhook──▶ ferry /dial          returns TwiML with <Stream>
   │
   └──websocket──▶ ferry /audioStream    μ-law frames, both directions
                        │
                        ├──▶ STT provider   (Sarvam)  → partial, final, language
                        ├──▶ LLM                       → what to say
                        └──▶ TTS                       → audio back to the caller
```

---

## Running it

You need Docker, Go 1.25+, Node 20+, and Rust (only for ferry).

```bash
cp .env.example .env          # fill in the passwords
docker compose up -d db       # Postgres, port 5432

cd harbor && go run .         # migrates, then listens on :8080
cd web    && npm run dev      # :3000
cd ferry  && cargo run        # :3000, needs PUBLIC_BASE_URL
```

harbor runs migrations at startup, so a fresh database needs no extra step.

ferry needs a public HTTPS URL Twilio can reach — `cloudflared tunnel --url
http://localhost:3000` and put the result in `PUBLIC_BASE_URL`.

> ferry hardcodes `127.0.0.1:3000`, which is also web's default port. Run one or
> the other, or change [ferry/src/http/http.rs](ferry/src/http/http.rs) — it
> should read a `PORT` env var the way harbor does.

### Environment

```
POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD    superuser, owns the schema
APP_USER_PASSWORD / APP_WORKER_PASSWORD            the two application roles

DATABASE_URL           app_worker — harbor's pool
MIGRATE_DATABASE_URL   postgres   — goose, at startup only

JWT_SECRET             session signing, 32+ bytes
COOKIE_SECURE          false locally, where a Secure cookie would be dropped
WEB_ORIGIN             CORS allow-list
```

Two database URLs because they connect as different roles. See
[Multi-tenancy](#multi-tenancy-in-depth) — it is not optional, it is what makes
the tenant isolation real.

---

## web

Next.js App Router, TypeScript, Tailwind v4, Base UI primitives.

```
src/
  app/
    (auth)/          sign-in, sign-up, verify
    (app)/           home, agents        — the shell with the sidebar
    build-agent/     the builder, its own layout
  components/
    dashboard/       agent board, composer, templates
    builder/         settings, tools, variables, assistant
    ui/              Base UI wrappers — button, dialog, data-table
  lib/
    api.ts           fetch wrapper, credentials: "include"
    agents/          queries and schemas per resource
  mascots/           the agent avatars — art, not components
  motion/            the hand-drawn walkthrough engine
```

**Data fetching** is TanStack Query. One file per resource under `lib/`, holding
the query keys, the hooks, and the types:

```ts
export const agentsQueryKey = ["agents"] as const;

export function useAgents() {
  return useQuery({ queryKey: agentsQueryKey, queryFn: () => api.get<Agent[]>("/v1/agents") });
}
```

**Forms** are TanStack Form with a Zod schema mirroring harbor's validation
tags, so the browser rejects what the server would reject.

**`mascots/` and `motion/` are libraries, not components.** Nothing in them
imports from `components/`, which is what lets the art render server-side, or in
a script that uploads an avatar. `mascots/parts.ts` is path data; `mascots/bot.ts`
is the seeded assembler that picks from it.

---

## harbor

Go, standard library `net/http`, pgx v5, sqlc. No framework.

```
harbor/
  main.go            wiring: migrate, pool, router, serve
  migrate.go         goose, with the SQL embedded
  sqlc.yaml
  db/
    migrations/      the schema — goose applies these
    queries/         what you ask — sqlc reads these
  internal/
    agent/           one package per resource
      handler.go       Handler, NewHandler, Routes
      agent.go         create, list, get, rename, delete
      version.go       draft, commit, publish
      tool.go          tools CRUD
      store.go         error mapping — the SQL lives in db/queries
    auth/            signup, login, sessions, middleware
    db/              AsUser — the RLS transaction helper
    dbgen/           generated by sqlc, do not edit
    httpx/           router, response envelope, CORS, server
    validate/        struct tags to a first human message
```

### One package per resource

Each implements `httpx.RouteGroup`:

```go
type RouteGroup interface{ Routes(*http.ServeMux) }
```

so `httpx` never imports `agent` or `auth` — no cycle, and adding a resource is
one argument in `main.go`:

```go
httpx.NewRouter(pool, sessions, agent.NewHandler(pool, sessions))
```

### Every response is an envelope

```go
type APIResponse[T any] struct {
    StatusCode int    `json:"statusCode"`
    Data       *T     `json:"data,omitempty"`
    Error      *Error `json:"error,omitempty"`
}
```

`httpx.Handle` turns a function returning one of these into an `http.HandlerFunc`,
so handlers never touch `w.WriteHeader` and can't forget the content type.

### Sessions

```
POST /v1/auth/login
   │  bcrypt compare, as app_worker (no session exists yet)
   ▼
HS256 JWT { sub, org, role, exp: +24h }
   │
   ▼
Set-Cookie: rv_session — HttpOnly, SameSite=Lax
```

`RequireSession` verifies it and puts a `Session{UserID, OrgID, Role}` on the
request context. **Only `UserID` is load-bearing** — it goes into `db.AsUser` and
Postgres derives the org itself. `OrgID` and `Role` are claims the browser holds;
they go stale, and they are never used to scope a query.

### Routes

```
POST   /v1/auth/signup                       create an org and its owner
POST   /v1/auth/login
POST   /v1/auth/logout
GET    /v1/me

GET    /v1/agents                            the board
POST   /v1/agents                            create, with an empty v1 draft
GET    /v1/agents/{id}
PATCH  /v1/agents/{id}                       rename, mascot, purpose
DELETE /v1/agents/{id}

GET    /v1/agents/{id}/draft                 the editable version
PATCH  /v1/agents/{id}/draft                 every settings write lands here
POST   /v1/agents/{id}/commit                freeze it, open the next
POST   /v1/agents/{id}/publish               move live_version_id

GET    /v1/agents/{id}/tools
POST   /v1/agents/{id}/tools
PATCH  /v1/agents/{id}/tools/{toolID}
DELETE /v1/agents/{id}/tools/{toolID}
```

---

## ferry

Rust, axum, tokio. Holds the call for its whole duration.

```
ferry/src/
  main.rs
  config.rs        PUBLIC_BASE_URL and the URLs derived from it
  state.rs         AppState — config plus the provider
  retry.rs
  http/
    http.rs        the router
    handlers.rs    dial, audio_stream, twilio_status
    types.rs
  telephony/
    provider.rs    the trait every carrier implements
    twilio/        the one that exists
  stt/
    provider.rs    AudioEncoding, SttEvent, the socket loop
    sarvam/
```

```
POST /dial            place an outbound call
GET  /audioStream     the websocket Twilio connects after <Stream>
POST /twilio/status   call lifecycle callbacks
```

### Providers are traits

`telephony/provider.rs` and `stt/provider.rs` define what a carrier and a speech
service must do; `twilio/` and `sarvam/` implement them. Handlers know neither
name. Swapping Twilio for Exotel is a new module, not a rewrite.

`SttEvent` is the vocabulary the rest of the system speaks:

```rust
enum SttEvent {
    SpeechStart,
    SpeechEnd,
    Partial(String),                                  // superseded by later events
    Final { text: String, language: Option<String> },
}
```

Language comes back on the final event because Indian callers code-switch
mid-sentence, and the agent has to follow.

### Why Rust

A call is a websocket held open for minutes, carrying 8 kHz μ-law frames in both
directions, with a second socket to the STT provider and a third for TTS. Per
call. The work is IO-bound with hard latency limits and no room for a GC pause
during someone's sentence.

Providers drop idle sockets — Sarvam closes with 1008 — so the STT loop sends a
keepalive every 5 seconds.

---

## The database

One Postgres. Two schemas: `public` for tables, `app` for the identity functions
policies read the caller through.

```
orgs ──┬── users
       │
       └── agents ──┬── agent_versions      settings, one row per version
                    └── agent_tools         what the agent can call
```

### Agents version their settings

The agent row holds identity — name, mascot, status. Everything you can tune
lives in `agent_versions`, one row per version:

```
agents
  id, org_id, name, mascot, purpose, status, live_version_id

agent_versions
  id, agent_id, org_id, version, state
  greeting, instructions
  tts_provider, tts_model, voice, speed, pitch
  llm_provider, llm_model, creativity, knowledge_only
  stt_provider, stt_model, interruptible, reply_delay, noise_filter
  languages, starting_language, switch_after, indic_numerals
  background_sound, background_volume
  nudge_quiet_callers, leave_voicemail, max_call_minutes
  system_tools
```

`state` is `draft` or `committed`, and a partial unique index enforces the rule:

```sql
create unique index agent_versions_one_draft on agent_versions (agent_id)
where state = 'draft';
```

**Exactly one editable draft per agent.** Committed versions are frozen — a call
that started on v3 finishes on v3 even if you publish v4 mid-call. Publishing
moves `agents.live_version_id`; rolling back moves it again.

Providers and models are `text`, not enums, because a new one arrives most weeks
and `alter type ... add value` cannot run inside a transaction.

### Tools hang off the agent, not the version

A tool holds credentials. Copying those into every commit would mean rotating a
key in *n* places, so `agent_tools.agent_id` points at the agent.

Kind-specific fields are one `jsonb` column:

```
kind        api | validator | mock
name        lowercase — the model reads it as a function name
description what the model reads to decide whether to call it
trigger     start | during | end
config      jsonb — url, headers, body for api; response, status for a mock
```

Columns per kind would be null for every other kind, and a new kind would mean a
migration rather than a release. `kind` *is* an enum, because a kind is never a
data-only addition — each needs its own form and its own runtime.

---

## Multi-tenancy, in depth

Many orgs share one database. Nothing in Go decides which rows an org can see.

### Three roles

| role | can | why |
|---|---|---|
| `postgres` | DDL, owns every table | runs migrations |
| `app_worker` | DML, **BYPASSRLS** | login and signup, where there is no session yet |
| `app_user` | DML, **RLS applies** | every request on behalf of a signed-in person |

The reason this split is mandatory rather than tidy:

> **A table's owner bypasses row-level security.**

If harbor connected as `postgres`, `postgres` would own the tables and every
policy would be ignored. Org A would see Org B's agents. So the application role
must not own anything.

### The request path

harbor connects **once** as `app_worker` and holds that pool. Per request it
drops to `app_user`:

```go
db.AsUser(ctx, pool, session.UserID, func(tx pgx.Tx) error {
    // no `where org_id` anywhere inside
})
```

which runs:

```sql
begin;
  select set_config('app.user_id', '<verified user id>', true);
  set local role app_user;
  ...your query...
commit;
```

Both are **transaction-local**. The third argument to `set_config` being `true`
is what stops one tenant's identity leaking onto a pooled connection serving the
next request.

### How the policy resolves

```
set_config('app.user_id', 'a3f1…')
   ↓
app.current_user_id()   →  current_setting('app.user_id')       →  'a3f1…'
   ↓
app.current_org_id()    →  select org_id from users where id =  →  'b7c2…'
   ↓
policy: org_id = app.current_org_id()
```

`current_org_id` is `security definer` — it reads `users` before that table's own
policy applies, which would otherwise need the org id it is computing. `set
search_path` beside it stops a shadowed `users` table being read instead.

Unset means NULL, and `org_id = NULL` is never true — a request that forgets an
identity sees **nothing**, not everything.

### Every policy has both halves

```sql
create policy agents_all on agents for all to app_user
  using       (org_id = app.current_org_id())
  with check  (org_id = app.current_org_id());
```

`using` filters rows already there. `with check` validates rows going in. Without
the second, `update agents set org_id = '<other org>'` would move a row into
someone else's tenant — `using` is satisfied, because the row *is* currently
yours.

### What this buys

Handlers contain no `where org_id = $1`. There is no filter to forget, so a new
endpoint cannot leak across tenants by omission. The one remaining failure mode
is forgetting `db.AsUser` entirely, which leaves the query running as
`app_worker` — worth a review habit.

---

## Migrations

goose, embedded in the harbor binary.

```
db/migrations/
  0001_app.sql       extensions, the app schema, current_user_id
  0002_account.sql   orgs, users, current_org_id, current_role, policies
  0003_agents.sql    agents, agent_versions, agent_tools, policies
```

Applied at startup by [migrate.go](harbor/migrate.go), as `postgres`:

```go
//go:embed db/migrations/*.sql
var migrations embed.FS

goose.UpContext(ctx, db, "db/migrations")
```

Embedded means the binary physically contains its schema — you cannot deploy code
whose migrations were left behind. goose tracks what has run in
`goose_db_version` and applies only the gap.

Three things that will bite when you add one:

- **Version 0 is reserved.** Files start at `0001`. goose rejects `0000`.
- **Dollar-quoted bodies need fencing.** goose splits on semicolons, so wrap any
  `create function ... $$ ... $$` in `-- +goose StatementBegin/StatementEnd`.
- **Roles are not migrations.** `app_user` and `app_worker` are cluster-level and
  must exist before anything grants to them, so they live in
  [docker/postgres/init/01-rls.sh](docker/postgres/init/01-rls.sh) — which runs
  **once**, on an empty data directory. Everything database-level belongs in a
  migration instead, so a fresh database can be built from migrations alone.

At more than one replica, move `migrate` out of startup into a deploy step, and
follow expand-then-contract: old and new code run against the same schema for the
minutes a rollout takes, so a migration must work with the code already deployed.

---

## Type safety across the stack

The schema is the source of truth, and types are derived from it rather than
restated.

```
db/migrations/*.sql  ─┐
                      ├── sqlc generate ──▶ internal/dbgen/*.go
db/queries/*.sql     ─┘                       structs, enums, Scan calls
```

You write the SQL and one comment:

```sql
-- name: ListAgents :many
select a.id, a.name, ...
```

sqlc reads your migrations to type every column, so `status` comes back as
`AgentStatus` with Go constants, a nullable column becomes `*string`, and
`text array` becomes `[]string`. Rename a column in a migration, regenerate, and
every call site that is now wrong **fails to compile** instead of returning 500
in production.

```bash
cd harbor && sqlc generate
```

sqlc is a build-time generator, not a dependency — the generated code imports
`pgx`, and nothing in the running binary knows sqlc exists.

The browser end mirrors it by hand: a Zod schema per request matching harbor's
`validate` tags, and a TypeScript type per response matching the generated row.
That seam is the one place drift is still possible.

---

## Conventions

**Comments explain why, not what.** If the code says it, the comment does not.
The ones worth writing are the non-obvious constraints — why `set_config` takes
`true`, why the mouth animation only works on one mascot style, why a stroke
carries `pathLength="1"`.

**One package per resource**, owning its handlers, types, and queries. No
`models/` or `services/` layer — it reads tidy and then every feature touches
three packages for one change.

**Errors are mapped, not pre-checked.** Signup does not query for an existing
email; it inserts and maps `23505` to a 409. Check-then-insert races two
simultaneous requests.

**Commits are small and explain the reasoning.** The subject says what changed,
the body says why it was done that way.

**Pre-commit runs** prettier, gofmt, and rustfmt, plus the usual whitespace and
merge-conflict checks. CI runs one workflow per service, path-filtered so a web
change does not rebuild ferry.
