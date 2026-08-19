import { memo, useEffect, useState } from "react";
import { Animated, Image, type StyleProp, type ViewStyle } from "react-native";
import { avatarUrl, mascotRef, parseMascot } from "@/lib/mascots";

export type MascotStyle = "notionists" | "lorelei";

export interface MascotProps {
  seed?: string;
  size?: number;
  style?: MascotStyle;
  /** "style:seed"; takes precedence over seed and style when given. */
  ref?: string;
  borderRadius?: number;
  className?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * DiceBear's API renders the PNG; the URL is deterministic, so the same face
 * always costs one network hit and Image's own cache serves the rest. Fades in
 * on load so an unloaded face reads as a loading tile, not a blank spot.
 */
export const Mascot = memo(function Mascot({
  seed = "new-agent",
  size = 32,
  style = "notionists",
  ref: mascotRefProp,
  borderRadius,
  className,
  containerStyle,
}: MascotProps) {
  const [loaded, setLoaded] = useState(false);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!loaded) return;
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [loaded, opacity]);

  const ref = mascotRefProp ?? mascotRef(style, seed);
  const { seed: refSeed } = parseMascot(ref);
  const uri = avatarUrl(ref, size);

  return (
    <Animated.View
      className={className}
      style={[
        {
          width: size,
          height: size,
          borderRadius: borderRadius ?? size / 2,
          overflow: "hidden",
          backgroundColor: "#f5f4f3",
          opacity,
        },
        containerStyle,
      ]}
    >
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        onLoad={() => setLoaded(true)}
        accessibilityLabel={`${refSeed} mascot`}
      />
    </Animated.View>
  );
});
