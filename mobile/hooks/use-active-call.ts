import { useContext } from "react";
import { ActiveCallContext } from "@/state/active-call/context";

/** The call currently in progress (if any) — lives above the navigation
 * stack in `ActiveCallProvider` so it survives navigating away from
 * `/in-call`, e.g. to show the minimized pill. */
export function useActiveCall() {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) {
    throw new Error("useActiveCall must be used within ActiveCallProvider");
  }
  return ctx;
}
