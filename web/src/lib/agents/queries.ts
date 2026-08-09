import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import { toast } from "@/lib/toast";
import type { CreateAgentValues } from "@/lib/agents/schemas";
import type { Agent } from "@/lib/agents/types";

/** Version in the key, so switching versions is a cache hit on the way back. */
export const agentQueryKey = (id: string, version?: number) =>
  ["agents", id, version ?? "latest"] as const;

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

/** Harbor's wording under the title. Anything else is a stack trace in a toast. */
function detail(error: unknown) {
  return error instanceof ApiError ? { description: error.message } : {};
}

/**
 * The board is server-rendered, so a new agent is picked up by re-running the
 * page rather than by invalidating a client cache. refresh() before push(), or
 * the stale roster is what greets you on the way back.
 */
export function useCreateAgent() {
  const router = useRouter();

  return useMutation({
    mutationFn: (values: CreateAgentValues) =>
      api.post<CreatedAgent>("/v1/agents", { name: values.name, mascot: values.mascot }),
    onSuccess: (created, values) => {
      toast.add({ title: `${created.name ?? values.name} is on the board` });
      router.refresh();
      router.push(`/build-agent/${created.agent_id}`);
    },
    onError: (error) => toast.add({ title: "Could not create the agent", ...detail(error) }),
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

  return useMutation({
    mutationFn: (templateId: string) =>
      api.post<CreatedAgent>(`/v1/agent-templates/${templateId}/use`),
    onSuccess: (created) => {
      // The name is worth repeating back: hire a second "Front desk" and the
      // server lands it as "Front desk 2".
      toast.add({
        title: created.name ? `${created.name} is yours` : "Copied to your board",
        description: "Change anything — it starts from the template, it does not stay one.",
      });
      router.refresh();
      router.push(`/build-agent/${created.agent_id}`);
    },
    onError: (error) => toast.add({ title: "Could not hire from the roster", ...detail(error) }),
  });
}
