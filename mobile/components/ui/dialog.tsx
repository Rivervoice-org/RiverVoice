import * as React from "react";
import { View } from "react-native";
import { X } from "lucide-react-native";
import * as DialogPrimitive from "@rn-primitives/dialog";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { Text } from "./text";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

function DialogOverlay({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Overlay>>;
}) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn("absolute inset-0 bg-black/50", className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Content>>;
}) {
  const colors = useThemeColors();
  return (
    <DialogPortal>
      <View className="absolute inset-0 justify-center px-6" pointerEvents="box-none">
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "w-full rounded-xl border border-border bg-card p-5 shadow-lift",
            className
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-4 top-4 h-6 w-6 items-center justify-center rounded-md active:bg-secondary"
            hitSlop={8}
          >
            <X size={16} strokeWidth={1.75} color={colors.muted} />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </View>
    </DialogPortal>
  );
}

function DialogTitle({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title> & {
  ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Title>>;
}) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description> & {
  ref?: React.Ref<React.ElementRef<typeof DialogPrimitive.Description>>;
}) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
