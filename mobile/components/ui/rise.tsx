import { useCallback, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

const DURATION = 500;
// Mirrors web's --animate-rise (globals.css): cubic-bezier(0.22, 1, 0.36, 1), 6px, 0.5s.
const EASING = Easing.bezier(0.22, 1, 0.36, 1);
const OFFSET = 6;
const STEP = 70;

// Rows within a list step in faster than top-level sections, and stop
// staggering past ROW_CAP rows so a long list doesn't take seconds to finish
// arriving — everything past the cap arrives together with the capped row.
const ROW_STEP = 45;
const ROW_CAP = 6;

/**
 * Delay for the Nth row of a list that itself lives inside section
 * `sectionIndex` (see `Rise`'s `index` prop) — e.g. the 3rd row of a list
 * that's the 2nd section on the screen: `rowDelay(2, 2)`.
 */
export function rowDelay(sectionIndex: number, rowIndex: number) {
  return sectionIndex * STEP + Math.min(rowIndex, ROW_CAP - 1) * ROW_STEP;
}

/**
 * A section fading and rising in on screen focus, mirroring the web
 * dashboard's `animate-rise` cascade (header first, then each section a beat
 * later). Replays every time the screen regains focus — e.g. switching tabs
 * — not just on first mount, so the wave is felt on every navigation.
 *
 * Pass either `delay` directly (ms) or `index` to derive it from the
 * standard 70ms step used across screens.
 */
export function Rise({
  children,
  delay,
  index,
  style,
}: {
  children: ReactNode;
  delay?: number;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const resolvedDelay = delay ?? (index ?? 0) * STEP;
  const progress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      progress.value = withDelay(
        resolvedDelay,
        withTiming(1, { duration: DURATION, easing: EASING }),
      );
      return () => {
        progress.value = 0;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resolvedDelay]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * OFFSET }],
  }));

  return (
    <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>
  );
}
