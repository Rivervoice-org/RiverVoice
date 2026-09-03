import { memo, useEffect, useState } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Phone, PhoneOutgoing, Settings } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { useThemeColors } from "@/lib/theme";

enum TabIconName {
  Home = "index",
  Agents = "agents",
  Call = "call",
  Settings = "settings",
}

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };

/**
 * Memoized: the tab bar re-renders on every navigation state change, and
 * without this every icon would re-render on each tab switch instead of
 * just the affected ones.
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
  switch (name) {
    case TabIconName.Home:
      return <Phone size={21} strokeWidth={1.9} color={tint} />;
    case TabIconName.Call:
      return <PhoneOutgoing size={21} strokeWidth={1.9} color={tint} />;
    case TabIconName.Agents:
      return (
        <Mascot
          seed="tab-agents"
          size={21}
          containerStyle={focused ? undefined : { opacity: 0.55 }}
        />
      );
    case TabIconName.Settings:
      return <Settings size={21} strokeWidth={1.9} color={tint} />;
  }
});

const TabButton = memo(function TabButton({
  name,
  label,
  focused,
  onPress,
  onLayout,
}: {
  name: TabIconName;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      className="flex-1 items-center justify-center py-2"
      hitSlop={8}
    >
      <View className="items-center gap-1">
        <TabIcon name={name} focused={focused} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 10.5,
            fontWeight: focused ? "700" : "500",
            letterSpacing: 0.1,
            color: focused ? colors.ink : colors.muted,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
});

/**
 * Floating pill tab bar with a sliding neutral indicator that glides under
 * the focused tab instead of the default underline, so switching tabs
 * reads as one continuous motion rather than four static icon swaps.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const [layouts, setLayouts] = useState<
    Record<number, { x: number; width: number }>
  >({});

  // Recomputed whenever the focused tab changes OR a tab's measured layout
  // arrives — a plain effect (not a shared-value mutation read back inside
  // a worklet) so the indicator always tracks the *current* focused index
  // rather than getting stuck on whichever tab last reported a layout.
  useEffect(() => {
    const layout = layouts[state.index];
    if (!layout) return;
    indicatorX.value = withSpring(layout.x, SPRING);
    indicatorWidth.value = withSpring(layout.width, SPRING);
  }, [state.index, layouts, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View
      className="bg-canvas px-4 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      <View
        className="flex-row rounded-3xl border border-border bg-card px-1.5 py-1.5"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 8,
        }}
      >
        <Animated.View
          pointerEvents="none"
          className="absolute top-1.5 bottom-1.5 rounded-2xl bg-accent"
          style={indicatorStyle}
        />
        {state.routes.map((route, index) => {
          const options = descriptors[route.key]?.options;
          const focused = state.index === index;
          const label =
            typeof options?.title === "string" ? options.title : route.name;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLayout = (e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            setLayouts((prev) => ({ ...prev, [index]: { x, width } }));
          };

          return (
            <TabButton
              key={route.key}
              name={route.name as TabIconName}
              label={label}
              focused={focused}
              onPress={onPress}
              onLayout={onLayout}
            />
          );
        })}
      </View>
    </View>
  );
}
