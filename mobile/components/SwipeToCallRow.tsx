import { memo, useCallback, useRef, type ReactNode } from "react";
import { View } from "react-native";
import Swipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { Phone } from "lucide-react-native";
import { useThemeColors } from "@/lib/theme";

const LEFT_ACTION_WIDTH = 120;

/**
 * The reveal icon, as a real component rather than inline in
 * `renderLeftActions` below. `useAnimatedStyle` needs to run through
 * React's actual hook lifecycle — called from inside a plain callback that
 * a third-party render prop invokes, it has no component to mount/unmount
 * it, so the UI-thread mapper it creates can end up never torn down. With
 * 18 rows on the Home screen each doing that, leaked per-frame mappers
 * compounding over time was tanking frame rate even at rest. A real
 * component gets a real unmount, so this can't leak.
 */
const SwipeCallIcon = memo(function SwipeCallIcon({
  progress,
  color,
}: {
  progress: SharedValue<number>;
  color: string;
}) {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [0.5, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return (
    <Animated.View style={iconStyle}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-green">
        <Phone size={15} strokeWidth={2} color={color} />
      </View>
    </Animated.View>
  );
});

/**
 * Swipe-right-to-call, the same gesture as the native Phone app's recents
 * list. Built on RNGH's own `Swipeable` (from `.../ReanimatedSwipeable`),
 * not a hand-rolled `Gesture.Pan` — a bare pan gesture nested inside a
 * scrollable list kept either blocking the list's scroll or triggering on
 * vertical drags (the row "sliding" instead of the page scrolling),
 * because getting that gesture-priority arbitration right is exactly what
 * `Swipeable` already solves, tested at the scale this library is used at.
 * Reinventing it was the mistake, not any one threshold value.
 */
export function SwipeToCallRow({
  children,
  onCall,
  disabled,
}: {
  children: ReactNode;
  onCall: () => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  const swipeableRef = useRef<SwipeableMethods>(null);

  // `direction` here is which way the row moved, not which action panel
  // opened — swiping right (revealing renderLeftActions, below) reports
  // SwipeDirection.RIGHT. RNGH's own naming, confirmed from its source:
  // ReanimatedSwipeable.tsx reports `toValue > 0 ? RIGHT : LEFT`, and a
  // positive toValue is exactly the row sliding right.
  const handleOpen = useCallback(
    (direction: SwipeDirection) => {
      if (direction === SwipeDirection.RIGHT) {
        onCall();
        swipeableRef.current?.close();
      }
    },
    [onCall],
  );

  const renderLeftActions = useCallback(
    (progress: SharedValue<number>) => (
      <View
        className="bg-green-tint"
        style={{
          width: LEFT_ACTION_WIDTH,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SwipeCallIcon progress={progress} color={colors.onInk} />
      </View>
    ),
    [colors.onInk],
  );

  return (
    <Swipeable
      ref={swipeableRef}
      enabled={!disabled}
      renderLeftActions={renderLeftActions}
      leftThreshold={68}
      overshootLeft={false}
      friction={1.4}
      // Default is 10px — eager enough that every vertical scroll touch
      // over a row still makes this row's own PanGestureHandler spend a
      // moment contesting for the gesture before ceding to the ScrollView,
      // which is what reads as scroll "friction" now that there are 18 of
      // these live at once. Requiring a clearer horizontal intent first
      // means a vertical drag gets released to the scroll view sooner.
      dragOffsetFromLeftEdge={30}
      onSwipeableOpen={handleOpen}
    >
      <View className="bg-card">{children}</View>
    </Swipeable>
  );
}
