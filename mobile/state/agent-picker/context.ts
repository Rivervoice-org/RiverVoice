import { createContext } from "react";

export type CallTarget = { name?: string; phone: string };

export interface AgentPickerContextValue {
  /** Opens the agent picker sheet for `target`; picking an agent starts the call. */
  pickAgentForCall: (target: CallTarget) => void;
}

export const AgentPickerContext = createContext<AgentPickerContextValue | null>(null);
