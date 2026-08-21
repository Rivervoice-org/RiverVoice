import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

/**
 * Gentle scale breathing on the wrapped child while `active` — used to mark
 * the agent avatar as "live" without a busy spinner. Freezes at rest scale
 * the moment `active` goes false rather than finishing its current cycle, so
 * it never keeps pulsing after the call ends.
 */
export function PulsingRing({ active, children }: { active: boolean; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}
