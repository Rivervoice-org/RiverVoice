import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";

import { AgentBoard } from "@/components/dashboard/agent-board";
import { AgentComposer } from "@/components/dashboard/agent-composer";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { CreateAgentDialog } from "@/components/dashboard/create-agent-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { agentsQueryKey, templatesQueryKey } from "@/lib/agents/keys";
import type { AgentSummary, AgentTemplate } from "@/lib/agents/types";
import { serverGet } from "@/lib/api-server";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  // Thrown away with the request. A shared client would serve one tenant's
  // agents to the next visitor.
  const queryClient = new QueryClient();

  // prefetchQuery swallows its own errors, so harbor being down leaves the
  // cache empty and the client retries after hydration.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: agentsQueryKey,
      queryFn: () => serverGet<AgentSummary[]>("/v1/agents"),
    }),
    queryClient.prefetchQuery({
      queryKey: templatesQueryKey,
      queryFn: () => serverGet<AgentTemplate[]>("/v1/agent-templates"),
    }),
  ]);

  return (
    // Carries both results down in the payload, so useAgents and
    // useAgentTemplates resolve from cache instead of asking again.
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PageHeader
        title="Agents"
        description="Everyone who answers your phones — live, paused, and still in draft."
        action={<CreateAgentDialog />}
      />

      <AgentComposer />
      <AgentBoard />
      <AgentTemplates />
    </HydrationBoundary>
  );
}
