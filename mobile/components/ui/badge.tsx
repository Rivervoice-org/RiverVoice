import * as React from "react";
import { View, type ViewProps } from "react-native";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Text } from "./text";

const badgeVariants = cva("flex-row items-center rounded-full px-2.5 py-1", {
  variants: {
    variant: {
      default: "bg-foreground",
      secondary: "bg-secondary",
      outline: "border border-border bg-card",
      destructive: "bg-destructive",
      river: "bg-river-tint",
      green: "bg-green-tint",
      amber: "bg-amber-tint",
    },
  },
  defaultVariants: { variant: "default" },
});

const textColor: Record<
  NonNullable<NonNullable<VariantProps<typeof badgeVariants>>["variant"]>,
  string
> = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  outline: "text-foreground",
  destructive: "text-destructive-foreground",
  river: "text-river",
  green: "text-green",
  amber: "text-amber",
};

type BadgeProps = ViewProps &
  VariantProps<typeof badgeVariants> & { ref?: React.Ref<View> };

function Badge({
  className,
  variant = "default",
  children,
  ref,
  ...props
}: BadgeProps) {
  return (
    <View
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {typeof children === "string" ? (
        <Text
          className={cn("text-xs font-medium", textColor[variant ?? "default"])}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

export { Badge, badgeVariants };
