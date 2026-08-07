import { BuilderTools } from "@/components/builder/builder-tools";
import { agents } from "@/components/dashboard/data";

export default async function ToolsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId)!;

  return <BuilderTools agent={agent} />;
}
