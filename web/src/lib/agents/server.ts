import { mockAgentSummary, mockAgentTemplate } from "@/lib/mock-data";
import type { AgentPage, AgentTemplate } from "@/lib/agents/types";

export type AgentQuery = {
  search?: string;
  limit?: number;
  offset?: number;
};

export const getAgents = async ({
  search = "",
  limit = 10,
  offset = 0,
}: AgentQuery = {}): Promise<AgentPage> => {
  const agents =
    search && !mockAgentSummary.name.toLowerCase().includes(search.toLowerCase())
      ? []
      : [mockAgentSummary];

  return { agents, total: agents.length, limit, offset };
};

export const getAgentTemplates = async (): Promise<AgentTemplate[]> => [mockAgentTemplate];
