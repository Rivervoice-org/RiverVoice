import React, { useCallback, useState } from "react";
import { SessionContext, type SessionUser } from "@/state/session/context";

/**
 * Owns the session: who is signed in, and the login calls behind it. Mocked
 * for now — each call fakes a round trip and always succeeds.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const signIn = useCallback(async (phone: string) => {
    await new Promise((r) => setTimeout(r, 800));
    setUser({ name: "", phone });
    setIsAuthenticated(true);
  }, []);

  const signUp = useCallback(async (data: { name: string; phone: string }) => {
    await new Promise((r) => setTimeout(r, 800));
    setUser({ name: data.name, phone: data.phone });
    setIsAuthenticated(true);
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <SessionContext.Provider value={{ isAuthenticated, user, signIn, signUp, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
