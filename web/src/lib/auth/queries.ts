import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import type { SignInValues, SignUpValues } from "@/lib/auth/schemas";

export type { Me } from "@/lib/auth/types";

/**
 * The session is read by the server on every request, so a sign-in is finished
 * by asking the server to look again: refresh() re-runs the auth layout with
 * the new cookie, and replace() keeps the form out of the back history.
 */
function useAuthSuccess() {
  const router = useRouter();

  return () => {
    router.refresh();
    router.replace("/home");
  };
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
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post<string>("/v1/auth/logout"),
    // Runs even when the request failed: the cookie may already be gone, and
    // leaving stale account data on screen is worse than an extra sign-in.
    // The gate does the rest — with no cookie, the layout redirects on its own.
    onSettled: () => {
      router.refresh();
    },
  });
}
