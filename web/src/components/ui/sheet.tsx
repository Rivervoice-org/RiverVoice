"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

/** An edge panel for the widths where a fixed rail does not fit. */
function SheetContent({
  className,
  side = "left",
  children,
  ...props
}: DialogPrimitive.Popup.Props & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/30 duration-200 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "panel fixed inset-y-2 z-50 flex w-72 max-w-[calc(100%-1rem)] flex-col overflow-hidden duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none data-open:animate-in data-closed:animate-out",
          side === "left"
            ? "left-2 data-open:slide-in-from-left-[100%] data-closed:slide-out-to-left-[100%]"
            : "right-2 data-open:slide-in-from-right-[100%] data-closed:slide-out-to-right-[100%]",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger };
