import * as React from "react";
import { Text as RNText } from "react-native";
import * as DropdownMenuPrimitive from "@rn-primitives/dropdown-menu";
import { Check, ChevronRight, Circle } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/theme";

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ref,
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger>,
  "children"
> & {
  inset?: boolean;
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>>;
}) {
  const { open } = DropdownMenuPrimitive.useSubContext();
  const colors = useThemeColors();
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex-row items-center gap-2 rounded-md px-2 py-1.5",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <RNText className="text-sm text-foreground">{children}</RNText>
      ) : (
        children
      )}
      <ChevronRight
        size={16}
        strokeWidth={1.75}
        color={colors.muted}
        style={{
          transform: [{ rotate: open ? "90deg" : "0deg" }],
          marginLeft: "auto",
        }}
      />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubContent>>;
}) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "min-w-40 rounded-lg border border-border bg-popover p-1 shadow-lift",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ref,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Content>>;
}) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Overlay className="bg-transparent" />
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          "min-w-40 rounded-lg border border-border bg-popover p-1 shadow-lift",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

function DropdownMenuLabel({
  className,
  inset,
  ref,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Label>>;
}) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={cn(
        "px-2 py-1.5 text-xs font-medium text-muted-foreground",
        inset && "pl-8",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuItem({
  className,
  inset,
  ref,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DropdownMenuPrimitive.Item>, "children"> & {
  inset?: boolean;
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Item>>;
}) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        "flex-row items-center gap-2 rounded-md px-2 py-1.5 active:bg-secondary",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <RNText className="text-sm text-foreground">{children}</RNText>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.Item>
  );
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ref,
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>,
  "children"
> & {
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>>;
}) {
  const colors = useThemeColors();
  return (
    <DropdownMenuPrimitive.CheckboxItem
      ref={ref}
      checked={checked}
      className={cn(
        "flex-row items-center gap-2 rounded-md px-2 py-1.5 active:bg-secondary",
        className,
      )}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Check size={14} strokeWidth={2} color={colors.ink} />
      </DropdownMenuPrimitive.ItemIndicator>
      {typeof children === "string" ? (
        <RNText className="text-sm text-foreground">{children}</RNText>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  ref,
  ...props
}: Omit<
  React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>,
  "children"
> & {
  children?: React.ReactNode;
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>>;
}) {
  const colors = useThemeColors();
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      value={value}
      className={cn(
        "flex-row items-center gap-2 rounded-md px-2 py-1.5 active:bg-secondary",
        className,
      )}
      {...props}
    >
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle
          size={10}
          strokeWidth={2}
          color={colors.ink}
          fill={colors.ink}
        />
      </DropdownMenuPrimitive.ItemIndicator>
      {typeof children === "string" ? (
        <RNText className="text-sm text-foreground">{children}</RNText>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.RadioItem>
  );
}

function DropdownMenuSeparator({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & {
  ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Separator>>;
}) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
