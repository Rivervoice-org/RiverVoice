import { Phone } from "lucide-react";

import { Mascot } from "@/mascots";
import { DemoStage } from "@/components/marketing/demo-stage";
import { cn } from "@/lib/utils";

/**
 * An exact replica of two corners of the mobile app: the call list's
 * swipe-to-call row (mobile/screens/Call — ContactRow, InitialsAvatar,
 * SwipeToCallRow — same swipe-right-reveals-green-circle gesture as the
 * phone app's own recents list) and the sheet that gesture opens
 * (mobile/components/AgentPickerSheet — same title, same agent rows, same
 * mascots, same "HI → EN" subtitle format, same real agent names from
 * screens/Agents/mock.ts). Nothing invented.
 *
 * The cursor drags the row open exactly like a swipe, that's what triggers
 * the real agent-picker sheet, the cursor picks an agent from it, the sheet
 * closes and the row springs shut — one 18s loop, gated by DemoStage so it
 * never starts mid-story.
 */

function initials(name: string) {
  const [first, last] = name.trim().split(/\s+/);
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

function StaticContactRow({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-river-tint text-[12px] font-semibold text-river">
        {initials(name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{phone}</p>
      </div>
    </div>
  );
}

/** The row the cursor actually swipes — SwipeToCallRow's own two layers: a
 * green reveal underneath, and the real row sliding over it. */
function SwipeContactRow({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 flex items-center bg-green-tint pl-4">
        <span className="agentpick-swipe-icon flex h-8 w-8 items-center justify-center rounded-full bg-green">
          <Phone size={14} strokeWidth={2} className="text-background" aria-hidden />
        </span>
      </div>
      <div className="agentpick-swipe relative flex items-center gap-3 bg-card px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-tint text-[12px] font-semibold text-amber">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{phone}</p>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-river-tint">
          <Phone size={14} strokeWidth={1.75} className="text-river" />
        </span>
      </div>
    </div>
  );
}

function AgentRow({
  name,
  langs,
  divider,
  demoToggle,
}: {
  name: string;
  langs: string;
  divider?: boolean;
  /** The one the cursor actually clicks — presses under the click, then holds it. */
  demoToggle?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        divider && "border-b border-border",
        demoToggle && "agentpick-row-press",
      )}
    >
      <Mascot seed={name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{langs}</p>
      </div>
    </div>
  );
}

/**
 * The screen the pick actually opens — mobile/screens/InCall: the pulsing
 * ring around the caller's avatar, the status line, and the "Handled by
 * [mascot] AgentName" pill. Covers the whole panel once the sheet closes,
 * then fades back to the call list for the loop to repeat.
 */
function InCallOverlay() {
  return (
    <div className="agentpick-incall absolute inset-0 flex flex-col items-center justify-center bg-canvas">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <span aria-hidden className="animate-halo absolute inset-0 rounded-full bg-river/40" />
        <span className="text-[15px] font-semibold text-river">{initials("Rohan Mehta")}</span>
      </div>
      <p className="mt-4 text-[17px] font-semibold text-foreground">Rohan Mehta</p>
      <p className="mt-0.5 font-mono text-[13px] text-muted-foreground">+91 98765 43210</p>
      <p className="mt-2 text-[13px] text-muted-foreground">Calling…</p>
      <div className="mt-5 flex items-center gap-2 rounded-full bg-secondary py-1.5 pr-4 pl-1.5">
        <Mascot seed="Front Desk" size={22} />
        <p className="text-[12px] text-muted-foreground">
          Handled by <span className="font-medium text-foreground">Front Desk</span>
        </p>
      </div>
    </div>
  );
}

/** Same trackpad-hand cursor as the create-agent screen, its own timeline. */
function PickCursor() {
  return (
    <div
      className="agentpick-cursor pointer-events-none absolute z-10 -translate-x-1 -translate-y-1"
      style={{ left: 150, top: 40 }}
    >
      <span
        aria-hidden
        className="agentpick-click-ring absolute top-1/2 left-1/2 block h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "var(--color-foreground)" }}
      />
      <svg width="20" height="20" viewBox="0 0 24 24" className="relative drop-shadow-sm">
        <path
          d="M5 3l14 8-6 2-2 6-6-16z"
          fill="var(--color-background)"
          stroke="var(--color-foreground)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function PointNumberScreen() {
  return (
    <DemoStage className="agentpick-zoom mx-auto w-full max-w-[400px]">
      <div className="relative h-[400px] overflow-hidden rounded-xl border border-border">
        <PickCursor />

        <SwipeContactRow name="Rohan Mehta" phone="+91 98765 43210" />
        <StaticContactRow name="Priya Nair" phone="+91 90123 45678" />

        {/* The sheet the swipe opens — hidden below the fold until it does */}
        <div
          className="agentpick-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-canvas px-5 pt-4 pb-4 shadow-(--shadow-lift)"
          style={{ transform: "translateY(100%)" }}
        >
          <p className="mb-3 text-[15px] font-semibold text-foreground">Call with</p>
          <div className="overflow-hidden rounded-xl border border-border">
            <AgentRow name="Front Desk" langs="HI → EN" divider demoToggle />
            <AgentRow name="Billing" langs="HI → EN" divider />
            <AgentRow name="Order Status" langs="TE → EN" />
          </div>
        </div>

        <InCallOverlay />
      </div>
    </DemoStage>
  );
}
