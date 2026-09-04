import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Coins, PhoneOutgoing } from "lucide-react-native";
import { Mascot } from "@/components/Mascot";
import { Text } from "@/components/ui/text";
import { PulseRing } from "@/motion/pulse-ring";
import { Equalizer } from "@/motion/equalizer";
import { useThemeColors } from "@/lib/theme";
import { SEEDS } from "@/lib/mascots";

/** Radial: a face at the center of live, expanding call rings. */
export function TranslateIllustration() {
  const colors = useThemeColors();
  return (
    <View className="h-56 items-center justify-center">
      <PulseRing size={40} color={colors.ink} duration={2400} />
      <PulseRing size={40} color={colors.ink} duration={2400} delay={800} />
      <View className="absolute items-center justify-center">
        <View className="h-24 w-24 items-center justify-center rounded-full border border-border bg-card shadow-float">
          <Mascot
            seed="Nikhil"
            size={64}
            params={{ glassesProbability: 100 }}
          />
        </View>
        <View className="mt-4 h-7 w-20">
          <Equalizer bars={9} height={22} color={colors.faint} />
        </View>
      </View>
    </View>
  );
}

/** Horizontal fan: three faces, the middle one lifted forward. */
export function AgentsIllustration() {
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 900 }),
        withTiming(0, { duration: 900 }),
      ),
      -1,
      true,
    );
  }, [lift]);

  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  const seeds = [SEEDS[2], SEEDS[0], SEEDS[4]].filter(Boolean);

  return (
    <View className="h-56 flex-row items-center justify-center">
      {seeds.map((seed, index) => {
        const isCenter = index === 1;
        return (
          <Animated.View
            key={seed}
            style={[
              {
                marginHorizontal: -10,
                zIndex: isCenter ? 1 : 0,
                opacity: isCenter ? 1 : 0.55,
              },
              isCenter ? centerStyle : undefined,
            ]}
          >
            <View
              className="items-center justify-center rounded-full border border-border bg-card shadow-float"
              style={{
                height: isCenter ? 96 : 76,
                width: isCenter ? 96 : 76,
              }}
            >
              <Mascot seed={seed} size={isCenter ? 60 : 46} />
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Stacked list: call-history rows settling into place beside a credits pill. */
export function CallsIllustration() {
  const colors = useThemeColors();
  const rows = [
    { name: "Aarav Shah", meta: "2 min ago" },
    { name: "Priya Nair", meta: "Yesterday" },
    { name: "Kabir Verma", meta: "Mon" },
  ];

  const pillScale = useSharedValue(1);
  useEffect(() => {
    pillScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      true,
    );
  }, [pillScale]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  return (
    <View className="h-56 items-center justify-center gap-2">
      <View className="w-full max-w-[240px] overflow-hidden rounded-xl border border-border bg-card">
        {rows.map((row, index) => (
          <Animated.View
            key={row.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <Mascot seed={row.name} size={28} />
            <View className="flex-1">
              <Text className="text-[13px] font-medium">{row.name}</Text>
              <Text variant="muted" className="text-[11px]">
                {row.meta}
              </Text>
            </View>
            <PhoneOutgoing size={13} strokeWidth={1.75} color={colors.muted} />
          </Animated.View>
        ))}
      </View>

      <Animated.View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 12,
            paddingVertical: 6,
          },
          pillStyle,
        ]}
      >
        <Coins size={13} strokeWidth={1.75} color={colors.muted} />
        <Text className="text-[12px] font-medium">
          Credits track every call
        </Text>
      </Animated.View>
    </View>
  );
}
