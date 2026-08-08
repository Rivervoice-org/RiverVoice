"use client";

import { History, PanelRight, Sparkles } from "lucide-react";

import type { Agent } from "@/lib/agents/types";
import { Mascot } from "@/mascots";
import { AskComposer } from "@/components/ask/ask-composer";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Rename this agent and tighten the greeting",
  "Switch the voice to Hindi and slow the pace",
  "Add a knowledge base for product FAQs",
];

/** The side panel that edits the agent by conversation instead of by field. */
export function BuilderAssistant({
  agent,
  mascot,
  onClose,
}: {
  agent: Agent;
  mascot: string | null;
  onClose: () => void;
}) {
  return (
    <aside className="panel flex h-full w-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-2 px-4">
        <Sparkles className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <span className="text-sm font-medium">Ask Rivervoice</span>

        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="History"
            className="cursor-pointer text-muted-foreground"
          >
            <History />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Hide panel"
            title="Hide panel"
            className="cursor-pointer text-muted-foreground"
            onClick={onClose}
          >
            <PanelRight />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
        <Mascot seed={mascot ?? agent.name} size={44} className="opacity-90" />

        <h2 className="mt-5 font-serif text-2xl leading-tight font-light tracking-tight">
          What should we change?
        </h2>

        <ul className="mt-4 flex flex-col">
          {SUGGESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                className="w-full cursor-pointer border-b border-border py-3 text-left text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 p-3">
        <AskComposer placeholder="Describe the change you want" />
      </div>
    </aside>
  );
}
