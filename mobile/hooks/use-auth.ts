import { useContext } from "react";
import { SessionContext } from "@/state/session/context";

/** Session state and login calls, or an error if used outside the provider. */
export function useAuth() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useAuth must be used within SessionProvider");
  return ctx;
}
