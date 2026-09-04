/**
 * `CreditHistoryEntry`/`CreditHistoryResponse` come straight from ferry's
 * `GET /v1/credits/history` (see ferry/src/http/handlers/credits.rs) via
 * ts-rs, not from `lib/bindings/supabase.ts` — the grouping (one row per
 * call or try-agent session, not one per stt/mt/tts charge) now happens
 * server-side in SQL, so the response is already what the screen renders.
 */
import type { Tables } from "@/lib/bindings/supabase";

export type { CreditHistoryEntryResponse as CreditHistoryEntry } from "@/lib/bindings/CreditHistoryEntryResponse";
export type { CreditHistoryResponse } from "@/lib/bindings/CreditHistoryResponse";
export type { EntryType as CreditEntryType } from "@/lib/bindings/EntryType";
export type { CallType as CreditCallType } from "@/lib/bindings/CallType";

export type CreditBalanceRow = Tables<"credit_balances">;

export interface CreditBalance {
  /** Never negative in practice, but not clamped here — a real negative
   * balance (a charge that landed after the pre-flight check already let a
   * call start) is meaningful and should surface, not be hidden. */
  remaining: number;
  updatedAt: string;
}
