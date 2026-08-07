"use client";

import { BuilderInstructions } from "@/components/builder/builder-instructions";
import { useCurrentAgent } from "@/lib/agents/agent-context";

export default function InstructionsPage() {
  return <BuilderInstructions agent={useCurrentAgent()} />;
}
