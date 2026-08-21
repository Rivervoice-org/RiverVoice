# Working in this repo

Read [README.md](README.md) first — it explains what the services are and how a
call flows through them. This file is the other half: the conventions a change
has to follow, and the traps that have already cost someone an afternoon.

`web/AGENTS.md` is written by `next dev` and is about the Next.js version. Leave
it alone; committing it alongside your work keeps the tree clean.

---

## The short version

- **Server components fetch; client components react.** Page-load data comes
  down as props. React Query is for what happens after load.
- **The session gate lives on the server**, in a layout, before anything renders.
- **A list keeps its state in the url**, not in component state.
- Verify with `npx tsc --noEmit` and `npx eslint src` in `web/`. Both are expected to be silent.

---

## web

### Where data is fetched

| | who fetches | when |
|---|---|---|
| Needed at first paint | server component, `await` | during render |
| Filters, paging, polling | React Query, in a client component | after hydration |
| Anything a click causes | `useMutation` | on the event |

Server components can't use hooks, and client components can't be `async`. The
line is not "which page" — it's "which component", and a server page routinely
renders client children that hold queries.

`useQuery` fetches on mount, and mount is an effect, so **it does not run during
SSR**. A client component with a query renders its empty state on the server
unless a server parent handed it the data.

**Don't server-render data that changes by the second.** Live call state is wrong
by the time it hydrates, and showing stale-but-confident data reads as a bug.
Server-render the frame; let the live parts connect on their own.

### API clients

Two clients, and the difference matters:

- [`lib/api.ts`](web/src/lib/api.ts) — the browser. `credentials: "include"`, so
  the browser attaches the session cookie itself.
- [`lib/api-server.ts`](web/src/lib/api-server.ts) — the Next server. There is no
  cookie jar in node, so it reads `cookie` off the incoming request and re-sends
  it, along with `x-forwarded-for` and friends so the backend sees the caller rather
  than this machine.

Using `api.ts` from a server component fails **silently** — no build error, no
cookie, a 401. In a server component, always `serverGet`.

Wrap server fetchers in React's `cache()` so several components asking cost
the backend one call. See [`lib/agents/server.ts`](web/src/lib/agents/server.ts).

### Auth

The gate is `await getSession()` and `redirect()` in a layout — see
[`(app)/layout.tsx`](<web/src/app/(app)/layout.tsx>). A signed-out visitor gets a
307 and never receives the shell, the bundle, or a blank frame.

There is no client-side session guard, and there should not be. A check that runs
after hydration blocks first paint on a round trip and throws away the work the
server already did.

The account is read once and passed into [`UserProvider`](web/src/providers/user-provider.tsx);
client components read it with `useUserContext()`.

**Sign-in and sign-out are hard navigations** (`window.location.replace`), not
`router.push`. A soft navigation leaves the query cache and the router's
prefetched pages in memory, and the next session starts on the last one's data.

Two things the gate cannot do, so they live elsewhere: catching a session that
expires while a tab is open (needs a 401 interceptor in `api.ts`), and working at
all in production if the session cookie is host-scoped to a different domain than
web — it must share a parent domain, or the backend must be proxied through Next.

### Lists

The url is the state. `/agents?q=desk&page=2` survives a refresh, a shared link
and the back button.

- [`useNavigationContext()`](web/src/hooks/use-navigation-context.ts) hands back a
  writable `searchParams` copy, `navigate`, and `isNavigating` for the pending
  state.
- Mutate the copy, then navigate. **Delete `page` whenever the filter changes**,
  or a narrowed search lands on a page that no longer exists.
- Search uses `replace`; paging uses `push`. Debounced keystrokes with `push`
  make Back replay your own typing.
- Leave defaults out of the url, so `/agents` stays clean until someone acts.

`DataTable` has a server mode, in TanStack's own vocabulary: `rowCount`,
`pagination`, `onPaginationChange`, `searchQuery`, `onSearch`, `isPending`.
Supplying `pagination` turns on `manualPagination`; supplying `onSearch` turns on
`manualFiltering`. Without them it filters and pages in the browser, which is
right for a list that arrives whole.

### Toasts

[`lib/toast.ts`](web/src/lib/toast.ts) exports `toast.success` / `.error` /
`.warn` / `.message`. It's created outside React, so non-component code — the
fetch layer, for one — can post to it. Errors don't auto-dismiss; a five-second
error is one you can miss.

Report where the person is looking: a failure inside an open dialog belongs in
the dialog, not in a corner.

---

## Traps already paid for

**Two calls to a controlled table.** `table.setPageSize(n)` followed by
`table.setPageIndex(0)` raises two pagination changes, and the second is computed
from the prop the first hasn't updated yet — so the new size is written and
immediately overwritten. One `table.setPagination({...})` instead.

**Base UI inputs are stricter than plain ones.** `defaultValue` alongside a
`value` that is sometimes `undefined` is tolerated by a raw `<input>` and warns
loudly here. Pick controlled or uncontrolled and stay there.

**Relative timestamps break hydration.** "29 seconds ago" on the server is "31
seconds ago" in the browser. Wrap them in `<time dateTime={iso}
suppressHydrationWarning>`.

**`router.refresh()` is how a mutation updates a server-rendered list.** There is
no client cache holding those rows to invalidate. Call it before `push`, or the
stale list is what greets you on the way back.

**A missing query key match fails silently.** Prefetching `["agents"]` and
reading `["agents", orgId]` doesn't error — it just fetches twice. If you use
hydration, check the network tab for a duplicate request.

**`force-dynamic` is worth stating** even when a `cookies()` call already implies
it. If a refactor removes the implicit trigger, the route can go static and serve
one tenant's html to everyone.

---

## Style

Comments explain **why**, never what. If the line above it says the same thing
the code does, delete it. The ones worth keeping record a decision someone would
otherwise undo: why a call is ordered the way it is, why a bound exists, what
breaks if you "simplify" it.

Prose in comments, not shorthand. Full sentences, lowercase identifiers as they
appear in code.
