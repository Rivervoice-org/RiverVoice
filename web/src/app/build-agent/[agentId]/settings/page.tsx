import { BuilderSettings } from "@/components/builder/builder-settings";
import { agents } from "@/components/dashboard/data";

export default async function SettingsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId)!;

  return <BuilderSettings agent={agent} />;
}
