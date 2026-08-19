import * as React from "react";
import { View, type ViewProps } from "react-native";
import { Text } from "./text";
import { cn } from "@/lib/utils";

function Card({
  className,
  ref,
  ...props
}: ViewProps & { ref?: React.Ref<View> }) {
  return (
    <View
      ref={ref}
      className={cn("rounded-xl border border-border bg-card shadow-float", className)}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ref,
  ...props
}: ViewProps & { ref?: React.Ref<View> }) {
  return <View ref={ref} className={cn("px-4 pt-4 pb-2", className)} {...props} />;
}

function CardTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & { ref?: React.Ref<React.ElementRef<typeof Text>> }) {
  return <Text ref={ref} className={cn("text-sm font-semibold", className)} {...props} />;
}

function CardDescription({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof Text> & { ref?: React.Ref<React.ElementRef<typeof Text>> }) {
  return (
    <Text
      ref={ref}
      variant="muted"
      className={cn("text-xs", className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ref,
  ...props
}: ViewProps & { ref?: React.Ref<View> }) {
  return <View ref={ref} className={cn("px-4 pb-4", className)} {...props} />;
}

function CardFooter({
  className,
  ref,
  ...props
}: ViewProps & { ref?: React.Ref<View> }) {
  return <View ref={ref} className={cn("px-4 pb-4", className)} {...props} />;
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
