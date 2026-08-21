import type { PropsWithChildren } from "react";
import Animated, { FadeInUp } from "react-native-reanimated";

export function Rise({
  children,
  delay = 0,
}: PropsWithChildren<{ delay?: number }>) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(380).springify().damping(20)}
    >
      {children}
    </Animated.View>
  );
}
