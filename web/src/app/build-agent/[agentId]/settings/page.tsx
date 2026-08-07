"use client";

import { BuilderSettings } from "@/components/builder/builder-settings";
import { useCurrentAgent } from "@/lib/agents/agent-context";

export default function SettingsPage() {
  return <BuilderSettings agent={useCurrentAgent()} />;
}
