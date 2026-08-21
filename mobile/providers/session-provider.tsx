import React, { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createUser } from "@/lib/auth/api";
import { clearTokens, saveTokens } from "@/lib/auth/tokens";
import { SessionContext, type SessionUser } from "@/state/session/context";

const COUNTRY_CODE = "+91";

/**
 * Owns the session: who is signed in, and the login calls behind it.
 * ferry has no OTP/login endpoint yet (see lib/auth/api.ts) — both signIn
 * and signUp call the one auth route it exposes, POST /v1/users, which
 * issues an access + refresh token pair on success.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  const { mutateAsync: createUserMutation } = useMutation({
    mutationFn: createUser,
  });

  const signIn = useCallback(
    async (phone: string) => {
      const result = await createUserMutation({
        mobile_number: `${COUNTRY_CODE}${phone}`,
      });
      await saveTokens(result);
      setUser({ name: result.name, phone });
      setIsAuthenticated(true);
    },
    [createUserMutation],
  );

  const signUp = useCallback(
    async (data: { name: string; phone: string }) => {
      const result = await createUserMutation({
        mobile_number: `${COUNTRY_CODE}${data.phone}`,
        name: data.name,
      });
      await saveTokens(result);
      setUser({ name: result.name, phone: data.phone });
      setIsAuthenticated(true);
    },
    [createUserMutation],
  );

  const signOut = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    void clearTokens();
  }, []);

  return (
    <SessionContext.Provider value={{ isAuthenticated, user, signIn, signUp, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}
