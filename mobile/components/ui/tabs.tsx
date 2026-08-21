import * as React from "react";
import * as TabsPrimitive from "@rn-primitives/tabs";
import { cn } from "@/lib/utils";
import { Text } from "./text";

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & {
  ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>>;
}) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn("flex-row rounded-lg bg-secondary p-1", className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  value,
  ref,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>>;
}) {
  const { value: active } = TabsPrimitive.useRootContext();
  const isActive = active === value;
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5",
        isActive ? "bg-card shadow-float" : "bg-transparent",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text
          className={cn(
            "text-sm font-medium",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  value,
  ref,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content> & {
  ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Content>>;
}) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      value={value}
      className={cn("mt-2", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
