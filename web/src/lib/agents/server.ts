import { cache } from "react";

import { serverGet } from "@/lib/api-server";
import type { AgentPage, AgentTemplate } from "@/lib/agents/types";

/**
 * Read once per request, however many components ask. React's cache dedupes
 * within a single render, so a layout and a page wanting the same roster cost
 * harbor one call rather than two. Deduping is by argument, so two different
 * pages stay two calls.
 */

export type AgentQuery = {
  search?: string;
  limit?: number;
  offset?: number;
};

export const getAgents = cache(({ search = "", limit = 10, offset = 0 }: AgentQuery = {}) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });

  // Only when there is one, so harbor takes the cheaper branch of the filter.
  if (search) params.set("q", search);

  return serverGet<AgentPage>(`/v1/agents?${params}`);
});

export const getAgentTemplates = cache(() => serverGet<AgentTemplate[]>("/v1/agent-templates"));
