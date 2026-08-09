import { createContext } from "react";

import type { Me } from "@/lib/auth/types";

export type UserContextValue = {
  me: Me;
  /** Local edits, so a rename shows in the rail without a round trip. */
  updateUser: (changes: Partial<Me["user"]>) => void;
};

/** Undefined marks "no provider above", which is a wiring bug, not a state. */
export const UserContext = createContext<UserContextValue | undefined>(undefined);
