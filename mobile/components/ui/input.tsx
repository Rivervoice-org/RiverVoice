import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

type InputProps = TextInputProps & {
  ref?: React.Ref<TextInput>;
  /** Android-only runtime prop, absent from the RN types. */
  includeFontPadding?: boolean;
};

function Input({ className, placeholderTextColor, ref, ...props }: InputProps) {
  const themeColors = useThemeColors();
  const resolvedPlaceholderTextColor = placeholderTextColor ?? themeColors.muted;
  return (
    <TextInput
      ref={ref}
      className={cn(
        "h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground",
        className
      )}
      placeholderTextColor={resolvedPlaceholderTextColor}
      textAlignVertical="center"
      // Android pads the font metrics above and below the glyphs, which
      // pushes the placeholder off-center even with textAlignVertical.
      includeFontPadding={false}
      {...props}
    />
  );
}

export { Input };
