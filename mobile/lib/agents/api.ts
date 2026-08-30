import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import { currentUserId, supabase } from "@/lib/supabase";
import type {
  AgentResponse,
  AgentRow,
  AgentUpdateRow,
  CreateAgentRequest,
  PreviewVoiceResponse,
  RecentAgent,
  UpdateAgentRequest,
} from "@/lib/agents/types";

const AGENT_COLUMNS =
  "id, name, input_language, output_language, mode, gender, mascot, voice";

function fromRow(row: AgentRow): AgentResponse {
  return {
    id: row.id,
    name: row.name,
    inputLanguage: row.input_language,
    outputLanguage: row.output_language,
    mode: row.mode,
    gender: row.gender,
    mascot: row.mascot,
    voice: row.voice,
  };
}

/**
 * Inserts directly into `agents` via PostgREST — no ferry handler for this
 * anymore, `agents` CRUD is plain client-owned data. `user_id` is set here
 * rather than left to a default/trigger so it's explicit which caller a
 * newly-created row belongs to.
 */
export async function createAgent(
  payload: CreateAgentRequest,
): Promise<AgentResponse> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("agents")
    .insert({
      user_id: userId,
      name: payload.name,
      input_language: payload.inputLanguage,
      output_language: payload.outputLanguage,
      mode: payload.mode,
      gender: payload.gender,
      mascot: payload.mascot,
      voice: payload.voice,
    })
    .select(AGENT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as AgentRow);
}

/** All of the caller's own agents — scoped by `user_id` here in the query
 * itself, not just left to RLS, so this is correct even before RLS lands. */
export async function getAgents(): Promise<AgentResponse[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_COLUMNS)
    .eq("user_id", userId);
  if (error) throw error;
  return (data as AgentRow[]).map(fromRow);
}

/**
 * Hits ferry's `GET /v1/agents/recent` (see
 * ferry/src/http/handlers/agent.rs) — the one agent endpoint still on
 * ferry, since it's a join+aggregate (MAX/COUNT/GROUP BY) PostgREST's
 * row-level API can't express without a database view or RPC function.
 * At most three, most recently called first, and no pagination — the
 * screen shows three and there is no page two to ask for.
 */
export function getRecentAgents(): Promise<RecentAgent[]> {
  return ferry.get<RecentAgent[]>("/v1/agents/recent", authHeader());
}

/** The full agent — `getRecentAgents` deliberately returns only what a row
 * draws. */
export async function getAgent(id: string): Promise<AgentResponse> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("agents")
    .select(AGENT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return fromRow(data as AgentRow);
}

export async function deleteAgent(id: string): Promise<null> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
  return null;
}

/** Only send fields that actually changed — omitted keys leave that column
 * untouched, so this isn't a full-replace PUT. */
export async function updateAgent(
  id: string,
  payload: UpdateAgentRequest,
): Promise<AgentResponse> {
  const userId = await currentUserId();
  const patch: AgentUpdateRow = {};
  if (payload.name !== undefined) patch["name"] = payload.name;
  if (payload.inputLanguage !== undefined)
    patch["input_language"] = payload.inputLanguage;
  if (payload.outputLanguage !== undefined)
    patch["output_language"] = payload.outputLanguage;
  if (payload.mode !== undefined) patch["mode"] = payload.mode;
  if (payload.gender !== undefined) patch["gender"] = payload.gender;
  if (payload.mascot !== undefined) patch["mascot"] = payload.mascot;
  if (payload.voice !== undefined) patch["voice"] = payload.voice;

  const { data, error } = await supabase
    .from("agents")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(AGENT_COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data as AgentRow);
}

/**
 * Hits ferry's `POST /v1/voices/preview` (see
 * ferry/src/http/handlers/voice.rs) — real server-side work (calls Sarvam
 * TTS), not a table read/write, so this stays on ferry. Protected. Returns
 * a base64-encoded WAV clip of `voice` speaking a fixed sample sentence.
 */
export function previewVoice(voice: string): Promise<PreviewVoiceResponse> {
  return ferry.post<PreviewVoiceResponse>(
    "/v1/voices/preview",
    { voice },
    authHeader(),
  );
}
