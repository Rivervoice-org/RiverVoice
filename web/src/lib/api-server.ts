import { headers } from "next/headers";

import { request } from "@/lib/api";

/**
 * Harbor as the Next server reaches it, which need not be the URL the browser
 * uses: in a container network the public hostname often does not resolve from
 * inside, and routing back out through it would be a pointless round trip.
 */
const BASE_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** A slow harbor should not hold the page hostage; the client can retry. */
const TIMEOUT_MS = 3000;

/**
 * The caller's identity, carried through to harbor. The cookie is what the
 * session actually rides on; the rest is so harbor sees the person who asked
 * rather than this server — without them every server-rendered request appears
 * to come from one machine, which makes rate limits and audit logs useless.
 */
async function forwardedHeaders() {
  const incoming = await headers();

  return Object.fromEntries(
    (["cookie", "user-agent", "x-forwarded-for", "x-real-ip"] as const)
      .map((name) => [name, incoming.get(name)])
      .filter(([, value]) => value),
  ) as Record<string, string>;
}

/**
 * The same request the browser makes, minus the one thing the server cannot do
 * for itself: there is no cookie jar in node, so the session has to be read off
 * the incoming request and re-sent by hand.
 *
 * Reading headers opts the route into dynamic rendering, which is the point:
 * this is per-user data and must never be prerendered.
 */
export async function serverGet<T>(path: string): Promise<T> {
  return request<T>(path, {
    baseUrl: BASE_URL,
    headers: await forwardedHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
