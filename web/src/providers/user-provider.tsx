"use client";

import * as React from "react";

import { UserContext } from "@/contexts/user-context";
import type { Me } from "@/lib/auth/types";

/**
 * The account, read once by the layout on the server. Client components get it
 * without a request of their own, and without being threaded through every
 * component in between.
 *
 * Held in state so an edit to the profile can show immediately.
 */
export function UserProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  const [user, setUser] = React.useState(me);
  const [rendered, setRendered] = React.useState(me);

  // A fresh server render is the truth, so local edits give way to it. Adjusted
  // during render rather than in an effect: an effect would paint the stale
  // name first and correct it a frame later.
  if (rendered !== me) {
    setRendered(me);
    setUser(me);
  }

  const value = React.useMemo(
    () => ({
      me: user,
      updateUser: (changes: Partial<Me["user"]>) =>
        setUser((prev) => ({ ...prev, user: { ...prev.user, ...changes } })),
    }),
    [user],
  );

  return <UserContext value={value}>{children}</UserContext>;
}
