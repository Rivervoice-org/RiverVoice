import { BuilderInstructions } from "@/components/builder/builder-instructions";
import { agents } from "@/components/dashboard/data";

export default async function InstructionsPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const agent = agents.find((item) => item.id === agentId)!;

  return <BuilderInstructions agent={agent} />;
}
