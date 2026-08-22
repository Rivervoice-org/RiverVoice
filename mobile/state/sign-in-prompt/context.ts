import { createContext } from "react";

export interface SignInPromptContextValue {
  /** Runs `action` if signed in; otherwise shows the sign-in-required dialog. */
  requireAuth: (action: () => void) => void;
}

export const SignInPromptContext = createContext<SignInPromptContextValue | null>(null);
