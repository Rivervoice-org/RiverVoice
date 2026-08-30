import { supabase } from "@/lib/supabase";

/**
 * Mirrors the Supabase client's current access token in memory so
 * `authHeader()` can stay synchronous — every existing call site
 * (lib/agents/api.ts, lib/calls/api.ts, lib/webrtc/signaling.ts) calls it
 * inline while building a request, and `supabase.auth.getSession()` is
 * async. The Supabase client itself owns persistence and refresh
 * (AsyncStorage, autoRefreshToken — see lib/supabase.ts); this is just a
 * read-through cache of whatever it currently holds, kept in sync via
 * onAuthStateChange rather than tokens.ts managing storage itself.
 */
let currentAccessToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  currentAccessToken = session?.access_token ?? null;
});

/** Headers for a request to a protected ferry route. Empty if signed out. */
export function authHeader(): Record<string, string> {
  return currentAccessToken
    ? { Authorization: `Bearer ${currentAccessToken}` }
    : {};
}

/**
 * Invalidates the mirrored token immediately, synchronously — call this
 * before `supabase.auth.signOut()`'s awaited work runs, so a request fired
 * in that gap can't go out authenticated as the user who's in the middle of
 * signing out. `onAuthStateChange` will reach the same state shortly after,
 * this just closes the window before then.
 */
export function clearAccessToken(): void {
  currentAccessToken = null;
}
