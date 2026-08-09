"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

/**
 * The url as page state. A list keeps its search and its page here rather than
 * in component state, so a refresh, a shared link and the back button all land
 * on what the person was actually looking at.
 */
export function useNavigationContext() {
  const router = useRouter();
  const pathname = usePathname();
  const current = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const navigate = useCallback(
    ({ searchParams, replace = false }: { searchParams: URLSearchParams; replace?: boolean }) => {
      const query = searchParams.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        // Paging a table halfway down a page should not throw you to the top.
        if (replace) router.replace(href, { scroll: false });
        else router.push(href, { scroll: false });
      });
    },
    [router, pathname],
  );

  // A copy, so callers can set and delete freely: the one from Next is frozen.
  const searchParams = useMemo(() => new URLSearchParams(current), [current]);

  return { pathname, searchParams, navigate, isNavigating };
}
