import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { toast } from "@/lib/toast";
import { mockAgent } from "@/lib/mock-data";
import type { CreateAgentValues } from "@/lib/agents/schemas";
import type { Agent } from "@/lib/agents/types";

/** Version in the key, so switching versions is a cache hit on the way back. */
export const agentQueryKey = (id: string, version?: number) =>
  ["agents", id, version ?? "latest"] as const;

export function useAgent(id: string, version?: number, enabled = true): UseQueryResult<Agent> {
  return useQuery({
    enabled,
    queryKey: agentQueryKey(id, version),
    queryFn: async () => ({ ...mockAgent, id, version: version ?? mockAgent.version }),
  });
}

type CreatedAgent = { message: string; agent_id: string; name?: string };

export function useCreateAgent() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (values: CreateAgentValues): Promise<CreatedAgent> => ({
      message: "created",
      agent_id: mockAgent.id,
      name: values.name,
    }),
    onSuccess: (created, values) => {
      toast.success(`${created.name ?? values.name} is on the board`);
      router.refresh();
      router.push(`/build-agent/${created.agent_id}`);
    },
  });
}

export function useTemplate() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (_templateId: string): Promise<CreatedAgent> => ({
      message: "created",
      agent_id: mockAgent.id,
      name: mockAgent.name,
    }),
    onSuccess: (created) => {
      toast.success(created.name ? `${created.name} is yours` : "Copied to your board", {
        description: "Change anything — it starts from the template, it does not stay one.",
      });
      router.refresh();
      router.push(`/build-agent/${created.agent_id}`);
    },
  });
}

export function useCloneAgent() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (_id: string): Promise<CreatedAgent> => ({
      message: "cloned",
      agent_id: mockAgent.id,
      name: mockAgent.name,
    }),
    onSuccess: (created) => {
      toast.success(created.name ? `${created.name} is on the board` : "Copy is on the board");
      router.refresh();
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (id: string) => id,
    onSuccess: (_id, id) => {
      queryClient.removeQueries({ queryKey: ["agents", id] });
      toast.success("Agent deleted", { description: "Every version went with it." });
      router.refresh();
    },
  });
}
