import { createContext } from "react";

export type Contact = {
  id: string;
  name: string;
  phone: string;
};

export type ContactsStatus = "loading" | "granted" | "denied" | "error";

export interface ContactsContextValue {
  contacts: Contact[];
  status: ContactsStatus;
  /** True only while a user-triggered pull-to-refresh is in flight — the
   * initial load uses `status === "loading"` instead, so the two never
   * fight over the same spinner. */
  refreshing: boolean;
  refresh: () => Promise<void>;
}

export const ContactsContext = createContext<ContactsContextValue | null>(null);
