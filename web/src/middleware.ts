import { NextResponse, type NextRequest } from "next/server";

/**
 * Nothing is gated. There is no auth provider wired up yet, so the session
 * check only ever bounced people to /sign-in with no way to get back — /home,
 * /agents and /build-agent are all reachable directly.
 *
 * When a real provider lands, gate on a verified session here rather than on
 * the presence of a cookie.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

/** Matches nothing, so this never runs. */
export const config = {
  matcher: [],
};
