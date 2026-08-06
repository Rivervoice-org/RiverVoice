import { notFound } from "next/navigation";

import { BuilderWorkspace } from "@/components/builder/builder-workspace";
import { agents } from "@/components/dashboard/data";

type Props = {
  params: Promise<{ agentId: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId);
  return { title: agent ? agent.name : "Agent" };
}

export default async function BuildAgentLayout({ params, children }: Props) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId);

  if (!agent) notFound();

  return <BuilderWorkspace agent={agent}>{children}</BuilderWorkspace>;
}
