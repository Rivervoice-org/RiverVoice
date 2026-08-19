import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

type InputProps = TextInputProps & {
  ref?: React.Ref<TextInput>;
  /** Android-only runtime prop, absent from the RN types. */
  includeFontPadding?: boolean;
};

function Input({ className, placeholderTextColor = "#8f8c87", ref, ...props }: InputProps) {
  return (
    <TextInput
      ref={ref}
      className={cn(
        "h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground",
        className
      )}
      placeholderTextColor={placeholderTextColor}
      textAlignVertical="center"
      // Android pads the font metrics above and below the glyphs, which
      // pushes the placeholder off-center even with textAlignVertical.
      includeFontPadding={false}
      {...props}
    />
  );
}

export { Input };
