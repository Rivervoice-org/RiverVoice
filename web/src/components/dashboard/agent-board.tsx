import { MoreHorizontal, Search } from "lucide-react";

import { agents, type Agent } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Waveform } from "@/components/dashboard/waveform";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusLabels: Record<Agent["status"], string> = {
  live: "On the line",
  paused: "Paused",
  draft: "Draft",
};

function Line({ agent }: { agent: Agent }) {
  const live = agent.status === "live";

  return (
    <li className="group relative flex cursor-pointer items-center gap-4 py-3 pr-3 pl-5 transition-colors hover:bg-muted/50">
      {/* The line's own indicator, lit only while it is answering */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
          live ? "bg-river" : "bg-transparent group-hover:bg-border",
        )}
      />

      <Mascot seed={agent.name} size={30} />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-medium">{agent.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{agent.purpose}</span>
      </span>

      {/* Level: moving while the agent is answering, flat when it is not */}
      <span className="hidden w-28 shrink-0 lg:block">
        {live ? (
          <Waveform className="h-5" bars={18} />
        ) : (
          <span aria-hidden className="block h-px w-full bg-border" />
        )}
      </span>

      <span
        className={cn(
          "hidden w-40 shrink-0 truncate font-mono text-xs sm:block",
          agent.number === "Not assigned" && "text-muted-foreground",
        )}
      >
        {agent.number}
      </span>

      <span className="flex w-28 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", live ? "bg-river" : "bg-border")}
        />
        {statusLabels[agent.status]}
      </span>

      <span className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground xl:block">
        {agent.calls > 0 ? (
          <>
            <span className="font-mono text-foreground tabular-nums">
              {agent.calls.toLocaleString()}
            </span>{" "}
            calls
          </>
        ) : (
          "—"
        )}
      </span>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${agent.name}`}
        className="shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal />
      </Button>
    </li>
  );
}

/** The agents you already have, read as lines on a switchboard. */
export function AgentBoard() {
  const live = agents.filter((agent) => agent.status === "live").length;

  return (
    <section className="animate-rise flex flex-col gap-3" style={{ animationDelay: "80ms" }}>
      <div className="flex flex-wrap items-center gap-3 px-1">
        <h2 className="text-sm font-medium">On the board</h2>
        <span className="text-xs text-muted-foreground">
          {live} of {agents.length} answering
        </span>

        <div className="relative ml-auto w-full max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Find an agent"
            aria-label="Find an agent"
            className="h-8 w-full rounded-full border border-border bg-transparent pr-3 pl-8.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <ul className="surface flex flex-col divide-y divide-border overflow-hidden">
        {agents.map((agent) => (
          <Line key={agent.name} agent={agent} />
        ))}
      </ul>
    </section>
  );
}
