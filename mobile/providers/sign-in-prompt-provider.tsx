import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { SignInPromptContext } from "@/state/sign-in-prompt/context";
import { SignInRequiredDialog } from "@/components/SignInRequiredDialog";

const SIGN_IN_PATHNAME = "/continue-with-number";

export function SignInPromptProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  // Distinguishes "closed because the user tapped Continue with number"
  // (keep the pending action, run it once signed in) from every other way
  // the dialog closes — Not now, the X, backdrop tap (drop it; the user
  // explicitly declined, so it shouldn't fire later for an unrelated
  // future sign-in).
  const confirmedRef = useRef(false);
  // Tracks whether we've actually seen the sign-in screen since the last
  // confirm, so leaving it without completing sign-in can drop a stale
  // pending action instead of letting it survive to fire on some later,
  // unrelated sign-in.
  const reachedSignInScreenRef = useRef(false);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return;
      }
      pendingActionRef.current = action;
      confirmedRef.current = false;
      reachedSignInScreenRef.current = false;
      setOpen(true);
    },
    [isAuthenticated],
  );

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next && !confirmedRef.current) {
      pendingActionRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    confirmedRef.current = true;
  }, []);

  // If the user actually reaches the sign-in screen and then leaves it
  // without completing sign-in (back button, switching tabs, etc.), the
  // pending action is stale — drop it rather than let it fire the next
  // time they happen to sign in for an unrelated reason.
  useEffect(() => {
    if (isAuthenticated) return;

    if (pathname === SIGN_IN_PATHNAME) {
      reachedSignInScreenRef.current = true;
      return;
    }

    if (reachedSignInScreenRef.current) {
      pendingActionRef.current = null;
      reachedSignInScreenRef.current = false;
    }
  }, [pathname, isAuthenticated]);

  // Runs the deferred action once sign-in actually completes — the dialog
  // itself only navigates to the sign-in screen, it doesn't know when
  // that succeeds.
  useEffect(() => {
    if (!isAuthenticated || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action();
  }, [isAuthenticated]);

  return (
    <SignInPromptContext.Provider value={{ requireAuth }}>
      {children}
      <SignInRequiredDialog open={open} onOpenChange={handleOpenChange} onConfirm={handleConfirm} />
    </SignInPromptContext.Provider>
  );
}
