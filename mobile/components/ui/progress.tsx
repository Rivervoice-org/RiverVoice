import * as React from "react";
import * as ProgressPrimitive from "@rn-primitives/progress";
import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ref,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  ref?: React.Ref<React.ElementRef<typeof ProgressPrimitive.Root>>;
}) {
  return (
    <ProgressPrimitive.Root
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-border", className)}
      ref={ref}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full rounded-full bg-foreground"
        style={{ width: `${value ?? 0}%` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
