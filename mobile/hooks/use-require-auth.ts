import { useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SignInPromptContext } from "@/state/sign-in-prompt/context";

/** Guards an action behind a session; prompts to sign in when there is none. */
export function useRequireAuth() {
  const { isAuthenticated } = useAuth();
  const ctx = useContext(SignInPromptContext);
  if (!ctx) throw new Error("useRequireAuth must be used within SignInPromptProvider");

  return { requireAuth: ctx.requireAuth, isAuthenticated };
}
