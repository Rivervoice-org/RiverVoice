import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import { currentUserId, supabase } from "@/lib/supabase";
import type {
  CreditBalance,
  CreditBalanceRow,
  CreditHistoryResponse,
} from "@/lib/credits/types";

type BalanceRow = Pick<CreditBalanceRow, "balance_credits" | "updated_at">;

/**
 * Reads `credit_balances` directly via PostgREST — same pattern as
 * `lib/calls/api.ts`'s `getRecentCalls`: ferry (`BillingObserver`) is the
 * only writer, the client only ever reads its own row, scoped by RLS to
 * `auth.uid()` as well as the query itself.
 *
 * No row is a real, common state — nobody has ever been charged, topped up,
 * or granted anything yet — not an error, so `.maybeSingle()` rather than
 * `.single()`. It reads as a zero balance, same as a fresh account should.
 */
export async function getCreditBalance(): Promise<CreditBalance> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("credit_balances")
    .select("balance_credits, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const row = data as BalanceRow | null;
  return {
    remaining: row?.balance_credits ?? 0,
    updatedAt: row?.updated_at ?? new Date(0).toISOString(),
  };
}

/**
 * Hits ferry's `GET /v1/credits/history` (see
 * ferry/src/http/handlers/credits.rs) — the grouping of per-stage
 * (stt/mt/tts) charges into one row per call/session is a GROUP BY
 * PostgREST's row-level API can't express, so this went the same route as
 * `getRecentAgents`. `before` is the previous page's `nextBefore`, same
 * cursor contract `getRecentCalls` uses.
 */
export function getCreditHistory(
  before?: string,
): Promise<CreditHistoryResponse> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return ferry.get<CreditHistoryResponse>(
    `/v1/credits/history${query}`,
    authHeader(),
  );
}
