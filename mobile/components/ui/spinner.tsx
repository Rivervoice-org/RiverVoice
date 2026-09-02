import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";
import { useThemeColors } from "@/lib/theme";

/**
 * A quiet rotating ring — the Notion-style loading affordance: one thin
 * indeterminate spinner, no color, no shimmer. Prefer this over content
 * skeletons for anything that resolves quickly (a permission prompt, a
 * contacts read) where blocking layout would just be noise.
 */
function Spinner({
  size = 20,
  color,
  trackColor,
}: {
  size?: number;
  color?: string;
  trackColor?: string;
}) {
  const themeColors = useThemeColors();
  const resolvedColor = color ?? themeColors.ink;
  const resolvedTrackColor = trackColor ?? themeColors.border;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 750,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(2, Math.round(size / 9)),
        borderColor: resolvedTrackColor,
        borderTopColor: resolvedColor,
        transform: [{ rotate: spin }],
      }}
    />
  );
}

export { Spinner };
