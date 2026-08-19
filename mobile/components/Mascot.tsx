import React, { useEffect, useState } from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";

type MascotStyle = "notionists" | "lorelei";

interface MascotProps {
  seed: string;
  size?: number;
  style?: MascotStyle;
  borderRadius?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

function getAvatarUrl(seed: string, size: number, style: MascotStyle = "notionists"): string {
  return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&size=${size}&radius=50&scale=130&translateY=6`;
}

export function Mascot({
  seed,
  size = 32,
  style = "notionists",
  borderRadius,
  containerStyle,
}: MascotProps) {
  const uri = getAvatarUrl(seed, size, style);

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
        borderRadius: borderRadius ?? size / 2,
        backgroundColor: "#f5f4f3",
      }}
      accessibilityLabel={`${seed} mascot`}
    />
  );
}
