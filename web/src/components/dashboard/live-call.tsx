import { Headphones, PhoneOff, UserRoundCheck } from "lucide-react";

import { liveCall, waitingCalls } from "@/components/dashboard/data";
import { Waveform } from "@/components/dashboard/waveform";
import { Button } from "@/components/ui/button";

function LiveDot() {
  return (
    <span className="relative flex size-2">
      <span className="animate-halo absolute inset-0 rounded-full bg-river" />
      <span className="relative size-2 rounded-full bg-river" />
    </span>
  );
}

export function LiveCall() {
  return (
    <section className="surface animate-rise overflow-hidden">
      <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center">
        {/* Who is on the line */}
        <div className="min-w-0 md:w-56">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-[11px] font-medium tracking-wide text-river uppercase">
              On the line
            </span>
          </div>
          <p className="mt-2 truncate font-mono text-[15px] tracking-tight">{liveCall.caller}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {liveCall.region} · {liveCall.language}
          </p>
        </div>

        {/* The signature: the voice itself */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Waveform className="h-12 min-w-0 flex-1" />
          <span className="font-serif text-3xl leading-none font-light tabular-nums">
            {liveCall.elapsed}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="outline" size="sm">
            <Headphones data-icon="inline-start" />
            Listen
          </Button>
          <Button variant="outline" size="sm">
            <UserRoundCheck data-icon="inline-start" />
            Take over
          </Button>
          <Button variant="destructive" size="icon-sm" aria-label="End call">
            <PhoneOff />
          </Button>
        </div>
      </div>

      {/* Streaming transcript */}
      <div className="border-t border-border bg-muted/40 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
            Transcript · {liveCall.agent}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">translating live</span>
        </div>
        <ul className="mt-2.5 space-y-1.5">
          {liveCall.transcript.map((entry, i) => (
            <li
              key={i}
              className="flex gap-3 text-sm"
              data-latest={i === liveCall.transcript.length - 1 ? "" : undefined}
            >
              <span className="w-14 shrink-0 pt-px text-xs text-muted-foreground">
                {entry.speaker}
              </span>
              <span
                className={
                  i === liveCall.transcript.length - 1 ? "text-foreground" : "text-muted-foreground"
                }
              >
                {entry.line}
                {i === liveCall.transcript.length - 1 ? (
                  <span className="ml-1 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-river" />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Waiting */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-5 py-3">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
          Waiting · {waitingCalls.length}
        </span>
        {waitingCalls.map((call) => (
          <span key={call.caller} className="flex items-center gap-2 text-xs">
            <span aria-hidden className="size-1.5 rounded-full bg-amber" />
            <span className="font-mono">{call.caller}</span>
            <span className="text-muted-foreground">{call.agent}</span>
            <span className="font-mono text-muted-foreground tabular-nums">{call.waited}</span>
          </span>
        ))}
      </div>
    </section>
  );
}
