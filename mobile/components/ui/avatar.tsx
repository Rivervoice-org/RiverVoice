import * as React from "react";
import * as AvatarPrimitive from "@rn-primitives/avatar";
import { cn } from "@/lib/utils";

function Avatar({
  className,
  alt,
  ref,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Root>>;
}) {
  return (
    <AvatarPrimitive.Root
      alt={alt}
      ref={ref}
      className={cn("h-9 w-9 overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image> & {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Image>>;
}) {
  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn("h-full w-full", className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ref,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback> & {
  ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Fallback>>;
}) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "h-full w-full items-center justify-center rounded-full bg-secondary",
        className
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarFallback, AvatarImage };
