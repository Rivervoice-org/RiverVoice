import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { View, SectionList, Linking, type SectionListRenderItem } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, Users } from "lucide-react-native";
import * as Contacts from "expo-contacts";
import { Mascot } from "@/components/Mascot";
import { SearchInput } from "@/components/SearchInput";
import { CallRow } from "@/components/CallRow";
import { DialFab } from "@/components/DialFab";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type Section = {
  title: string;
  data: Contact[];
};

const SEARCH_DEBOUNCE_MS = 150;

function buildSections(contacts: Contact[]): Section[] {
  const map = new Map<string, Contact[]>();
  for (const c of contacts) {
    const letter = c.name[0]?.toUpperCase() || "#";
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(c);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([title, data]) => ({ title, data }));
}

/**
 * Memoized so opening/closing the dial pad — or any other unrelated state
 * change in a parent — doesn't force every visible row to re-render. Only
 * re-renders when its own contact or divider flag actually changes.
 */
const ContactRow = memo(function ContactRow({
  contact,
  showDivider,
}: {
  contact: Contact;
  showDivider: boolean;
}) {
  return (
    <View className="px-5">
      <CallRow
        avatar={<Mascot seed={contact.name} size={32} />}
        title={contact.name}
        subtitle={
          <Text font="mono" variant="muted" className="text-[11px]" numberOfLines={1}>
            {contact.phone}
          </Text>
        }
        trailing={
          <View className="h-8 w-8 items-center justify-center rounded-full bg-river-tint">
            <Phone size={14} strokeWidth={1.75} color="#3b5dab" />
          </View>
        }
        showDivider={showDivider}
        onPress={() => Linking.openURL(`tel:${contact.phone}`)}
      />
    </View>
  );
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="bg-canvas px-5 pt-4 pb-1.5">
      <Text variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
        {title}
      </Text>
    </View>
  );
}

export default function CallScreen() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    const { status } = await Contacts.requestPermissionsAsync();
    if (status === Contacts.PermissionStatus.GRANTED) {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        pageSize: 1000,
      });
      const mapped: Contact[] = data
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0 && c.name)
        .map((c) => ({
          id: c.id,
          name: c.name!,
          phone: c.phoneNumbers?.[0]?.number || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setContacts(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Debounced so typing doesn't re-filter/re-sort hundreds of contacts on
  // every keystroke — only once input settles.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), SEARCH_DEBOUNCE_MS);
  }, []);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const filtered = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return debouncedSearch
      ? contacts.filter(
          (c) => c.name.toLowerCase().includes(query) || c.phone.includes(debouncedSearch)
        )
      : contacts;
  }, [contacts, debouncedSearch]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => <SectionHeader title={section.title} />,
    []
  );

  const renderItem: SectionListRenderItem<Contact, Section> = useCallback(
    ({ item, index, section }) => (
      <ContactRow contact={item} showDivider={index < section.data.length - 1} />
    ),
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — matches the other tab roots (Agents, My numbers) */}
      <View className="px-5 pt-3 pb-1">
        <Text className="text-[28px] font-semibold tracking-[-0.02em]">
          Call
        </Text>
        {!loading && (
          <Text variant="muted" className="mt-1 text-sm">
            {contacts.length} contact{contacts.length === 1 ? "" : "s"}
          </Text>
        )}
      </View>

      {/* Search */}
      <View className="px-5 pt-2 pb-2">
        <SearchInput value={search} onChangeText={handleSearchChange} placeholder="Search" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
            <Users size={22} strokeWidth={1.75} color="#b0ada7" />
          </View>
          <Text variant="muted" className="mt-3 text-sm">
            {search ? "No contacts found" : "No contacts on this device"}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={renderSectionHeader}
          renderItem={renderItem}
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <DialFab />
    </SafeAreaView>
  );
}
