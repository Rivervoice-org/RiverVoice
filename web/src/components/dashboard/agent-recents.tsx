import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";

import { agents } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusLabels = {
  live: "Answering",
  paused: "Paused",
  draft: "Draft",
} as const;

/** The agents that already exist, newest edit first. */
export function AgentRecents() {
  return (
    <section className="animate-rise flex flex-col gap-3" style={{ animationDelay: "80ms" }}>
      <h2 className="px-1 text-sm font-medium">Recents</h2>

      <div className="relative w-full max-w-64 px-1">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search"
          aria-label="Search agents"
          className="h-9 w-full rounded-full border border-border bg-transparent pr-3 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>

      <div className="min-w-0">
        {/* Column head */}
        <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="min-w-0 flex-1">Agent</span>
          <span className="hidden w-28 shrink-0 sm:block">Status</span>
          <button
            type="button"
            className="flex w-32 shrink-0 cursor-pointer items-center gap-1 text-left hover:text-foreground"
          >
            Last edited
            <ChevronDown className="size-3.5" />
          </button>
          <span className="w-6 shrink-0" />
        </div>

        <ul className="flex flex-col">
          {agents.map((agent) => (
            <li
              key={agent.name}
              className="group row-hover flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
            >
              <Mascot seed={agent.mascot ?? agent.name} size={28} />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm leading-5 font-medium">{agent.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{agent.owner}</span>
              </span>

              <span className="hidden w-28 shrink-0 sm:block">
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      agent.status === "live" ? "bg-river" : "bg-border",
                    )}
                  />
                  {statusLabels[agent.status]}
                </span>
              </span>

              <span className="w-32 shrink-0 text-xs text-muted-foreground">{agent.edited}</span>

              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Options for ${agent.name}`}
                className="w-6 shrink-0 cursor-pointer text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {/* Paging */}
      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
        <span>Show</span>
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="font-mono tabular-nums">{agents.length}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
        <span>per page</span>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Previous page"
            disabled
            className="cursor-pointer"
          >
            <ChevronLeft />
          </Button>
          <span className="font-mono tabular-nums">
            1–{agents.length} of {agents.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Next page"
            disabled
            className="cursor-pointer"
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </section>
  );
}
