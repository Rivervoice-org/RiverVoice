"use client";

import * as React from "react";

import { BuilderAssistant } from "@/components/builder/builder-assistant";
import { BuilderNav } from "@/components/builder/builder-nav";
import { BuilderTopbar } from "@/components/builder/builder-topbar";
import type { Agent } from "@/components/dashboard/data";
import { cn } from "@/lib/utils";

/** Holds the builder's shared state: the panel, and the agent's chosen face. */
export function BuilderWorkspace({ agent, children }: { agent: Agent; children: React.ReactNode }) {
  const [assistantOpen, setAssistantOpen] = React.useState(true);
  // null means the name is still choosing the mascot.
  const [mascot, setMascot] = React.useState<string | null>(agent.mascot ?? null);

  return (
    <div className="flex h-svh overflow-hidden bg-canvas p-2">
      <div className="panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <BuilderTopbar
          agent={agent}
          mascot={mascot}
          onMascotChange={setMascot}
          assistantOpen={assistantOpen}
          onToggleAssistant={() => setAssistantOpen((open) => !open)}
        />

        <div className="flex min-h-0 flex-1">
          <BuilderNav agentId={agent.id} />
          {children}
        </div>
      </div>

      {/* Stays mounted and animates its width, so the panel slides rather than
          blinking out. The left pane reflows against it. */}
      <div
        aria-hidden={!assistantOpen}
        className={cn(
          "hidden min-h-0 shrink-0 overflow-hidden xl:block",
          "transition-[width,padding,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          assistantOpen ? "w-[25rem] pl-2 opacity-100" : "pointer-events-none w-0 pl-0 opacity-0",
        )}
      >
        <BuilderAssistant agent={agent} mascot={mascot} onClose={() => setAssistantOpen(false)} />
      </div>
    </div>
  );
}
