import { useContext } from "react";
import { ContactsContext } from "./context";

export function useContacts() {
  const ctx = useContext(ContactsContext);
  if (!ctx) {
    throw new Error("useContacts must be used within a ContactsProvider");
  }
  return ctx;
}
