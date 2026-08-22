import { useQuery } from "@tanstack/react-query";
import { getAgents } from "@/lib/agents/api";

export const agentsQueryKey = ["agents"] as const;

export function useAgents() {
  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: getAgents,
  });
}
