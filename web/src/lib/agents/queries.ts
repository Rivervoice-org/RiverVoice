import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import type { CreateAgentValues } from "@/lib/agents/schemas";
import type { Agent, AgentSummary, AgentTemplate } from "@/lib/agents/types";

export const agentsQueryKey = ["agents"] as const;

/** Version in the key, so switching versions is a cache hit on the way back. */
export const agentQueryKey = (id: string, version?: number) =>
  ["agents", id, version ?? "latest"] as const;

export function useAgents(): UseQueryResult<AgentSummary[]> {
  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: () => api.get<AgentSummary[]>("/v1/agents"),
    staleTime: 30 * 1000,
  });
}

export function useAgent(id: string, version?: number, enabled = true): UseQueryResult<Agent> {
  return useQuery({
    enabled,
    queryKey: agentQueryKey(id, version),
    queryFn: () => api.get<Agent>(`/v1/agents/${id}${version ? `?version=${version}` : ""}`),
    // A 404 is an answer, not a blip.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
}

/** `name` is only set by a clone, where the server settled it. */
type CreatedAgent = { message: string; agent_id: string; name?: string };

export function useCreateAgent() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CreateAgentValues) =>
      api.post<CreatedAgent>("/v1/agents", { name: values.name, mascot: values.mascot }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey });
      router.push(`/build-agent/${created.agent_id}`);
    },
  });
}

/**
 * Taking a template clones it. There is no body: the settings, the tools and
 * the name all come from the server, which picks "Front desk 2" if the first
 * one is already on the board — so this cannot fail on a name collision and
 * has nothing to ask the person first.
 */
export function useTemplate() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      api.post<CreatedAgent>(`/v1/agent-templates/${templateId}/use`),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: agentsQueryKey });
      router.push(`/build-agent/${created.agent_id}`);
    },
  });
}

export const templatesQueryKey = ["agent-templates"] as const;

export function useAgentTemplates(): UseQueryResult<AgentTemplate[]> {
  return useQuery({
    queryKey: templatesQueryKey,
    queryFn: () => api.get<AgentTemplate[]>("/v1/agent-templates"),
    // The roster changes on a deploy, not while you are looking at it.
    staleTime: 60 * 60 * 1000,
  });
}
