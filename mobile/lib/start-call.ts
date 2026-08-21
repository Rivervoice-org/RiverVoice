import { router } from "expo-router";
import { AGENTS } from "@/screens/Agents/mock";

/**
 * TODO: which agent handles a given outgoing call is still an open question
 * (user picks one? one default per account? per-number assignment?) — for
 * now this always hands the call to the first "live" agent so the in-call
 * screen has something real to show. Replace this once that decision lands.
 */
function defaultAgent() {
  return AGENTS.find((agent) => agent.status === "live") ?? AGENTS[0];
}

export function startCallWith(contact: { name?: string; phone: string }) {
  const agent = defaultAgent();
  router.push({
    pathname: "/in-call",
    params: {
      name: contact.name ?? "",
      phone: contact.phone,
      agentName: agent?.name ?? "Agent",
      agentMascot: agent?.mascot ?? "",
    },
  });
}
