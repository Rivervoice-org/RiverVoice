import Link from "next/link";

import { agents } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { cn } from "@/lib/utils";

/** Notion's "recently visited", for the things you actually edit here. */
export function HomeAgents() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Jump back in</h2>
        <Link
          href="/agents"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          All agents
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {agents.slice(0, 3).map((agent) => (
          <Link
            key={agent.id}
            href={`/build-agent/${agent.id}`}
            className="group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <Mascot seed={agent.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{agent.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                Edited {agent.edited}
              </span>
            </span>
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                agent.status === "live" ? "bg-foreground" : "bg-border",
              )}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
