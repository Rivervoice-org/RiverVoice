import { useMutation } from "@tanstack/react-query";

import { api } from "@/lib/api";
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

export function useSignUp() {
  const onSuccess = useAuthSuccess();

  return useMutation({
    // Sent field by field so confirmPassword, which is a browser-side check
    // only, cannot reach harbor.
    mutationFn: ({ organizationName, userName, email, phoneNumber, password }: SignUpValues) =>
      api.post<string>("/v1/auth/signup", {
        organizationName,
        userName,
        email,
        phoneNumber,
        password,
      }),
    onSuccess,
  });
}

export function useSignIn() {
  const onSuccess = useAuthSuccess();

  return useMutation({
    mutationFn: (values: SignInValues) => api.post<string>("/v1/auth/login", values),
    onSuccess,
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: () => api.post<string>("/v1/auth/logout"),
    // A full page load, not a soft navigation. Signing out has to leave nothing
    // behind, and only a fresh document guarantees that: the query cache, the
    // router's prefetched payloads and every provider holding this account go
    // with the old page rather than surviving into the next person's session.
    //
    // Runs even when the request failed — the cookie may already be gone, and
    // leaving stale account data on screen is worse than an extra sign-in.
    onSettled: () => window.location.replace("/sign-in"),
  });
}
