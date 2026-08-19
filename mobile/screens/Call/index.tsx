import { useState, useEffect, useCallback } from "react";
import { View, SectionList, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, Phone, Users } from "lucide-react-native";
import * as Contacts from "expo-contacts";
import { Mascot } from "@/components/Mascot";
import { Input } from "@/components/ui/input";
import { Text as UIText } from "@/components/ui/text";

type Contact = {
  id: string;
  name: string;
  phone: string;
};

type Section = {
  title: string;
  data: Contact[];
};

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

export default function CallScreen() {
  const [search, setSearch] = useState("");
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
          phone: c.phoneNumbers![0].number || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setContacts(mapped);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filtered = search
    ? contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
      )
    : contacts;

  const sections = buildSections(filtered);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#3c3832" />
          <UIText variant="muted" className="mt-3 text-sm">
            Loading contacts…
          </UIText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      {/* Search */}
      <View className="px-5 pt-2 pb-2">
        <View className="relative">
          <Search
            size={16}
            strokeWidth={1.75}
            color="#8f8c87"
            className="absolute left-3 top-3 z-10"
          />
          <Input
            className="pl-9"
            placeholder="Search"
            placeholderTextColor="#b0ada7"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      </View>

      {filtered.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-border">
            <Users size={22} strokeWidth={1.75} color="#b0ada7" />
          </View>
          <UIText variant="muted" className="mt-3 text-sm">
            {search ? "No contacts found" : "No contacts on this device"}
          </UIText>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={true}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderSectionHeader={({ section }) => (
            <View className="bg-canvas px-5 pt-3 pb-1.5">
              <UIText variant="muted" className="text-[11px] font-medium uppercase tracking-[0.14em]">
                {section.title}
              </UIText>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View>
              <Pressable
                onPress={() => {}}
                className="flex-row items-center bg-card px-5 py-3"
              >
                <View className="h-9 w-9 overflow-hidden rounded-full bg-border">
                  <Mascot seed={item.name} size={36} borderRadius={18} />
                </View>

                <View className="flex-1 ml-3">
                  <UIText className="text-[15px] font-medium" numberOfLines={1}>
                    {item.name}
                  </UIText>
                  <UIText variant="muted" className="mt-0.5 text-[13px]" numberOfLines={1}>
                    {item.phone}
                  </UIText>
                </View>

                <Pressable
                  onPress={() => {}}
                  className="h-8 w-8 items-center justify-center rounded-full bg-river-tint"
                  hitSlop={8}
                >
                  <Phone size={14} strokeWidth={1.75} color="#3b5dab" />
                </Pressable>
              </Pressable>
              {index < section.data.length - 1 && (
                <View className="h-px bg-border ml-[68px]" />
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
