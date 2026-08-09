import { cookies } from "next/headers";

import { ApiError } from "@/lib/api";

/**
 * Harbor as the Next server reaches it, which need not be the URL the browser
 * uses: in a container network or a private VPC the public hostname often does
 * not resolve from inside.
 */
const BASE_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/** Harbor's session cookie. Only this one is forwarded — the rest are ours. */
const SESSION_COOKIE = "rv_session";

type APIResponse<T> = {
  statusCode: number;
  data?: T;
  error?: { message: string };
};

/**
 * A GET issued from the Next server on the caller's behalf. The browser attaches
 * the session cookie on its own; here it has to be read off the incoming request
 * and re-sent by hand.
 *
 * Reading cookies opts the route into dynamic rendering, which is the point:
 * this is per-user data and must never be prerendered.
 */
export async function serverGet<T>(path: string): Promise<T> {
  const session = (await cookies()).get(SESSION_COOKIE);

  // No cookie means no session; harbor would only tell us the same thing.
  if (!session) throw new ApiError("Not signed in", 401);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        cookie: `${SESSION_COOKIE}=${session.value}`,
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Could not reach the server", 0);
  }

  const body: APIResponse<T> | null = await response.json().catch(() => null);

  if (!response.ok || body?.error) {
    throw new ApiError(body?.error?.message ?? "Something went wrong", response.status);
  }

  return body?.data as T;
}
