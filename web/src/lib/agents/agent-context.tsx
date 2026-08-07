"use client";

import * as React from "react";

import type { Agent } from "@/lib/agents/types";

const AgentContext = React.createContext<Agent | null>(null);

export function AgentProvider({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  return <AgentContext.Provider value={agent}>{children}</AgentContext.Provider>;
}

/**
 * The agent the builder layout loaded. Every tab reads it from here rather than
 * fetching again, so switching tabs costs nothing and they can never disagree.
 */
export function useCurrentAgent() {
  const agent = React.useContext(AgentContext);
  if (!agent) throw new Error("useCurrentAgent must be used inside the builder layout");
  return agent;
}
