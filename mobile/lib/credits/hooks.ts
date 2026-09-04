import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCreditBalance, getCreditHistory } from "@/lib/credits/api";
import type { CreditHistoryEntry } from "@/lib/credits/types";
import { useAuth } from "@/hooks/use-auth";

// Keyed by email, not just ["credits", "balance"] — the query cache is one
// process-wide QueryClient that outlives sign-out/sign-in (nothing clears
// it on an auth change), so a static key would let one account briefly see
// another's cached balance/history right after switching accounts in the
// same app session. `useAuth()` doesn't expose a user id, only email/name
// (see state/session/context.ts's SessionUser), so email is the stable
// per-account segment available here.
export const creditBalanceQueryKey = (userEmail: string | undefined) =>
  ["credits", "balance", userEmail] as const;

/**
 * The signed-in user's current credit balance. Disabled while signed out,
 * same reasoning as `useRecentCalls`: the underlying query is scoped by
 * `currentUserId()`, which throws without a session, so a guest would
 * otherwise see that thrown error dressed up as a load failure.
 */
export function useCreditBalance() {
  const { isAuthenticated, user } = useAuth();

  return useQuery({
    queryKey: creditBalanceQueryKey(user?.email),
    queryFn: getCreditBalance,
    enabled: isAuthenticated,
  });
}

export const creditHistoryQueryKey = (userEmail: string | undefined) =>
  ["credits", "history", userEmail] as const;

/**
 * Infinite-scrolling credits history — same shape as `useRecentCalls`.
 * `getNextPageParam` returns undefined once ferry stops sending a cursor,
 * which is what makes `hasNextPage` false and stops the list at the end.
 */
export function useCreditHistory() {
  const { isAuthenticated, user } = useAuth();

  const query = useInfiniteQuery({
    queryKey: creditHistoryQueryKey(user?.email),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getCreditHistory(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    enabled: isAuthenticated,
  });

  // Flattened once per fetch rather than on every render — same reasoning
  // `useRecentCalls` gives: this feeds a list, and a new array identity on
  // every render would defeat its memoization on every unrelated state change.
  const entries = useMemo<CreditHistoryEntry[]>(
    () => query.data?.pages.flatMap((page) => page.entries) ?? [],
    [query.data],
  );

  return { ...query, entries };
}
