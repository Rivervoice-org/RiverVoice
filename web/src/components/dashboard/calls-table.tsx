import { ArrowUpRight, Play, Plus } from "lucide-react";

import { calls, type Call, type CallOutcome } from "@/components/dashboard/data";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const outcomeStyles: Record<CallOutcome, string> = {
  resolved: "bg-river-tint text-river",
  transferred: "bg-muted text-muted-foreground",
  voicemail: "bg-amber-tint text-amber",
  dropped: "bg-destructive/10 text-destructive",
};

const outcomeLabels: Record<CallOutcome, string> = {
  resolved: "Resolved",
  transferred: "Transferred",
  voicemail: "Voicemail",
  dropped: "Dropped",
};

function Sentiment({ value }: { value: number }) {
  const filled = Math.round(value * 5);
  return (
    <span className="flex items-center gap-[3px]" title={`Sentiment ${Math.round(value * 100)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-3 w-[3px] rounded-full",
            i < filled ? (value < 0.4 ? "bg-amber" : "bg-river") : "bg-border",
          )}
        />
      ))}
    </span>
  );
}

function CallRow({ call }: { call: Call }) {
  return (
    <li className="group row-hover flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Play recording from ${call.caller}`}
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Play />
      </Button>

      <span className="w-40 shrink-0 truncate font-mono text-[13px]">{call.caller}</span>

      <span className="hidden w-36 shrink-0 truncate text-muted-foreground lg:block">
        {call.region}
      </span>

      <span className="hidden w-28 shrink-0 truncate md:block">{call.agent}</span>

      <span className="hidden w-20 shrink-0 truncate text-muted-foreground xl:block">
        {call.language}
      </span>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
          outcomeStyles[call.outcome],
        )}
      >
        {outcomeLabels[call.outcome]}
      </span>

      <span className="ml-auto hidden shrink-0 sm:block">
        <Sentiment value={call.sentiment} />
      </span>

      <span className="w-12 shrink-0 text-right font-mono text-[13px] text-muted-foreground tabular-nums">
        {call.duration}
      </span>

      <span className="w-12 shrink-0 text-right font-mono text-[13px] text-muted-foreground tabular-nums">
        {call.time}
      </span>
    </li>
  );
}

function CallList({ items, empty }: { items: Call[]; empty: string }) {
  if (items.length === 0) {
    return <p className="px-3 py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <ul className="flex min-w-[30rem] flex-col">
        {items.map((call) => (
          <CallRow key={call.id} call={call} />
        ))}
      </ul>
    </div>
  );
}

export function CallsTable() {
  const needsReview = calls.filter(
    (call) => call.outcome === "dropped" || call.outcome === "transferred",
  );
  const flagged = calls.filter((call) => call.sentiment < 0.4);

  return (
    <section className="surface animate-rise flex flex-col p-2" style={{ animationDelay: "150ms" }}>
      <Tabs defaultValue="all" className="flex w-full min-w-0 flex-col gap-0">
        <div className="flex items-center gap-3 px-1 pt-1 pb-2">
          <h2 className="px-2 text-sm font-medium">Recent calls</h2>
          <TabsList variant="line" className="h-8">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="review">Needs review</TabsTrigger>
            <TabsTrigger value="flagged">Flagged</TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
            Open call log
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>

        <div className="min-w-0 border-t border-border pt-1">
          <TabsContent value="all">
            <CallList items={calls} empty="No calls yet today." />
          </TabsContent>
          <TabsContent value="review">
            <CallList
              items={needsReview}
              empty="Nothing to review. Every call finished on its own."
            />
          </TabsContent>
          <TabsContent value="flagged">
            <CallList items={flagged} empty="No calls ended on a sour note today." />
          </TabsContent>
        </div>
      </Tabs>

      <button
        type="button"
        className="row-hover mt-1 flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Plus className="size-3.5" />
        Place a call
      </button>
    </section>
  );
}
