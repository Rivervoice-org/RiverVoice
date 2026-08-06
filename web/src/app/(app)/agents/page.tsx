import { Plus } from "lucide-react";

import { AgentBoard } from "@/components/dashboard/agent-board";
import { AgentComposer } from "@/components/dashboard/agent-composer";
import { AgentTemplates } from "@/components/dashboard/agent-templates";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description="Three lines are answering. Write a new one, or hire from the roster."
        action={
          <Button variant="outline" size="lg" className="cursor-pointer">
            <Plus data-icon="inline-start" />
            Create from scratch
          </Button>
        }
      />

      <AgentComposer />
      <AgentBoard />
      <AgentTemplates />
    </>
  );
}
