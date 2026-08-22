/** Mirrors ferry/src/db/entity/agents.rs Language/Mode/Gender. */
export type Language = "en" | "hi" | "te" | "ta" | "kn";
export type Mode = "formal" | "modern-colloquial" | "classic-colloquial" | "code-mixed";
export type Gender = "female" | "male" | "neutral";

/** Mirrors ferry/src/http/handlers/agent.rs CreateAgentRequest — all of
 * `agents`' columns are NOT NULL, so every field here is required. */
export type CreateAgentRequest = {
  name: string;
  input_language: Language;
  output_language: Language;
  mode: Mode;
  gender: Gender;
  mascot: string;
  voice: string;
};

/** Mirrors ferry/src/http/handlers/agent.rs UpdateAgentRequest — every field
 * optional, and omitted fields leave that column untouched server-side.
 * Unlike CreateAgentRequest there's no "clear to null" case to represent,
 * since none of `agents`' columns are nullable. */
export type UpdateAgentRequest = {
  name?: string;
  input_language?: Language;
  output_language?: Language;
  mode?: Mode;
  gender?: Gender;
  mascot?: string;
  voice?: string;
};

/** Mirrors ferry/src/http/handlers/agent.rs AgentResponse. */
export type AgentResponse = {
  id: string;
  name: string;
  input_language: Language;
  output_language: Language;
  mode: Mode;
  gender: Gender;
  mascot: string;
  voice: string;
};
