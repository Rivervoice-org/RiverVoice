"use client";

import * as React from "react";

import { BuilderAssistant } from "@/components/builder/builder-assistant";
import { BuilderNav } from "@/components/builder/builder-nav";
import { BuilderTester } from "@/components/builder/builder-tester";
import { BuilderTopbar } from "@/components/builder/builder-topbar";
import type { RailView } from "@/components/builder/rail";
import type { Agent } from "@/lib/agents/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const WIDE = "(min-width: 80rem)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(WIDE);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Which of the two the panel opens in. The rail and the sheet are separate
 * elements chosen by a breakpoint, so a button that opens "the panel" has to
 * know which one is on screen — a class cannot decide that for it.
 */
function useWide() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );
}

/** Holds the builder's shared state: the panel, and the agent's chosen face. */
export function BuilderWorkspace({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  const wide = useWide();

  const [rail, setRail] = React.useState<RailView | null>("assistant");
  // Below xl there is no room for the rail, so the same panels open as a sheet.
  const [sheet, setSheet] = React.useState<RailView | null>(null);
  // What the rail draws while it is closing. Keeping the last view means the
  // width can animate out on something rather than collapsing on an empty box.
  const [held, setHeld] = React.useState<RailView>("assistant");
  // Bumped on every open and every switch, and never on close. Keying the panel
  // on it remounts the contents just when they should play their entrance, and
  // leaves them alone while the rail slides shut.
  const [entrance, setEntrance] = React.useState(0);
  // null means the name is still choosing the mascot.
  const [mascot, setMascot] = React.useState<string | null>(agent.mascot ?? null);

  const showRail = React.useCallback((view: RailView) => {
    setRail(view);
    setHeld(view);
    setEntrance((n) => n + 1);
  }, []);

  const open = React.useCallback(
    (view: RailView) => {
      if (wide) return showRail(view);
      setSheet(view);
      setHeld(view);
      setEntrance((n) => n + 1);
    },
    [wide, showRail],
  );

  const panel = (view: RailView, close: () => void) => (
    <div key={`${view}-${entrance}`} className="animate-rise h-full">
      {view === "test" ? (
        <BuilderTester agent={agent} mascot={mascot} onClose={close} />
      ) : (
        <BuilderAssistant agent={agent} mascot={mascot} onClose={close} />
      )}
    </div>
  );

  return (
    <div className="flex h-svh overflow-hidden bg-canvas p-2">
      <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BuilderTopbar
          agent={agent}
          mascot={mascot}
          onMascotChange={setMascot}
          // Whichever container is actually on screen at this width holds the
          // panel that is visible, and that is the button to stand down.
          active={wide ? rail : sheet}
          onOpenAssistant={() => open("assistant")}
          onTest={() => open("test")}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
          <BuilderNav agentId={agent.id} />
          {children}
        </div>
      </div>

      {/* Stays mounted and animates its width, so the panel slides rather than
          blinking out. The left pane reflows against it. */}
      <div
        aria-hidden={rail === null}
        className={cn(
          "hidden min-h-0 shrink-0 overflow-hidden xl:block",
          "transition-[width,padding,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          rail ? "w-[25rem] pl-2 opacity-100" : "pointer-events-none w-0 pl-0 opacity-0",
        )}
      >
        {panel(rail ?? held, () => setRail(null))}
      </div>

      <Sheet open={sheet !== null} onOpenChange={(next) => setSheet(next ? sheet : null)}>
        <SheetContent side="right" className="w-[25rem] xl:hidden">
          <SheetTitle className="sr-only">
            {held === "test" ? "Test agent" : "Ask Rivervoice"}
          </SheetTitle>
          {/* Held rather than read from `sheet`, or closing would swap the
              contents mid-slide as the state goes null. */}
          {panel(held, () => setSheet(null))}
        </SheetContent>
      </Sheet>
    </div>
  );
}
