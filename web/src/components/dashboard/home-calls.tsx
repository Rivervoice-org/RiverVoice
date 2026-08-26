import Link from "next/link";

import { calls, type Call } from "@/components/dashboard/data";

const outcomes: Record<Call["outcome"], string> = {
  resolved: "Resolved",
  transferred: "Transferred",
  voicemail: "Voicemail",
  dropped: "Dropped",
};

/** The last few calls, as a list rather than a spreadsheet. */
export function HomeCalls() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Recent calls</h2>
        <Link
          href="/agents"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Call log
        </Link>
      </div>

      <ul className="flex flex-col">
        {calls.slice(0, 5).map((call) => (
          <li
            key={call.id}
            className="flex cursor-pointer items-center gap-3 border-b border-border py-3 text-sm last:border-b-0 hover:bg-muted/40 sm:gap-4"
          >
            <span className="w-28 shrink-0 truncate font-mono text-[13px] sm:w-40">
              {call.caller}
            </span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{call.agent}</span>
            <span className="hidden w-40 shrink-0 truncate text-muted-foreground md:block">
              {call.language}
            </span>
            <span className="hidden w-28 shrink-0 truncate text-muted-foreground sm:block">
              {outcomes[call.outcome]}
            </span>
            <span className="hidden w-12 shrink-0 text-right font-mono text-[13px] text-muted-foreground tabular-nums xs:block">
              {call.duration}
            </span>
            <span className="w-12 shrink-0 text-right font-mono text-[13px] text-muted-foreground tabular-nums">
              {call.time}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
