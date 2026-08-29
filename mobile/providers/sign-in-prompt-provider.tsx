import React, { useCallback, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { SignInPromptContext } from "@/state/sign-in-prompt/context";
import { SignInRequiredDialog } from "@/components/SignInRequiredDialog";

export function SignInPromptProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, continueWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setOpen(true);
    },
    [isAuthenticated],
  );

  // Closing any other way than completing sign-in (Not now, the X, backdrop
  // tap) means the user declined — drop the pending action so it doesn't
  // fire later for an unrelated sign-in.
  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      pendingActionRef.current = null;
    }
  }, []);

  // The dialog itself performs the Google sign-in and only calls this once
  // it actually succeeds, so there's no need to watch isAuthenticated here.
  const handleSignedIn = useCallback(() => {
    setOpen(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  // Memoized so the dialog's own open/close state (which re-renders this
  // provider) doesn't hand every context consumer — every row in the
  // contacts list, in particular — a new object identity to re-render for.
  const contextValue = React.useMemo(() => ({ requireAuth }), [requireAuth]);

  return (
    <SignInPromptContext.Provider value={contextValue}>
      {children}
      <SignInRequiredDialog
        open={open}
        onOpenChange={handleOpenChange}
        continueWithGoogle={continueWithGoogle}
        onSignedIn={handleSignedIn}
      />
    </SignInPromptContext.Provider>
  );
}
