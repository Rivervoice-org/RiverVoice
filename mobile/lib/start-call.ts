import { router } from "expo-router";
import type { AgentResponse } from "@/lib/agents/types";

export function startCallWith(
  contact: { name?: string; phone: string },
  agent: AgentResponse,
) {
  router.push({
    pathname: "/in-call",
    params: {
      name: contact.name ?? "",
      phone: contact.phone,
      agentName: agent.name,
      agentMascot: agent.mascot ?? "",
    },
  });
}
