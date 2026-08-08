import { Board } from "@/motion/auth/board";

/**
 * No transcript, no chat — one statement, with the greeting above it changing
 * each time a call lands on the board beneath it. Both are the same event, on
 * one clock, and the whole thing comes to rest.
 */
export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden rounded-2xl bg-muted/50 lg:flex lg:flex-col lg:justify-center lg:p-12">
      {/* A light thrown from the top corner, so the panel is not a flat slab */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 50% at 72% 0%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        }}
      />

      <div className="relative">
        <Board />

        <p className="mt-10 max-w-md text-[26px] leading-snug font-semibold tracking-[-0.02em]">
          Your agent answers in whichever language the phone rings in.
        </p>

        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          23 languages, switched mid-call, on a line that picks up in one ring.
        </p>
      </div>
    </aside>
  );
}
