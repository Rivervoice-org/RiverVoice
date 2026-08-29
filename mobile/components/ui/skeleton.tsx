import { useEffect, useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";

const SWEEP_MS = 1150;
/** Band width as a fraction of the block it crosses. */
const BAND_RATIO = 0.7;
/**
 * The highlight has no gradient primitive behind it — `expo-linear-gradient`
 * is a native module, and a skeleton is not worth a rebuild of the dev
 * client. So the band is sliced into this many columns whose opacities
 * follow a raised cosine, which is a gradient in every way that matters at
 * this size.
 */
const SLICES = 14;

/**
 * Peak opacity of the white highlight. The band is white in both schemes —
 * over a light base it reads as a bright sweep, over a dark one as a
 * lightening — but it needs an order of magnitude less of it in the dark to
 * avoid looking like a torch.
 */
const PEAK_OPACITY = { light: 0.85, dark: 0.09 } as const;

/**
 * A placeholder block that shimmers while a real view loads its content.
 * Reserve the space the eventual content will occupy — no more — so
 * swapping in the real thing doesn't make the page jump.
 *
 * The base is `bg-border` rather than `bg-muted`: muted sits within a
 * couple of percent of the card it is usually drawn on, so a muted block
 * was very nearly invisible, and any highlight crossing it more so.
 */
function Skeleton({ className }: { className?: string }) {
  const { scheme } = useTheme();
  const reducedMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  const bandWidth = width * BAND_RATIO;

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, reducedMotion]);

  // Raised cosine, so the band fades in and out at its edges instead of
  // ending on two hard vertical lines.
  const opacities = useMemo(() => {
    const peak = PEAK_OPACITY[scheme === "dark" ? "dark" : "light"];
    return Array.from({ length: SLICES }, (_, i) => {
      const t = (i + 0.5) / SLICES;
      return Math.sin(Math.PI * t) ** 2 * peak;
    });
  }, [scheme]);

  const sweep = useAnimatedStyle(() => ({
    // Starts fully off the left edge and leaves past the right, so each pass
    // is a clean crossing with a beat of stillness between.
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-bandWidth, width + bandWidth * 0.4],
        ),
      },
    ],
  }));

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <View className={cn("overflow-hidden bg-border", className)} onLayout={onLayout}>
      {width > 0 && !reducedMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              width: bandWidth,
              flexDirection: "row",
            },
            sweep,
          ]}
        >
          {opacities.map((opacity, index) => (
            <View
              key={index}
              style={{ flex: 1, backgroundColor: "#ffffff", opacity }}
            />
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

export { Skeleton };
