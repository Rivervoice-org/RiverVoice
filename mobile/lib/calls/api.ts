import { currentUserId, supabase } from "@/lib/supabase";
import type {
  CallDetail,
  CallListItem,
  CallRow,
  CallUtteranceRow,
  RecentCallsResponse,
  Utterance,
} from "@/lib/calls/types";

export const RECENT_CALLS_PAGE_SIZE = 20;

const CALL_LIST_COLUMNS =
  "id, from_number, to_number, agent_id, agent_name, input_language, output_language, end_reason, billable_seconds, created_at";

type CallListRow = Pick<
  CallRow,
  | "id"
  | "from_number"
  | "to_number"
  | "agent_id"
  | "agent_name"
  | "input_language"
  | "output_language"
  | "end_reason"
  | "billable_seconds"
  | "created_at"
>;

function fromListRow(row: CallListRow): CallListItem {
  return {
    id: row.id,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    agentId: row.agent_id,
    agentName: row.agent_name,
    inputLanguage: row.input_language,
    outputLanguage: row.output_language,
    endReason: row.end_reason,
    billableSeconds: row.billable_seconds,
    createdAt: row.created_at,
  };
}

/** `created_at` isn't a unique sort key on its own — two calls can share the
 * same timestamp. Cursor is `created_at|id`; `id` (uuid) breaks ties in the
 * same descending order so a shared-timestamp boundary can't skip or repeat
 * a row across pages. */
function encodeCursor(row: Pick<CallListRow, "created_at" | "id">): string {
  return `${row.created_at}|${row.id}`;
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const sep = cursor.lastIndexOf("|");
  return { createdAt: cursor.slice(0, sep), id: cursor.slice(sep + 1) };
}

/**
 * Reads `calls` directly via PostgREST — no ferry handler for this
 * anymore, call history is a plain read scoped to the caller. Newest
 * first.
 *
 * `before` is a cursor, not an offset: it is the `nextBefore` cursor from
 * the previous page. Paging by position would duplicate or skip rows when a
 * call is placed while the user is scrolling, since new calls are inserted at
 * the head of this list. `limit + 1` is the deliberate over-fetch: whether
 * that single extra row comes back is how "is there a next page" is
 * detected, instead of a second COUNT(*) over the user's whole history.
 */
export async function getRecentCalls(
  before?: string,
): Promise<RecentCallsResponse> {
  const userId = await currentUserId();
  let query = supabase
    .from("calls")
    .select(CALL_LIST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(RECENT_CALLS_PAGE_SIZE + 1);
  if (before) {
    const { createdAt, id } = decodeCursor(before);
    // (created_at, id) < (createdAt, id) in descending order: strictly
    // earlier timestamps, or the same timestamp with a strictly smaller id.
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = data as CallListRow[];
  const hasMore = rows.length > RECENT_CALLS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, RECENT_CALLS_PAGE_SIZE) : rows;
  const lastRow = page[page.length - 1];

  return {
    calls: page.map(fromListRow),
    nextBefore: hasMore && lastRow ? encodeCursor(lastRow) : null,
  };
}

type UtteranceRow = Pick<
  CallUtteranceRow,
  | "seq"
  | "speaker"
  | "original_text"
  | "original_language"
  | "translated_text"
  | "translated_language"
  | "offset_ms"
  | "duration_ms"
>;

type CallDetailRow = Pick<
  CallRow,
  | "id"
  | "direction"
  | "from_number"
  | "to_number"
  | "agent_id"
  | "agent_name"
  | "input_language"
  | "output_language"
  | "status"
  | "end_reason"
  | "error"
  | "created_at"
  | "ringing_at"
  | "connected_at"
  | "ended_at"
  | "billable_seconds"
  | "cost_micros"
  | "recording_url"
> & { call_utterances: UtteranceRow[] };

function fromUtteranceRow(row: UtteranceRow): Utterance {
  return {
    seq: row.seq,
    speaker: row.speaker,
    originalText: row.original_text,
    originalLanguage: row.original_language,
    translatedText: row.translated_text,
    translatedLanguage: row.translated_language,
    offsetMs: row.offset_ms,
    durationMs: row.duration_ms,
  };
}

/**
 * Reads one call plus its transcript in a single PostgREST request, via
 * resource embedding over the `call_utterances.call_id` foreign key —
 * `select=*,call_utterances(*)` rather than two round trips. Scoped to the
 * caller in the query itself, so another user's call comes back as "no
 * rows" the same way a nonexistent one would.
 */
export async function getCallDetail(id: string): Promise<CallDetail> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("calls")
    .select(
      `id, direction, from_number, to_number, agent_id, agent_name, input_language, output_language,
       status, end_reason, error, created_at, ringing_at, connected_at, ended_at, billable_seconds,
       cost_micros, recording_url,
       call_utterances (seq, speaker, original_text, original_language, translated_text, translated_language, offset_ms, duration_ms)`,
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;

  const row = data as CallDetailRow;
  return {
    id: row.id,
    direction: row.direction,
    fromNumber: row.from_number,
    toNumber: row.to_number,
    agentId: row.agent_id,
    agentName: row.agent_name,
    inputLanguage: row.input_language,
    outputLanguage: row.output_language,
    status: row.status,
    endReason: row.end_reason,
    error: row.error,
    createdAt: row.created_at,
    ringingAt: row.ringing_at,
    connectedAt: row.connected_at,
    endedAt: row.ended_at,
    billableSeconds: row.billable_seconds,
    costMicros: row.cost_micros,
    recordingUrl: row.recording_url,
    // Sorted here rather than relying on PostgREST's embedded-resource
    // ordering syntax, so correctness doesn't hinge on getting that
    // exactly right — seq is the conversation's real order regardless of
    // what order the rows came back in.
    utterances: [...row.call_utterances]
      .sort((a, b) => a.seq - b.seq)
      .map(fromUtteranceRow),
  };
}
