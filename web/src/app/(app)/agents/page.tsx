import { AgentBoard } from "@/components/dashboard/agent-board";
import { AgentComposer } from "@/components/dashboard/agent-composer";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { CreateAgentDialog } from "@/components/dashboard/create-agent-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { getAgents, getAgentTemplates } from "@/lib/agents/server";
import type { AgentSummary, AgentTemplate } from "@/lib/agents/types";

export const metadata = { title: "Agents" };

/** Per-user data. Stated outright rather than left to infer from the cookie read. */
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  let agents: AgentSummary[] = [];
  let templates: AgentTemplate[] = [];
  let failed = false;

  // Neither is worth failing the page over: a harbor that is down leaves the
  // sections empty and says so.
  const [agentsResult, templatesResult] = await Promise.allSettled([
    getAgents(),
    getAgentTemplates(),
  ]);

  if (agentsResult.status === "fulfilled") {
    agents = agentsResult.value;
  } else {
    failed = true;
    console.error("agents page: could not read agents", agentsResult.reason);
  }

  if (templatesResult.status === "fulfilled") {
    templates = templatesResult.value;
  } else {
    failed = true;
    console.error("agents page: could not read templates", templatesResult.reason);
  }

  return (
    <>
      <PageHeader
        title="Agents"
        description="Everyone who answers your phones — live, paused, and still in draft."
        action={<CreateAgentDialog />}
      />

      <AgentComposer />
      <AgentBoard agents={agents} failed={failed} />
      <AgentTemplates templates={templates} failed={failed} />
    </>
  );
}
