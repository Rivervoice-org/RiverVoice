import { languageLabel } from "@/lib/calls/format";
import type { CallRow } from "@/lib/calls/types";
import { currentUserId, supabase } from "@/lib/supabase";
import type {
  CreditBalance,
  CreditBalanceRow,
  CreditHistoryEntry,
  CreditLedgerRow,
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

export const CREDIT_HISTORY_PAGE_SIZE = 50;

type LedgerCallEmbed = Pick<
  CallRow,
  "agent_name" | "input_language" | "output_language"
>;

type LedgerRow = Pick<
  CreditLedgerRow,
  | "id"
  | "call_id"
  | "call_type"
  | "entry_type"
  | "amount_credits"
  | "note"
  | "created_at"
> & {
  // PostgREST embeds a forward many-to-one relationship (this table holds
  // the FK) as a single object — but the generated type marks
  // credit_ledger_call_id_fkey non-one-to-one (many ledger rows can share a
  // call_id) and infers an array either way, so both shapes are handled by
  // `oneCall` below rather than trusted blindly.
  calls: LedgerCallEmbed | LedgerCallEmbed[] | null;
};

function oneCall(
  embed: LedgerCallEmbed | LedgerCallEmbed[] | null,
): LedgerCallEmbed | null {
  if (!embed) return null;
  return Array.isArray(embed) ? (embed[0] ?? null) : embed;
}

/**
 * Reads `credit_ledger` via PostgREST, joined forward to `calls` for a
 * phone-call charge's agent/language — same embedding technique
 * `getCallDetail` uses for `call_utterances`, just the other direction
 * (many ledger rows can point at one call, not one call embedding many).
 *
 * Every charge row sharing a `call_id` is summed into one `isCallSummary`
 * entry client-side, since `BillingObserver` bills per usage stage, not per
 * call. Rows with no `call_id` (a try-agent charge, or any non-charge
 * entry) pass through individually.
 */
export async function getCreditHistory(): Promise<CreditHistoryEntry[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("credit_ledger")
    .select(
      "id, call_id, call_type, entry_type, amount_credits, note, created_at, calls ( agent_name, input_language, output_language )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(CREDIT_HISTORY_PAGE_SIZE);
  if (error) throw error;

  const rows = data as unknown as LedgerRow[];
  const grouped = new Map<string, CreditHistoryEntry>();
  const standalone: CreditHistoryEntry[] = [];

  for (const row of rows) {
    const call = oneCall(row.calls);
    const entry: CreditHistoryEntry = {
      id: String(row.id),
      entryType: row.entry_type,
      callType: row.call_type,
      isCallSummary: false,
      amountCredits: row.amount_credits,
      agentName: call?.agent_name ?? null,
      language: call
        ? languageLabel(call.input_language, call.output_language)
        : null,
      // Raw BillingObserver note ("stt"/"mt"/"tts") for a standalone charge
      // row; null for anything else — display labels live in
      // lib/credits/format.ts, not here.
      stage: row.entry_type === "charge" ? row.note : null,
      createdAt: row.created_at,
    };

    if (!row.call_id) {
      standalone.push(entry);
      continue;
    }

    const existing = grouped.get(row.call_id);
    if (!existing) {
      grouped.set(row.call_id, {
        ...entry,
        id: `call:${row.call_id}`,
        isCallSummary: true,
        stage: null,
      });
      continue;
    }
    existing.amountCredits += entry.amountCredits;
    // The group's own timestamp tracks the call's most recent charge, so
    // the whole summary sorts (and displays a date/time) by that instead of
    // whichever stage happened to be billed first.
    if (entry.createdAt > existing.createdAt) {
      existing.createdAt = entry.createdAt;
    }
  }

  return [...grouped.values(), ...standalone].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}
