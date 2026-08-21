import { useMutation } from "@tanstack/react-query";

import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import type { SignInValues, SignUpValues } from "@/lib/auth/schemas";

export type { Me } from "@/lib/auth/types";

/**
 * A full page load, the mirror of signing out. The tab may still be holding the
 * last person's cached queries and prefetched pages, and starting a session on
 * top of them is how one account's data ends up on another's screen.
 *
 * replace(), so the form is not what Back returns to.
 */
function useAuthSuccess() {
  return () => window.location.replace("/home");
}

// No backend to sign up or sign in against — a mock session cookie stands in.
function setMockSession() {
  document.cookie = `${SESSION_COOKIE}=1; path=/`;
}

export function useSignUp() {
  const onSuccess = useAuthSuccess();

  return useMutation({
    mutationFn: async (_values: SignUpValues) => setMockSession(),
    onSuccess,
  });
}

export function useSignIn() {
  const onSuccess = useAuthSuccess();

  return useMutation({
    mutationFn: async (_values: SignInValues) => setMockSession(),
    onSuccess,
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
    },
    // A full page load, not a soft navigation. Signing out has to leave nothing
    // behind, and only a fresh document guarantees that: the query cache, the
    // router's prefetched payloads and every provider holding this account go
    // with the old page rather than surviving into the next person's session.
    onSettled: () => window.location.replace("/sign-in"),
  });
}
