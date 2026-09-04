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
// Breathing room around the icon+label content the indicator hugs, rather
// than filling the whole (flex-1, evenly-split) button width — the earlier
// full-width version, sized off the button itself, drew a pill much wider
// than the actual content it was highlighting.
const INDICATOR_PADDING_X = 10;

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
      return <Phone size={17} strokeWidth={1.9} color={tint} />;
    case TabIconName.Call:
      return <PhoneOutgoing size={17} strokeWidth={1.9} color={tint} />;
    case TabIconName.Agents:
      return (
        <Mascot
          seed="tab-agents"
          size={17}
          containerStyle={focused ? undefined : { opacity: 0.55 }}
        />
      );
    case TabIconName.Settings:
      return <Settings size={17} strokeWidth={1.9} color={tint} />;
  }
});

const TabButton = memo(function TabButton({
  name,
  label,
  focused,
  onPress,
  onLayout,
  onContentLayout,
}: {
  name: TabIconName;
  label: string;
  focused: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onContentLayout: (e: LayoutChangeEvent) => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      className="flex-1 items-center justify-center py-2"
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <View className="items-center gap-0.5" onLayout={onContentLayout}>
        <TabIcon name={name} focused={focused} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 9.5,
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
  // `buttonX`/`buttonWidth` (the flex-1 slot, evenly split four ways) place
  // the indicator on the right tab; `contentWidth` (the icon+label wrapper,
  // measured separately) is what it's actually sized to, since the two
  // rarely match — a short label like "Call" doesn't use nearly as much of
  // its slot as "Settings" does. Content is centered within its button, so
  // its own x offset there is derivable rather than needing a third
  // measurement.
  const [layouts, setLayouts] = useState<
    Record<
      number,
      { buttonX: number; buttonWidth: number; contentWidth: number | null }
    >
  >({});

  // Recomputed whenever the focused tab changes OR a tab's measured layout
  // arrives — a plain effect (not a shared-value mutation read back inside
  // a worklet) so the indicator always tracks the *current* focused index
  // rather than getting stuck on whichever tab last reported a layout.
  useEffect(() => {
    const layout = layouts[state.index];
    if (!layout) return;
    const { buttonX, buttonWidth, contentWidth } = layout;
    // Content not measured yet (first paint) — fall back to the full slot
    // rather than a zero-width indicator.
    const width =
      contentWidth === null
        ? buttonWidth
        : contentWidth + INDICATOR_PADDING_X * 2;
    const x =
      contentWidth === null
        ? buttonX
        : buttonX + (buttonWidth - contentWidth) / 2 - INDICATOR_PADDING_X;
    indicatorX.value = withSpring(x, SPRING);
    indicatorWidth.value = withSpring(width, SPRING);
  }, [state.index, layouts, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <View
      className="bg-canvas px-2.5 pt-1"
      style={{ paddingBottom: Math.max(insets.bottom, 6) }}
    >
      <View
        className="flex-row rounded-2xl border border-border bg-card px-1 py-1.5"
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
          className="absolute top-1.5 bottom-1.5 rounded-xl bg-accent"
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
            setLayouts((prev) => ({
              ...prev,
              [index]: {
                contentWidth: prev[index]?.contentWidth ?? null,
                buttonX: x,
                buttonWidth: width,
              },
            }));
          };

          const onContentLayout = (e: LayoutChangeEvent) => {
            const { width } = e.nativeEvent.layout;
            setLayouts((prev) => ({
              ...prev,
              [index]: {
                buttonX: prev[index]?.buttonX ?? 0,
                buttonWidth: prev[index]?.buttonWidth ?? 0,
                contentWidth: width,
              },
            }));
          };

          return (
            <TabButton
              key={route.key}
              name={route.name as TabIconName}
              label={label}
              focused={focused}
              onPress={onPress}
              onLayout={onLayout}
              onContentLayout={onContentLayout}
            />
          );
        })}
      </View>
    </View>
  );
}
