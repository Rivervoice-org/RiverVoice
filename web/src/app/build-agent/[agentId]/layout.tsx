import { BuilderShell } from "@/components/builder/builder-shell";

export const metadata = { title: "Agent" };

export default async function BuildAgentLayout({
  params,
  children,
}: {
  params: Promise<{ agentId: string }>;
  children: React.ReactNode;
}) {
  const { agentId } = await params;

  return <BuilderShell agentId={agentId}>{children}</BuilderShell>;
}
