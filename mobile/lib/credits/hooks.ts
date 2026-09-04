import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCreditBalance, getCreditHistory } from "@/lib/credits/api";
import type { CreditHistoryEntry } from "@/lib/credits/types";
import { useAuth } from "@/hooks/use-auth";

export const creditBalanceQueryKey = ["credits", "balance"] as const;

/**
 * The signed-in user's current credit balance. Disabled while signed out,
 * same reasoning as `useRecentCalls`: the underlying query is scoped by
 * `currentUserId()`, which throws without a session, so a guest would
 * otherwise see that thrown error dressed up as a load failure.
 */
export function useCreditBalance() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: creditBalanceQueryKey,
    queryFn: getCreditBalance,
    enabled: isAuthenticated,
  });
}

export const creditHistoryQueryKey = ["credits", "history"] as const;

/**
 * Infinite-scrolling credits history — same shape as `useRecentCalls`.
 * `getNextPageParam` returns undefined once ferry stops sending a cursor,
 * which is what makes `hasNextPage` false and stops the list at the end.
 */
export function useCreditHistory() {
  const { isAuthenticated } = useAuth();

  const query = useInfiniteQuery({
    queryKey: creditHistoryQueryKey,
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
