import { AgentBoard } from "@/components/dashboard/agent-board";
import { AgentComposer } from "@/components/dashboard/agent-composer";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { CreateAgentDialog } from "@/components/dashboard/create-agent-dialog";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader title="Agents" action={<CreateAgentDialog />} />

      <AgentComposer />
      <AgentBoard />
      <AgentTemplates />
    </>
  );
}
