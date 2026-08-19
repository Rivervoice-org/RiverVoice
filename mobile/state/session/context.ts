import { createContext } from "react";

export interface SessionUser {
  name: string;
  phone: string;
}

export interface SessionContextValue {
  isAuthenticated: boolean;
  user: SessionUser | null;
  signIn: (phone: string) => Promise<void>;
  signUp: (data: { name: string; phone: string }) => Promise<void>;
  signOut: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
