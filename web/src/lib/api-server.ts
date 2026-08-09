import { cookies } from "next/headers";

import { ApiError, request } from "@/lib/api";

const SESSION_COOKIE = "rv_session";

export async function serverGet<T>(path: string): Promise<T> {
  const session = (await cookies()).get(SESSION_COOKIE);

  // No cookie means no session; harbor would only tell us the same thing.
  if (!session) throw new ApiError("Not signed in", 401);

  return request<T>(path, {
    headers: { cookie: `${SESSION_COOKIE}=${session.value}` },
    cache: "no-store",
  });
}
