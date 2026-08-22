import { useQuery } from "@tanstack/react-query";
import { getAgents } from "@/lib/agents/api";
import { useAuth } from "@/hooks/use-auth";

export const agentsQueryKey = ["agents"] as const;

/** GET /v1/agents is require_user-gated — disabled while signed out so a
 * guest gets a clean "not signed in" state instead of a 401 masquerading
 * as a load failure. */
export function useAgents() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: agentsQueryKey,
    queryFn: getAgents,
    enabled: isAuthenticated,
  });
}
