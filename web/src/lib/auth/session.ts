import { cookies } from "next/headers";

import { mockMe } from "@/lib/mock-data";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import type { Me } from "@/lib/auth/types";

/** No backend to ask anymore — "logged in" just means the mock cookie is set. */
export const getSession = async (): Promise<Me | null> => {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE) ? mockMe : null;
};
