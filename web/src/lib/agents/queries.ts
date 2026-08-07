import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import type { CreateAgentValues } from "@/lib/agents/schemas";

export const agentsQueryKey = ["agents"] as const;

/** A row on the board. Mirrors harbor's ListAgentsRow. */
export type Agent = {
  id: string;
  name: string;
  mascot: string | null;
  purpose: string;
  status: "draft" | "live";
  editedAt: string;
  /** Empty once the person who last edited it has left the org. */
  editedBy: string;
};

export function useAgents(): UseQueryResult<Agent[]> {
  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: () => api.get<Agent[]>("/v1/agents"),
    staleTime: 30 * 1000,
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
