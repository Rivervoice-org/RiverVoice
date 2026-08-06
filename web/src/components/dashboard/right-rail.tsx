import { MoreHorizontal, Plus } from "lucide-react";

import { agents, usage } from "@/components/dashboard/data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function Meter({
  label,
  used,
  included,
  unit,
}: {
  label: string;
  used: number;
  included: number;
  unit: string;
}) {
  const pct = Math.min(100, Math.round((used / included) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground tabular-nums">
        {used.toLocaleString()} / {included.toLocaleString()} {unit}
      </p>
    </div>
  );
}

/** Agents and usage share one white panel — no canvas showing between them. */
export function RightRail() {
  const busiest = Math.max(...agents.map((agent) => agent.calls), 1);

  return (
    <aside
      className="surface animate-rise flex h-full min-w-0 flex-col"
      style={{ animationDelay: "195ms" }}
    >
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <h2 className="text-sm font-medium">Agents</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="New agent"
          className="ml-auto text-muted-foreground"
        >
          <Plus />
        </Button>
      </div>

      <ul className="flex flex-col px-2 pb-2">
        {agents.map((agent) => (
          <li key={agent.name} className="group row-hover rounded-lg px-2 py-2.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  agent.status === "live" ? "bg-river" : "bg-border",
                )}
              />
              <span className="truncate text-sm font-medium">{agent.name}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums group-hover:hidden">
                {agent.calls.toLocaleString()}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Options for ${agent.name}`}
                className="-mr-1 ml-auto hidden text-muted-foreground group-hover:flex"
              >
                <MoreHorizontal />
              </Button>
            </div>
            <p className="mt-1 truncate pl-3.5 font-mono text-[11px] text-muted-foreground">
              {agent.number}
            </p>
            <div className="mt-2 ml-3.5 h-0.5 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full",
                  agent.calls ? "bg-foreground/40" : "bg-transparent",
                )}
                style={{ width: `${(agent.calls / busiest) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Usage sits at the foot of the same panel */}
      <div className="mt-auto flex flex-col gap-4 border-t border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">Usage</h2>
          <span className="text-[11px] text-muted-foreground">Resets {usage.renewsOn}</span>
        </div>

        <Meter
          label="Call minutes"
          used={usage.minutes.used}
          included={usage.minutes.included}
          unit="min"
        />
        <Meter
          label="Transcription"
          used={usage.transcription.used}
          included={usage.transcription.included}
          unit="min"
        />

        <Button variant="outline" size="sm" className="w-full">
          Add minutes
        </Button>
      </div>
    </aside>
  );
}
