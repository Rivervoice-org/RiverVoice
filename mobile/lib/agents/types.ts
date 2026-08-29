/**
 * Generated from ferry's Rust types by ts-rs (`cargo test export_bindings`) —
 * see ferry/src/http/handlers/agent.rs and ferry/src/db/entity/agents.rs.
 *
 * Re-exported under these names so existing `@/lib/agents/types` imports keep
 * resolving, and so the option sets can never drift from the database enums
 * they came from.
 */
export type { Language } from "@/lib/bindings/Language";
export type { Mode } from "@/lib/bindings/Mode";
export type { Gender } from "@/lib/bindings/Gender";

export type { CreateAgentRequest } from "@/lib/bindings/CreateAgentRequest";
export type { UpdateAgentRequest } from "@/lib/bindings/UpdateAgentRequest";
export type { AgentResponse } from "@/lib/bindings/AgentResponse";
export type { PreviewVoiceResponse } from "@/lib/bindings/PreviewVoiceResponse";
