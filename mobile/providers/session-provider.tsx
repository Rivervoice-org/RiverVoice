import React, { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createUser, getMe, signOutRequest } from "@/lib/auth/api";
import { ferry } from "@/lib/ferry";
import { clearTokens, getRefreshToken, saveTokens } from "@/lib/auth/tokens";
import { SessionContext, type SessionUser } from "@/state/session/context";

const COUNTRY_CODE = "+91";

/**
 * Owns the session: who is signed in, and the login call behind it.
 * ferry has no OTP/login endpoint yet (see lib/auth/api.ts) —
 * continueWithNumber calls the one auth route it exposes, POST /v1/users,
 * which creates the user if the number is new and issues an access +
 * refresh token pair either way.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  // Restores the session on app launch from the refresh token in
  // SecureStore — without this, isAuthenticated starts false on every cold
  // start and a genuinely still-logged-in user sees Welcome/sign-in again.
  // The profile itself is always re-fetched from GET /v1/users/me rather
  // than cached locally, so it can never go stale.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const refreshToken = await getRefreshToken();

        if (refreshToken) {
          const me = await ferry.refreshSession().then(getMe);
          if (!cancelled) {
            setUser({ name: me.name, phone: me.mobile_number });
            setIsAuthenticated(true);
          }
        }
      } catch {
        // Refresh token dead, the /me fetch failed, or SecureStore itself
        // threw (corrupted entry, etc.) — nothing to restore either way.
        // Falling through to the finally below is what matters: bootstrap
        // must resolve regardless of what failed, or the app is stuck on
        // the splash screen forever.
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { mutateAsync: createUserMutation } = useMutation({
    mutationFn: createUser,
  });

  const continueWithNumber = useCallback(
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

  const signOut = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    void (async () => {
      const refreshToken = await getRefreshToken();
      await clearTokens();
      if (refreshToken) {
        try {
          await signOutRequest(refreshToken);
        } catch {
          // Best-effort — the local session is already cleared either way,
          // so a network failure here just leaves the old refresh token
          // valid server-side until it naturally expires.
        }
      }
    })();
  }, []);

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, isBootstrapping, user, continueWithNumber, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}
