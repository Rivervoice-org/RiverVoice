import { useQuery } from "@tanstack/react-query";
import { getAgent, getAgents, getRecentAgents } from "@/lib/agents/api";
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

export const recentAgentsQueryKey = ["agents", "recent"] as const;

/** The three agents this user has called most recently. Same signed-out
 * gate as `useAgents` — the route is require_user-protected. */
export function useRecentAgents() {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: recentAgentsQueryKey,
    queryFn: getRecentAgents,
    enabled: isAuthenticated,
  });
}

export const agentQueryKey = (id: string) => ["agents", "detail", id] as const;

/**
 * One agent in full.
 *
 * Fetched by id rather than picked out of the `useAgents` list: the recent
 * rows carry only a name and a mascot, so arriving from Home there is no
 * list in cache to find the agent in.
 */
export function useAgent(id: string | undefined) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: agentQueryKey(id ?? ""),
    queryFn: () => getAgent(id as string),
    enabled: isAuthenticated && !!id,
  });
}
