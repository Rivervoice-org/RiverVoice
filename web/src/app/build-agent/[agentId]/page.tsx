import { notFound } from "next/navigation";

import { BuilderWorkspace } from "@/components/builder/builder-workspace";
import { agents } from "@/components/dashboard/data";

type Params = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Params) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId);
  return { title: agent ? agent.name : "Agent" };
}

export default async function BuildAgentPage({ params }: Params) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId);

  if (!agent) notFound();

  return <BuilderWorkspace agent={agent} />;
}
