"use client";

import { BuilderTools } from "@/components/builder/builder-tools";
import { useCurrentAgent } from "@/lib/agents/agent-context";

export default function ToolsPage() {
  return <BuilderTools agent={useCurrentAgent()} />;
}
