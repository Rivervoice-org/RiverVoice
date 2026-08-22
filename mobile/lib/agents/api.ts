import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import type { AgentResponse, CreateAgentRequest } from "@/lib/agents/types";

/**
 * Hits ferry's `POST /v1/agents` (see ferry/src/http/handlers/agent.rs).
 * Protected route — require_user rejects it with 401 if there's no valid
 * access token, so this always sends the Authorization header.
 */
export function createAgent(payload: CreateAgentRequest): Promise<AgentResponse> {
  return ferry.post<AgentResponse>("/v1/agents", payload, authHeader());
}

/**
 * Hits ferry's `GET /v1/agents`. Also protected, and — since `agents` has
 * no owner column yet — returns every agent in the database, not just the
 * caller's.
 */
export function getAgents(): Promise<AgentResponse[]> {
  return ferry.get<AgentResponse[]>("/v1/agents", authHeader());
}
