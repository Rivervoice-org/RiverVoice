import * as React from "react";
import * as SeparatorPrimitive from "@rn-primitives/separator";
import { cn } from "@/lib/utils";

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ref,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> & {
  ref?: React.Ref<React.ElementRef<typeof SeparatorPrimitive.Root>>;
}) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Separator };
