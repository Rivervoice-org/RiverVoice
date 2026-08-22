import { authHeader } from "@/lib/auth/tokens";
import { ferry } from "@/lib/ferry";
import type { AgentResponse, CreateAgentRequest, UpdateAgentRequest } from "@/lib/agents/types";

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

/**
 * Hits ferry's `DELETE /v1/agents/{id}`. Also protected.
 */
export function deleteAgent(id: string): Promise<null> {
  return ferry.delete<null>(`/v1/agents/${id}`, authHeader());
}

/**
 * Hits ferry's `PATCH /v1/agents/{id}`. Also protected. Only send fields
 * that actually changed — omitted keys leave that column untouched
 * server-side, so this isn't a full-replace PUT.
 */
export function updateAgent(id: string, payload: UpdateAgentRequest): Promise<AgentResponse> {
  return ferry.patch<AgentResponse>(`/v1/agents/${id}`, payload, authHeader());
}
