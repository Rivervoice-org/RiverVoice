import { useContext } from "react";
import { AgentPickerContext } from "@/state/agent-picker/context";

/** Opens the "pick an agent" sheet before a call starts. */
export function useAgentPicker() {
  const ctx = useContext(AgentPickerContext);
  if (!ctx) throw new Error("useAgentPicker must be used within AgentPickerProvider");
  return ctx;
}
