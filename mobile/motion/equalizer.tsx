import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const DEFAULT_HEIGHTS = [
  0.45, 1, 0.65, 0.8, 0.5, 0.9, 0.55, 1, 0.7, 0.4,
] as const;

function Bar({
  progress,
  phase,
  base,
  height,
  color,
}: {
  progress: SharedValue<number>;
  phase: number;
  base: number;
  height: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const wave = Math.abs(Math.sin(progress.value * Math.PI * 2 + phase));
    return { height: Math.max(3, base * height * (0.3 + wave * 0.7)) };
  });

  return (
    <Animated.View
      style={[{ flex: 1, borderRadius: 999, backgroundColor: color }, style]}
    />
  );
}

export function Equalizer({
  bars = 10,
  height = 26,
  color = "#3c3832",
}: {
  bars?: number;
  height?: number;
  color?: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 900 }), -1, true);
  }, [progress]);

  return (
    <View className="flex-1 flex-row items-end gap-[3px]" style={{ height }}>
      {Array.from({ length: bars }).map((_, index) => (
        <Bar
          key={index}
          progress={progress}
          phase={(index / bars) * Math.PI * 2}
          // Always in bounds (modulo the array's own length) — the fallback is unreachable.
          base={
            DEFAULT_HEIGHTS[index % DEFAULT_HEIGHTS.length] ??
            DEFAULT_HEIGHTS[0]
          }
          height={height}
          color={color}
        />
      ))}
    </View>
  );
}
