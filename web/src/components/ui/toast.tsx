"use client";

import { Toast } from "@base-ui/react/toast";
import { X } from "lucide-react";

import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((item) => (
    <Toast.Root
      key={item.id}
      toast={item}
      swipeDirection={["right", "down"]}
      className={cn(
        "absolute right-0 bottom-0 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 pr-9 text-popover-foreground shadow-(--shadow-lift)",
        "transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.22,1,0.36,1)]",
        // Stacked: each one behind sits a little higher and a little smaller.
        "[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+var(--toast-index)*-10px))_scale(calc(1-var(--toast-index)*0.05))]",
        // Hovered, the pile fans out to full size so all of it can be read.
        "data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+var(--toast-offset-y)*-1))]",
        // In and out through the bottom edge, the corner it lives in.
        "data-starting-style:opacity-0 data-starting-style:[transform:translateY(150%)]",
        "data-ending-style:opacity-0 data-ending-style:[transform:translateY(150%)]",
      )}
      style={{ zIndex: toasts.length - toasts.indexOf(item) }}
    >
      <Toast.Title className="text-[13px] leading-5 font-medium" />
      <Toast.Description className="mt-0.5 text-[13px] leading-5 text-muted-foreground" />
      <Toast.Close
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <X className="size-3.5" strokeWidth={1.75} />
      </Toast.Close>
    </Toast.Root>
  ));
}

/** Mounted once, at the root. Everything else posts through `toast`. */
export function Toaster() {
  return (
    <Toast.Provider toastManager={toast}>
      <Toast.Portal>
        <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] outline-none">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
