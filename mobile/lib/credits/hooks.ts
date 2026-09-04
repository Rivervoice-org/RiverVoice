import { useQuery } from "@tanstack/react-query";
import { getCreditBalance, getCreditHistory } from "@/lib/credits/api";
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
 * The most recent `CREDIT_HISTORY_PAGE_SIZE` credits-history entries.
 * Not paginated like `useRecentCalls` — there's no cursor to page by yet,
 * just a fixed-size latest-first read (see `getCreditHistory`).
 */
export function useCreditHistory() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: creditHistoryQueryKey,
    queryFn: getCreditHistory,
    enabled: isAuthenticated,
  });
}
