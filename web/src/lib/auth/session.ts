import { cache } from "react";

import { serverGet } from "@/lib/api-server";
import type { Me } from "@/lib/auth/types";

/**
 * Who is asking, according to harbor. Null covers every way of not knowing —
 * no cookie, an expired one, or harbor being unreachable. A gate that cannot
 * verify has to assume the worst; the alternative is letting a network blip
 * open the door.
 *
 * Cached for the request, so a layout and a page asking both cost one call.
 */
export const getSession = cache(async (): Promise<Me | null> => {
  try {
    return await serverGet<Me>("/v1/me");
  } catch {
    return null;
  }
});
