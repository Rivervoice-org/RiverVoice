"use client";

import * as React from "react";

import { BuilderAssistant } from "@/components/builder/builder-assistant";
import { BuilderNav } from "@/components/builder/builder-nav";
import { BuilderTopbar } from "@/components/builder/builder-topbar";
import type { Agent } from "@/components/dashboard/data";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/** Holds the builder's shared state: the panel, and the agent's chosen face. */
export function BuilderWorkspace({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  const [railOpen, setRailOpen] = React.useState(true);
  // Below xl there is no room for the rail, so the same panel opens as a sheet.
  const [sheetOpen, setSheetOpen] = React.useState(false);
  // null means the name is still choosing the mascot.
  const [mascot, setMascot] = React.useState<string | null>(agent.mascot ?? null);

  return (
    <div className="flex h-svh overflow-hidden bg-canvas p-2">
      <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BuilderTopbar
          agent={agent}
          mascot={mascot}
          onMascotChange={setMascot}
          railOpen={railOpen}
          onToggleRail={() => setRailOpen((open) => !open)}
          onOpenAssistant={() => setSheetOpen(true)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
          <BuilderNav agentId={agent.id} />
          {children}
        </div>
      </div>

      {/* Stays mounted and animates its width, so the panel slides rather than
          blinking out. The left pane reflows against it. */}
      <div
        aria-hidden={!railOpen}
        className={cn(
          "hidden min-h-0 shrink-0 overflow-hidden xl:block",
          "transition-[width,padding,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          railOpen ? "w-[25rem] pl-2 opacity-100" : "pointer-events-none w-0 pl-0 opacity-0",
        )}
      >
        <BuilderAssistant agent={agent} mascot={mascot} onClose={() => setRailOpen(false)} />
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-[25rem] xl:hidden">
          <SheetTitle className="sr-only">Ask Rivervoice</SheetTitle>
          <BuilderAssistant agent={agent} mascot={mascot} onClose={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
