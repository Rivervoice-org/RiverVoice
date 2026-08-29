import { useMemo } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getCallDetail, getRecentCalls } from "@/lib/calls/api";
import type { CallListItem } from "@/lib/calls/types";
import { useAuth } from "@/hooks/use-auth";

export const recentCallsQueryKey = ["calls", "recent"] as const;

/**
 * Infinite-scrolling call history.
 *
 * `getNextPageParam` returns undefined once ferry stops sending a cursor,
 * which is what makes `hasNextPage` false and stops the list fetching at the
 * end — the endpoint distinguishes "last page" from "an empty page", so the
 * list never has to probe with a request that returns nothing.
 *
 * Like `useAgents`, disabled while signed out: `GET /v1/calls` is
 * require_user-gated, so a guest would otherwise see a 401 dressed up as a
 * load failure.
 */
export function useRecentCalls() {
  const { isAuthenticated } = useAuth();

  const query = useInfiniteQuery({
    queryKey: recentCallsQueryKey,
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      getRecentCalls(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
    enabled: isAuthenticated,
  });

  // Flattened once per fetch rather than on every render — this feeds a
  // FlatList, and a new array identity each render would defeat its
  // memoization on every unrelated state change.
  const calls = useMemo<CallListItem[]>(
    () => query.data?.pages.flatMap((page) => page.calls) ?? [],
    [query.data],
  );

  return { ...query, calls };
}

export const callDetailQueryKey = (id: string) => ["calls", "detail", id] as const;

/**
 * One call in full, transcript included.
 *
 * Kept separate from the list query rather than derived from its cache: the
 * list carries a deliberately narrow projection, so the recording, cost,
 * lifecycle timestamps and utterances only exist here.
 */
export function useCallDetail(id: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: callDetailQueryKey(id ?? ""),
    queryFn: () => getCallDetail(id as string),
    enabled: isAuthenticated && !!id,
  });
}
