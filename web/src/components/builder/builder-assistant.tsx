"use client";

import { ArrowUp, History, PanelRight, Sparkles } from "lucide-react";

import type { Agent } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Rename this agent and tighten the greeting",
  "Switch the voice to Hindi and slow the pace",
  "Add a knowledge base for product FAQs",
];

/** The side panel that edits the agent by conversation instead of by field. */
export function BuilderAssistant({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  return (
    <aside className="panel flex h-full w-96 flex-col overflow-hidden">
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
        <Mascot seed={agent.name} size={44} className="opacity-90" />

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
        <div className="rounded-2xl border border-foreground/15 bg-muted/50 transition-all focus-within:border-foreground/30 focus-within:bg-card">
          <Textarea
            rows={3}
            aria-label="Ask Rivervoice"
            placeholder="Describe the change you want"
            className="min-h-20 resize-none border-0 bg-transparent px-3.5 pt-3 pb-1 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm dark:bg-transparent"
          />
          <div className="flex items-center px-2.5 pb-2.5">
            <Button
              size="icon"
              aria-label="Send"
              className="ml-auto size-8 cursor-pointer rounded-full"
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
