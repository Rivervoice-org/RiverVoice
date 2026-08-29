import { CallOutcome, type CallRowItem } from "@/components/CallRow";
import { formatDuration } from "@/lib/call-status";
import type { Language } from "@/lib/agents/types";
import type { CallEndReason, CallListItem } from "@/lib/calls/types";
import type { Contact } from "@/state/contacts";

const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
};

/**
 * Last ten digits, ignoring spaces, dashes and country prefix. Contacts come
 * from the device in whatever shape the user typed them ("+91 98450 33120",
 * "098450 33120", "9845033120") while ferry stores strict E.164, so comparing
 * the raw strings would almost never match.
 */
function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

export function buildContactIndex(contacts: Contact[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const contact of contacts) {
    const key = phoneKey(contact.phone);
    // First match wins: duplicates in the address book shouldn't flip the
    // displayed name between renders.
    if (key.length === 10 && !index.has(key)) index.set(key, contact.name);
  }
  return index;
}

/**
 * `endReason` is the call's real terminal state; `CallOutcome` is a display
 * concept. Mapping here rather than storing an outcome column keeps the two
 * from drifting — the server records what happened, the UI decides how to
 * draw it.
 */
export function outcomeOf(endReason: CallEndReason | null): CallOutcome {
  switch (endReason) {
    case "busy":
    case "no_answer":
    case "failed":
      return CallOutcome.Missed;
    case "hung_up_by_a":
    case "hung_up_by_b":
      return CallOutcome.Resolved;
    default:
      // Still dialing/ringing/connected — nothing has gone wrong yet.
      return CallOutcome.Resolved;
  }
}

export function languageLabel(
  input: Language | null,
  output: Language | null,
): string {
  if (!input || !output) return "";
  return `${LANGUAGE_LABELS[input]} → ${LANGUAGE_LABELS[output]}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: number = Date.now()): string {
  const elapsed = now - new Date(iso).getTime();
  if (Number.isNaN(elapsed)) return "";
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

/**
 * `name` stays empty when the number isn't in the address book — CallListItem
 * falls back to the number for its title and shows an outcome avatar instead
 * of initials, which is what an unknown caller should look like.
 */
export function toCallRowItem(
  call: CallListItem,
  contactNames: Map<string, string>,
): CallRowItem {
  return {
    id: call.id,
    name: contactNames.get(phoneKey(call.toNumber)) ?? "",
    number: call.toNumber,
    fromNumber: call.fromNumber,
    agentId: call.agentId,
    agent: call.agentName,
    language: languageLabel(call.inputLanguage, call.outputLanguage),
    duration: formatDuration(call.billableSeconds),
    outcome: outcomeOf(call.endReason),
    time: relativeTime(call.createdAt),
  };
}
