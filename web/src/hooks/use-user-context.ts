"use client";

import { useContext } from "react";

import { UserContext, type UserContextValue } from "@/contexts/user-context";

export function useUserContext(): UserContextValue {
  const context = useContext(UserContext);

  // Everything below the gate has one; reaching here means it was rendered
  // outside the signed-in shell.
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }

  return context;
}
