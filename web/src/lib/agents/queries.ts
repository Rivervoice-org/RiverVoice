import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import type { CreateAgentValues } from "@/lib/agents/schemas";
import type { Agent, AgentSummary } from "@/lib/agents/types";

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

type CreatedAgent = { message: string; agent_id: string };

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
