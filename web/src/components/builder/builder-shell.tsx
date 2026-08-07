"use client";

import { notFound } from "next/navigation";

import { BuilderWorkspace } from "@/components/builder/builder-workspace";
import { Mascot } from "@/mascots";
import { AgentProvider } from "@/lib/agents/agent-context";
import { useAgent } from "@/lib/agents/queries";
import { useRememberedVersion } from "@/lib/agents/use-remembered-version";
import { ApiError } from "@/lib/api";

/** Loads the agent once, for every tab under it. */
export function BuilderShell({
  agentId,
  children,
}: {
  agentId: string;
  children: React.ReactNode;
}) {
  const { version, ready } = useRememberedVersion(agentId);
  const agent = useAgent(agentId, version, ready);

  if (agent.error instanceof ApiError && agent.error.status === 404) notFound();

  if (!agent.data) {
    return (
      <div className="flex h-svh items-center justify-center bg-canvas">
        {agent.error ? (
          <p role="alert" className="text-[13px] text-muted-foreground">
            {agent.error.message}
          </p>
        ) : (
          <Mascot seed={agentId} size={36} className="animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <AgentProvider agent={agent.data}>
      <BuilderWorkspace agent={agent.data}>{children}</BuilderWorkspace>
    </AgentProvider>
  );
}
