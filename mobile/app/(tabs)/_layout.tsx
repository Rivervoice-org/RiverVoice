import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, PhoneOutgoing, Settings, Hash } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { useThemeColors } from "@/lib/theme";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colors = useThemeColors();
  const icons: Record<string, React.ReactNode> = {
    home: <Phone size={22} strokeWidth={1.75} color={focused ? colors.ink : colors.muted} />,
    call: (
      <View className="h-14 w-14 -mt-7 items-center justify-center rounded-full bg-foreground shadow-lift">
        <PhoneOutgoing size={24} strokeWidth={2} color={colors.onInk} />
      </View>
    ),
    phonebook: <Hash size={22} strokeWidth={1.75} color={focused ? colors.ink : colors.muted} />,
    agents: <Mascot seed="tab-agents" size={22} />,
    settings: <Settings size={22} strokeWidth={1.75} color={focused ? colors.ink : colors.muted} />,
  };

  return (
    <View className="items-center gap-1">
      {icons[name]}
      {name !== "call" && focused && (
        <View className="h-0.5 w-4 rounded-full bg-amber" />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: "none",
        sceneStyle: { backgroundColor: colors.canvas },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0.02,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: "Agents",
          tabBarIcon: ({ focused }) => <TabIcon name="agents" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="call"
        options={{
          title: "Call",
          tabBarIcon: ({ focused }) => <TabIcon name="call" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="phonebook"
        options={{
          title: "My numbers",
          tabBarIcon: ({ focused }) => <TabIcon name="phonebook" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
