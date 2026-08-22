/** Mirrors ferry/src/db/entity/agents.rs Language/Mode/Gender. */
export type Language = "en" | "hi" | "te" | "ta" | "kn";
export type Mode = "formal" | "modern-colloquial" | "classic-colloquial" | "code-mixed";
export type Gender = "female" | "male" | "neutral";

/** Mirrors ferry/src/http/handlers/agent.rs CreateAgentRequest. */
export type CreateAgentRequest = {
  name: string;
  input_language: Language;
  output_language: Language;
  mode?: Mode | null;
  gender?: Gender | null;
  mascot?: string | null;
};

/** Mirrors ferry/src/http/handlers/agent.rs AgentResponse. */
export type AgentResponse = {
  id: string;
  name: string;
  input_language: Language;
  output_language: Language;
  mode: Mode | null;
  gender: Gender | null;
  mascot: string | null;
};
