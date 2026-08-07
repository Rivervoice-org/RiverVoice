"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useMe } from "@/lib/auth/queries";

export function RequireSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isPending, isError } = useMe();

  React.useEffect(() => {
    if (isError) router.replace("/sign-in");
  }, [isError, router]);

  // Rendering the shell before the session resolves would flash the app at
  // someone who is about to be redirected.
  if (isPending || !data) return null;

  return <>{children}</>;
}
