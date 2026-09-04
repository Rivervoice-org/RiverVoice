import { memo, useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

/**
 * Three dots bouncing in a staggered loop — the generic "something is live
 * right now" indicator (someone talking, audio playing) used wherever text
 * hasn't caught up with what's actually happening on the line. Each dot
 * starts its cycle 120ms after the last one, which is what reads as a
 * "wave" rather than three dots blinking in unison.
 */
export const TypingDots = memo(function TypingDots({
  color = "currentColor",
  size = 5,
}: {
  color?: string;
  size?: number;
}) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(value, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 120),
        ]),
      ),
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View className="flex-row items-center" style={{ gap: size * 0.7 }}>
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [
              {
                translateY: value.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -size * 0.8],
                }),
              },
            ],
            opacity: value.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
          }}
        />
      ))}
    </View>
  );
});
