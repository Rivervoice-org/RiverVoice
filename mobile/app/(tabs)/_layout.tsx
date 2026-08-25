import { memo } from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Phone, PhoneOutgoing, Settings, Mic } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { useThemeColors } from "@/lib/theme";

enum TabIconName {
  Home = "home",
  Call = "call",
  VoiceClone = "voiceClone",
  Agents = "agents",
  Settings = "settings",
}

/**
 * Memoized because the tab bar re-invokes every screen's tabBarIcon on any
 * navigation state change — without this, switching tabs re-renders all
 * five icons instead of just the previously- and newly-focused ones.
 */
const TabIcon = memo(function TabIcon({
  name,
  focused,
}: {
  name: TabIconName;
  focused: boolean;
}) {
  const colors = useThemeColors();
  const tint = focused ? colors.ink : colors.muted;
  let icon: React.ReactNode;
  switch (name) {
    case TabIconName.Home:
      icon = <Phone size={22} strokeWidth={1.75} color={tint} />;
      break;
    case TabIconName.Call:
      icon = (
        <View className="h-14 w-14 -mt-7 items-center justify-center rounded-full bg-foreground shadow-lift">
          <PhoneOutgoing size={24} strokeWidth={2} color={colors.onInk} />
        </View>
      );
      break;
    case TabIconName.VoiceClone:
      icon = <Mic size={22} strokeWidth={1.75} color={tint} />;
      break;
    case TabIconName.Agents:
      icon = <Mascot seed="tab-agents" size={22} />;
      break;
    case TabIconName.Settings:
      icon = <Settings size={22} strokeWidth={1.75} color={tint} />;
      break;
  }

  return (
    <View className="items-center gap-1">
      {icon}
      {name !== TabIconName.Call && focused && (
        <View className="h-0.5 w-4 rounded-full bg-amber" />
      )}
    </View>
  );
});

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
          tabBarIcon: ({ focused }) => <TabIcon name={TabIconName.Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="agents"
        options={{
          title: "Agents",
          tabBarIcon: ({ focused }) => <TabIcon name={TabIconName.Agents} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="call"
        options={{
          title: "Call",
          tabBarIcon: ({ focused }) => <TabIcon name={TabIconName.Call} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="voice-clone"
        options={{
          title: "Voice clone",
          tabBarIcon: ({ focused }) => <TabIcon name={TabIconName.VoiceClone} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon name={TabIconName.Settings} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
