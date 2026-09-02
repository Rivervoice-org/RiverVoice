import * as React from "react";
import { X } from "lucide-react-native";
import * as ToastPrimitive from "@rn-primitives/toast";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

function Toast({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & {
  ref?: React.Ref<React.ElementRef<typeof ToastPrimitive.Root>>;
}) {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(
        "flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Close> & {
  ref?: React.Ref<React.ElementRef<typeof ToastPrimitive.Close>>;
}) {
  const colors = useThemeColors();
  return (
    <ToastPrimitive.Close
      ref={ref}
      className={cn(
        "h-6 w-6 items-center justify-center rounded-md active:bg-secondary",
        className,
      )}
      hitSlop={8}
      {...props}
    >
      <X size={14} strokeWidth={1.75} color={colors.muted} />
    </ToastPrimitive.Close>
  );
}

function ToastTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title> & {
  ref?: React.Ref<React.ElementRef<typeof ToastPrimitive.Title>>;
}) {
  return (
    <ToastPrimitive.Title
      ref={ref}
      className={cn("text-sm font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description> & {
  ref?: React.Ref<React.ElementRef<typeof ToastPrimitive.Description>>;
}) {
  return (
    <ToastPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Toast, ToastClose, ToastDescription, ToastTitle };
