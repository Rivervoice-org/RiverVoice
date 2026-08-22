import React, { useCallback, useMemo, useState } from "react";
import { AgentPickerContext, type CallTarget } from "@/state/agent-picker/context";
import { AgentPickerSheet } from "@/components/AgentPickerSheet";
import { startCallWith } from "@/lib/start-call";
import type { AgentResponse } from "@/lib/agents/types";

export function AgentPickerProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<CallTarget | null>(null);

  const pickAgentForCall = useCallback((next: CallTarget) => setTarget(next), []);

  const handleSelect = useCallback(
    (agent: AgentResponse) => {
      if (target) startCallWith(target, agent);
      setTarget(null);
    },
    [target],
  );

  const handleClose = useCallback(() => setTarget(null), []);

  // Memoized so opening/closing the sheet (which changes `target`, and thus
  // re-renders this provider) doesn't hand every context consumer — every row
  // in the contacts list — a new object identity to re-render for.
  const contextValue = useMemo(() => ({ pickAgentForCall }), [pickAgentForCall]);

  return (
    <AgentPickerContext.Provider value={contextValue}>
      {children}
      <AgentPickerSheet visible={!!target} onSelect={handleSelect} onClose={handleClose} />
    </AgentPickerContext.Provider>
  );
}
