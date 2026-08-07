"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useMe } from "@/lib/auth/queries";

/** The mirror of RequireSession: these pages are only for people without one. */
export function RedirectIfSession({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data } = useMe();

  React.useEffect(() => {
    if (data) router.replace("/home");
  }, [data, router]);

  // Held back only once the session is known, never while it is still in
  // flight. RequireSession can afford to blank the screen because everyone who
  // reaches it has a session; here the opposite is true, and blanking would
  // make every signed-out visitor wait on a request that is going to 401.
  if (data) return null;

  return <>{children}</>;
}
