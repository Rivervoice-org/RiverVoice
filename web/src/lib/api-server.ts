import { headers } from "next/headers";

import { request } from "@/lib/api";

/**
 * Harbor as the Next server reaches it, which need not be the URL the browser
 * uses: in a container network the public hostname often does not resolve from
 * inside.
 */
const BASE_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** A slow harbor should not hold the page hostage; the client can retry. */
const TIMEOUT_MS = 3000;

/**
 * The session rides on the cookie; the rest is so harbor sees the person who
 * asked rather than this server. Without them every server-rendered request
 * looks like it came from one machine, which makes rate limits and audit logs
 * useless.
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
 */
export async function serverGet<T>(path: string): Promise<T> {
  return request<T>(path, {
    baseUrl: BASE_URL,
    headers: await forwardedHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
