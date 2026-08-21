import { useCallback, useEffect, useRef, useState } from "react";
import * as Contacts from "expo-contacts";
import { ContactsContext } from "@/state/contacts/context";
import type { Contact, ContactsStatus } from "@/state/contacts/context";

function mapContacts(data: Contacts.ExistingContact[]): Contact[] {
  return data
    .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phoneNumbers?.[0]?.number || "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reads the device address book exactly once per app session and holds the
 * result here, at the root — every screen that needs contacts (the Call tab
 * today, potentially others later) reads this cache instead of re-querying
 * `expo-contacts` on its own mount. The OS call is the expensive, sometimes
 * slow-to-render part (permission check + a full address-book read), not the
 * in-app list rendering, so this is the thing worth not repeating.
 *
 * A device's address book only changes from outside the app (the user adds a
 * contact elsewhere), so there is no live-invalidation source here beyond an
 * explicit pull-to-refresh — same tradeoff most phone/dialer apps make.
 */
export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [status, setStatus] = useState<ContactsStatus>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const load = useCallback(async (isRefresh: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (isRefresh) setRefreshing(true);
    try {
      const { status: permission } = await Contacts.requestPermissionsAsync();
      if (permission !== Contacts.PermissionStatus.GRANTED) {
        setStatus("denied");
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        pageSize: 1000,
      });
      setContacts(mapContacts(data));
      setStatus("granted");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return (
    <ContactsContext.Provider value={{ contacts, status, refreshing, refresh }}>
      {children}
    </ContactsContext.Provider>
  );
}
