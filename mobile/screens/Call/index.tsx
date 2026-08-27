import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  View,
  SectionList,
  RefreshControl,
  type SectionListRenderItem,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Phone, Users } from "lucide-react-native";
import { SearchInput } from "@/components/SearchInput";
import { CallRow } from "@/components/CallRow";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { DialFab } from "@/components/DialFab";
import { Rise } from "@/components/ui/rise";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";
import { useAgentPicker } from "@/hooks/use-agent-picker";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useContacts, type Contact } from "@/state/contacts";

type Section = {
  title: string;
  data: Contact[];
};

const SEARCH_DEBOUNCE_MS = 150;

function buildSections(contacts: Contact[]): Section[] {
  const map = new Map<string, Contact[]>();
  for (const c of contacts) {
    const letter = c.name[0]?.toUpperCase() || "#";
    const bucket = map.get(letter);
    if (bucket) {
      bucket.push(c);
    } else {
      map.set(letter, [c]);
    }
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
  const colors = useThemeColors();
  const { pickAgentForCall } = useAgentPicker();
  const { requireAuth } = useRequireAuth();
  return (
    <View className="px-5">
      <CallRow
        avatar={<InitialsAvatar name={contact.name} size={32} />}
        title={contact.name}
        subtitle={
          <Text
            font="mono"
            variant="muted"
            className="text-[11px]"
            numberOfLines={1}
          >
            {contact.phone}
          </Text>
        }
        trailing={
          <View className="h-8 w-8 items-center justify-center rounded-full bg-river-tint">
            <Phone size={14} strokeWidth={1.75} color={colors.river} />
          </View>
        }
        showDivider={showDivider}
        onPress={() => requireAuth(() => pickAgentForCall(contact))}
      />
    </View>
  );
});

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="bg-canvas px-5 pt-4 pb-1.5">
      <Text
        variant="muted"
        className="text-[11px] font-medium uppercase tracking-[0.14em]"
      >
        {title}
      </Text>
    </View>
  );
}

export default function CallScreen() {
  const colors = useThemeColors();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { contacts, status, refreshing, refresh } = useContacts();
  const loading = status === "loading";

  // Debounced so typing doesn't re-filter/re-sort hundreds of contacts on
  // every keystroke — only once input settles.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(text),
      SEARCH_DEBOUNCE_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const filtered = useMemo(() => {
    const query = debouncedSearch.toLowerCase();
    return debouncedSearch
      ? contacts.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(debouncedSearch),
        )
      : contacts;
  }, [contacts, debouncedSearch]);

  const sections = useMemo(() => buildSections(filtered), [filtered]);

  const keyExtractor = useCallback((item: Contact) => item.id, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <SectionHeader title={section.title} />
    ),
    [],
  );

  const renderItem: SectionListRenderItem<Contact, Section> = useCallback(
    ({ item, index, section }) => (
      <ContactRow
        contact={item}
        showDivider={index < section.data.length - 1}
      />
    ),
    [],
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Header — matches the other tab roots (Agents, My numbers) */}
      <Rise index={0}>
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
      </Rise>

      {/* Search */}
      <Rise index={1}>
        <View className="px-5 pt-2 pb-2">
          <SearchInput
            value={search}
            onChangeText={handleSearchChange}
            placeholder="Search"
          />
        </View>
      </Rise>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
            <Users size={22} strokeWidth={1.75} color={colors.faint} />
          </View>
          <Text variant="muted" className="mt-3 text-sm">
            {search
              ? "No contacts found"
              : status === "denied"
                ? "Contacts permission denied"
                : "No contacts on this device"}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.muted}
            />
          }
        />
      )}

      <DialFab />
    </SafeAreaView>
  );
}
