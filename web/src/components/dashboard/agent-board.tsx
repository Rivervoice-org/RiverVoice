import { ChevronDown, MoreHorizontal, Search } from "lucide-react";

import { agents, type Agent } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

      <span className="hidden w-44 shrink-0 truncate text-xs text-muted-foreground sm:block">
        {agent.owner}
      </span>

      <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{agent.edited}</span>

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

      <div className="surface overflow-hidden">
        {/* Column heads, matched to the widths in Line */}
        <div className="flex items-center gap-4 border-b border-border py-2 pr-3 pl-5 text-[11px] text-muted-foreground">
          <span className="w-[30px] shrink-0" />
          <span className="min-w-0 flex-1">Agent</span>
          <span className="hidden w-44 shrink-0 sm:block">Edited by</span>
          <button
            type="button"
            className="flex w-28 shrink-0 cursor-pointer items-center justify-end gap-1 hover:text-foreground"
          >
            Last modified
            <ChevronDown className="size-3" />
          </button>
          <span className="w-6 shrink-0" />
        </div>

        <ul className="flex flex-col divide-y divide-border">
          {agents.map((agent) => (
            <Line key={agent.name} agent={agent} />
          ))}
        </ul>
      </div>
    </section>
  );
}
