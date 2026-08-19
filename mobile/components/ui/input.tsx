import * as React from "react";
import { TextInput, type TextInputProps } from "react-native";
import { cn } from "@/lib/utils";

type InputProps = TextInputProps & { ref?: React.Ref<TextInput> };

function Input({
  className,
  placeholderTextColor = "#8f8c87",
  onFocus,
  onBlur,
  ref,
  ...props
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      ref={ref}
      className={cn(
        "h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground",
        focused && "border-foreground/60",
        className
      )}
      placeholderTextColor={placeholderTextColor}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      {...props}
    />
  );
}

export { Input };
