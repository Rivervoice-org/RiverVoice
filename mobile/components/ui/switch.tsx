import * as React from "react";
import * as SwitchPrimitive from "@rn-primitives/switch";
import { cn } from "@/lib/utils";

function Switch({
  className,
  checked,
  ref,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  ref?: React.Ref<React.ElementRef<typeof SwitchPrimitive.Root>>;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      className={cn(
        "h-6 w-10 flex-row items-center rounded-full px-0.5",
        checked ? "bg-foreground" : "bg-border",
        className
      )}
      ref={ref}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className="h-5 w-5 rounded-full bg-card shadow-float"
        style={{ transform: [{ translateX: checked ? 16 : 0 }] }}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
