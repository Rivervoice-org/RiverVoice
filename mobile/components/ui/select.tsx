import * as React from "react";
import { Platform, StyleSheet } from "react-native";
import * as SelectPrimitive from "@rn-primitives/select";
import { Check, ChevronDown } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";
import { Text } from "./text";

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

function SelectTrigger({
  className,
  children,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Trigger>, "children"> & {
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof SelectPrimitive.Trigger>>;
}) {
  const colors = useThemeColors();
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "h-10 flex-row items-center justify-between gap-2 rounded-lg border border-border bg-card px-3",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown size={16} strokeWidth={1.75} color={colors.muted} />
    </SelectPrimitive.Trigger>
  );
}

function SelectContent({
  className,
  children,
  position = "popper",
  ref,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof SelectPrimitive.Content>>;
}) {
  const { open } = SelectPrimitive.useRootContext();
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Overlay
        style={Platform.OS !== "web" ? StyleSheet.absoluteFill : undefined}
        className="bg-black/50"
      />
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        className={cn(
          "rounded-lg border border-border bg-popover p-1 shadow-lift",
          open && "web:animate-in web:fade-in-0 web:zoom-in-95",
          className,
        )}
        {...props}
      >
        {children}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

function SelectLabel({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label> & {
  ref?: React.Ref<React.ElementRef<typeof SelectPrimitive.Label>>;
}) {
  return (
    <SelectPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SelectItem({
  className,
  children,
  label,
  value,
  ref,
  ...props
}: Omit<React.ComponentProps<typeof SelectPrimitive.Item>, "children"> & {
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof SelectPrimitive.Item>>;
}) {
  const colors = useThemeColors();
  return (
    <SelectPrimitive.Item
      ref={ref}
      label={label}
      value={value}
      className={cn(
        "flex-row items-center gap-2 rounded-md px-2 py-1.5 active:bg-secondary",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className="flex-1 text-sm text-foreground">{children}</Text>
      ) : (
        children
      )}
      <SelectPrimitive.ItemIndicator className="ml-auto">
        <Check size={14} strokeWidth={2} color={colors.ink} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator> & {
  ref?: React.Ref<React.ElementRef<typeof SelectPrimitive.Separator>>;
}) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
