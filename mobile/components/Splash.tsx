import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Waves } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useThemeColors } from "@/lib/theme";

const OVERSHOOT = Easing.bezier(0.34, 1.4, 0.5, 1);
const SETTLE = Easing.bezier(0.22, 1, 0.36, 1);
const CLEAR = Easing.bezier(0.65, 0, 0.35, 1);

const MARK_DURATION = 750;
const WORD_DURATION = 700;
const WORD_DELAY = 160;
const TAGLINE_DELAY = 420;
const HOLD_UNTIL = 1156; // 68% of the 1700ms web timeline
const CLEAR_DURATION = 544;
const TOTAL_DURATION = HOLD_UNTIL + CLEAR_DURATION;

/**
 * Mirrors the web app's dashboard splash (logo pop, wordmark wipe, tagline
 * settle, then a fade + lift) so first paint reads the same on both. Plays
 * once, over the first screen, then removes itself — see RootLayout.
 */
export function Splash({ onDone }: { onDone?: () => void }) {
  const colors = useThemeColors();
  const markScale = useRef(new Animated.Value(0.4)).current;
  const markRotate = useRef(new Animated.Value(-12)).current;
  const markOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(6)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.parallel([
        Animated.timing(markScale, {
          toValue: 1,
          duration: MARK_DURATION,
          easing: OVERSHOOT,
          useNativeDriver: true,
        }),
        Animated.timing(markRotate, {
          toValue: 0,
          duration: MARK_DURATION,
          easing: OVERSHOOT,
          useNativeDriver: true,
        }),
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: MARK_DURATION,
          easing: OVERSHOOT,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(WORD_DELAY),
        Animated.parallel([
          Animated.timing(wordScale, {
            toValue: 1,
            duration: WORD_DURATION,
            easing: SETTLE,
            useNativeDriver: true,
          }),
          Animated.timing(wordOpacity, {
            toValue: 1,
            duration: WORD_DURATION,
            easing: SETTLE,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(TAGLINE_DELAY),
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: WORD_DURATION,
            easing: SETTLE,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslateY, {
            toValue: 0,
            duration: WORD_DURATION,
            easing: SETTLE,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.sequence([
        Animated.delay(HOLD_UNTIL),
        Animated.parallel([
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: CLEAR_DURATION,
            easing: CLEAR,
            useNativeDriver: true,
          }),
          Animated.timing(lift, {
            toValue: -10,
            duration: CLEAR_DURATION,
            easing: CLEAR,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    const timeout = setTimeout(() => onDone?.(), TOTAL_DURATION);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        styles.overlay,
        { backgroundColor: colors.canvas, opacity: overlayOpacity },
      ]}
    >
      <Animated.View
        style={{
          alignItems: "center",
          gap: 10,
          transform: [{ translateY: lift }],
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Animated.View
            style={{
              height: 36,
              width: 36,
              borderRadius: 12,
              backgroundColor: colors.ink,
              alignItems: "center",
              justifyContent: "center",
              opacity: markOpacity,
              transform: [
                { scale: markScale },
                {
                  rotate: markRotate.interpolate({
                    inputRange: [-12, 0],
                    outputRange: ["-12deg", "0deg"],
                  }),
                },
              ],
            }}
          >
            <Waves size={20} strokeWidth={2} color={colors.onInk} />
          </Animated.View>

          <Animated.View
            style={{
              opacity: wordOpacity,
              transform: [{ scaleX: wordScale }],
              transformOrigin: "left",
            }}
          >
            <Text style={{ fontSize: 28, lineHeight: 28, fontWeight: "600", letterSpacing: -0.8 }}>
              Rivervoice
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={{
            opacity: taglineOpacity,
            transform: [{ translateY: taglineTranslateY }],
          }}
        >
          <Text variant="muted" className="text-[13px]">
            Voice agents, built for India
          </Text>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
  },
});
