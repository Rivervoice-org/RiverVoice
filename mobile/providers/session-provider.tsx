import React, { useCallback, useEffect, useState } from "react";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { config } from "@/lib/config";
import { clearAccessToken } from "@/lib/auth/tokens";
import { supabase } from "@/lib/supabase";
import { SessionContext, type SessionUser } from "@/state/session/context";
import type { Session } from "@supabase/supabase-js";

/**
 * Owns the session: who is signed in, and the login call behind it.
 * "Continue with Google" is the only sign-in path — continueWithGoogle
 * gets an ID token from the native Google Sign-In SDK and exchanges it
 * directly with Supabase Auth (signInWithIdToken), which finds-or-creates
 * the account and returns a session. Supabase's client persists and
 * refreshes that session itself (see lib/supabase.ts); this provider just
 * mirrors it into the SessionContext shape the rest of the app depends on.
 */
function toSessionUser(session: Session): SessionUser {
  const metadata = session.user.user_metadata as Record<string, unknown> | null;
  const name =
    (metadata?.["full_name"] as string | undefined) ??
    (metadata?.["name"] as string | undefined) ??
    session.user.email ??
    "";
  return { name, email: session.user.email ?? "" };
}

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

  // One listener covers both launch-time restore and every later change
  // (sign-in, sign-out, background token refresh) — Supabase fires this
  // immediately on subscribe with whatever session it already restored from
  // AsyncStorage, so there's no separate imperative bootstrap step needed.
  useEffect(() => {
    let bootstrapped = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toSessionUser(session) : null);
      setIsAuthenticated(session !== null);
      if (!bootstrapped) {
        bootstrapped = true;
        setIsBootstrapping(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) {
      throw error;
    }
    // isAuthenticated/user update via the onAuthStateChange listener above,
    // which Supabase fires as soon as the session is set.
    return true;
  }, []);

  const signOut = useCallback(() => {
    clearAccessToken();
    void (async () => {
      await supabase.auth.signOut();
      await GoogleSignin.signOut().catch((err) => {
        // Best-effort — clearing the local Google session isn't load-bearing
        // for RiverVoice's own sign-out.
        console.error("GoogleSignin.signOut failed:", err);
      });
    })();
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isAuthenticated,
        isBootstrapping,
        user,
        continueWithGoogle,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
