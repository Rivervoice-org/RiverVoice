import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { ApiError, api } from "@/lib/api";
import type { SignInValues, SignUpValues } from "@/lib/auth/schemas";

export type Me = {
  user: { id: string; name: string; email: string; phone: string; role: string };
  org: { id: string; name: string };
};

export const meQueryKey = ["me"] as const;

export function useMe(): UseQueryResult<Me> {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api.get<Me>("/v1/me"),
    // A 401 is the answer, not a failure to get one.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });
}

function useAuthSuccess() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({ queryKey: meQueryKey });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<string>("/v1/auth/logout"),
    // Clear even when the request failed: the cookie may already be gone, and
    // leaving stale account data on screen is worse than an extra sign-in.
    onSettled: () => {
      queryClient.clear();
      router.replace("/sign-in");
    },
  });
}
