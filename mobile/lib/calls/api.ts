import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import type { CallDetail, RecentCallsResponse } from "@/lib/calls/types";

/** Ferry caps `limit` at 100 and rejects anything above it rather than
 * clamping, so this has to stay within that bound. */
export const RECENT_CALLS_PAGE_SIZE = 20;

/**
 * Hits ferry's `GET /v1/calls` (see ferry/src/http/handlers/call.rs).
 * Protected route, newest first, scoped server-side to the caller.
 *
 * `before` is a cursor, not an offset: it is the `nextBefore` timestamp from
 * the previous page. Paging by position would duplicate or skip rows when a
 * call is placed while the user is scrolling, since new calls are inserted at
 * the head of this list.
 */
export function getRecentCalls(before?: string): Promise<RecentCallsResponse> {
  const params = new URLSearchParams({ limit: String(RECENT_CALLS_PAGE_SIZE) });
  if (before) params.set("before", before);
  return ferry.get<RecentCallsResponse>(`/v1/calls?${params.toString()}`, authHeader());
}

/**
 * Hits ferry's `GET /v1/calls/{id}`. Returns the call in full plus its
 * transcript — everything the list omits. Ferry scopes the lookup to the
 * caller inside the query, so another user's call is a 404, not a 403.
 */
export function getCallDetail(id: string): Promise<CallDetail> {
  return ferry.get<CallDetail>(`/v1/calls/${id}`, authHeader());
}
