import { Waves } from "lucide-react";

/**
 * Load screen. Pure CSS — it plays on every paint (including a refresh) and
 * animates itself to visibility:hidden, so no JS, no state, no hydration flash.
 * The reduced-motion rule in globals.css collapses it to its end state instantly.
 */
export function Splash() {
  return (
    <div
      aria-hidden
      className="animate-splash-out fixed inset-0 z-50 flex items-center justify-center bg-canvas"
    >
      <div className="animate-splash-lift relative flex items-center gap-3">
        <span className="animate-splash-mark flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
          <Waves className="size-5" strokeWidth={2} />
        </span>

        <span className="animate-splash-word text-[28px] leading-none font-semibold tracking-[-0.03em]">
          Rivervoice
        </span>
      </div>
    </div>
  );
}
