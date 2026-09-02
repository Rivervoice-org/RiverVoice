import { createContext } from "react";

export type CallTarget = { name?: string; phone: string };

export interface AgentPickerContextValue {
  pickAgentForCall: (target: CallTarget) => void;
}

export const AgentPickerContext = createContext<AgentPickerContextValue | null>(
  null,
);
