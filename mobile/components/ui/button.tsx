import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
} from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text } from "./text";

const buttonVariants = cva(
  "flex-row items-center justify-center gap-2 rounded-lg active:opacity-80 disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-foreground",
        secondary: "bg-secondary",
        outline: "border border-border bg-card",
        ghost: "bg-transparent",
        destructive: "bg-destructive",
      },
      size: {
        sm: "h-9 px-3",
        default: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

const textColor: Record<
  NonNullable<NonNullable<VariantProps<typeof buttonVariants>>["variant"]>,
  string
> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive-foreground",
};

type ButtonProps = PressableProps &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    ref?: React.Ref<React.ElementRef<typeof Pressable>>;
  };

function Button({
  className,
  variant = "default",
  size = "default",
  loading,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      ref={ref}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === "default" || variant === "destructive"
              ? "#fcfbf9"
              : "#3c3832"
          }
        />
      ) : typeof children === "string" ? (
        <Text className={cn("text-sm font-medium", textColor[variant ?? "default"])}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export { Button, buttonVariants };
