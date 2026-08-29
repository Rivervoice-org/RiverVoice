import { createContext } from "react";

export interface SessionUser {
  name: string;
  email: string;
}

export interface SessionContextValue {
  isAuthenticated: boolean;
  /** True while restoring a session from a stored refresh token on launch.
   * Screens that redirect based on isAuthenticated (e.g. the (auth) layout's
   * Welcome-skip) should wait for this to go false first, or a genuinely
   * signed-in user briefly flashes the signed-out state on every cold start. */
  isBootstrapping: boolean;
  user: SessionUser | null;
  /** Resolves true if the user actually completed Google sign-in, false if
   * they cancelled the account picker — callers that defer an action until
   * sign-in completes need to distinguish the two. */
  continueWithGoogle: () => Promise<boolean>;
  signOut: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
