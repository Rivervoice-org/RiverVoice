import * as React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const textVariants = cva("text-foreground", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      destructive: "text-destructive",
    },
    font: {
      default: "",
      mono: "font-mono",
    },
  },
  defaultVariants: { variant: "default", font: "default" },
});

type TextProps = RNTextProps &
  VariantProps<typeof textVariants> & { ref?: React.Ref<RNText> | undefined };

function Text({ className, variant, font, ref, ...props }: TextProps) {
  return (
    <RNText
      ref={ref}
      className={cn(textVariants({ variant, font }), className)}
      {...props}
    />
  );
}

export { Text, textVariants };
