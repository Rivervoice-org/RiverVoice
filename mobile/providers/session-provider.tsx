import React, { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { googleSignIn, getMe, signOutRequest } from "@/lib/auth/api";
import { config } from "@/lib/config";
import { ferry } from "@/lib/ferry";
import { clearTokens, getRefreshToken, saveTokens, setAccessToken } from "@/lib/auth/tokens";
import { SessionContext, type SessionUser } from "@/state/session/context";

/**
 * Owns the session: who is signed in, and the login call behind it.
 * "Continue with Google" is the only sign-in path — continueWithGoogle
 * gets an ID token from the native Google Sign-In SDK and exchanges it at
 * ferry's POST /v1/auth/google (see ferry/src/http/handlers/user.rs),
 * which finds-or-creates the account and issues an access + refresh token
 * pair either way.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: config.googleWebClientId,
      offlineAccess: false,
    });
  }, []);

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
            setUser({ name: me.name, email: me.email });
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        // Refresh token dead, the /me fetch failed, or SecureStore itself
        // threw (corrupted entry, etc.) — nothing to restore either way.
        // Falling through to the finally below is what matters: bootstrap
        // must resolve regardless of what failed, or the app is stuck on
        // the splash screen forever.
        console.error("session bootstrap failed:", err);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const { mutateAsync: googleSignInMutation } = useMutation({
    mutationFn: googleSignIn,
  });

  const continueWithGoogle = useCallback(async (): Promise<boolean> => {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    // User closed the Google account picker — not an error, but callers
    // need to know sign-in didn't actually happen (e.g. so a deferred
    // action doesn't run as if it had).
    if (response.type !== "success") {
      return false;
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error("Google sign-in did not return an ID token");
    }

    const result = await googleSignInMutation({ idToken: idToken });
    await saveTokens(result);
    setUser({ name: result.name, email: result.email });
    setIsAuthenticated(true);
    return true;
  }, [googleSignInMutation]);

  const signOut = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    // Invalidate the in-memory access token synchronously, before any
    // await — otherwise a request fired in the gap while this function is
    // still reading SecureStore would go out with the old token and
    // authenticate as the user that's in the middle of signing out.
    setAccessToken(null);
    void (async () => {
      const refreshToken = await getRefreshToken();
      await clearTokens();
      await GoogleSignin.signOut().catch((err) => {
        // Best-effort — clearing the local Google session isn't load-bearing
        // for RiverVoice's own sign-out.
        console.error("GoogleSignin.signOut failed:", err);
      });
      if (refreshToken) {
        try {
          await signOutRequest(refreshToken);
        } catch (err) {
          // Best-effort — the local session is already cleared either way,
          // so a network failure here just leaves the old refresh token
          // valid server-side until it naturally expires.
          console.error("signOutRequest failed:", err);
        }
      }
    })();
  }, []);

  return (
    <SessionContext.Provider
      value={{ isAuthenticated, isBootstrapping, user, continueWithGoogle, signOut }}
    >
      {children}
    </SessionContext.Provider>
  );
}
