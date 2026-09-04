import type { CreditEntryType } from "@/lib/credits/types";

/** BillingObserver's own `note` values for a standalone charge row — see
 * ferry/src/observer/billing_observer.rs's `on_push`. Meaningless once
 * several stages are summed into a call summary (`isCallSummary: true`),
 * which is why `CreditHistoryEntry.stage` is null there. */
export function stageLabel(stage: string | null): string {
  switch (stage) {
    case "stt":
      return "Speech-to-text";
    case "mt":
      return "Translation";
    case "tts":
      return "Text-to-speech";
    default:
      return stage ?? "Usage";
  }
}

export function entryTypeLabel(
  entryType: Exclude<CreditEntryType, "charge">,
): string {
  switch (entryType) {
    case "topup":
      return "Recharge";
    case "refund":
      return "Refund";
    case "bonus":
      return "Bonus credit";
    case "adjustment":
      return "Adjustment";
  }
}
