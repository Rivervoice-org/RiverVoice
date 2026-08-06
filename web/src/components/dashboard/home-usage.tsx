import { metrics, usage } from "@/components/dashboard/data";

/** Today in three figures, and how much of the plan is left. */
export function HomeUsage() {
  const pct = Math.round((usage.minutes.used / usage.minutes.included) * 100);

  return (
    <section className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="grid gap-x-8 gap-y-5 rounded-xl border border-border p-5 sm:grid-cols-3">
        {metrics.slice(0, 3).map((metric) => (
          <div key={metric.label} className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
              {metric.value}
            </p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {metric.delta} {metric.caption}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col justify-between rounded-xl border border-border p-5">
        <div>
          <p className="text-xs text-muted-foreground">Minutes left</p>
          <p className="mt-2 text-2xl leading-none font-semibold tracking-[-0.02em] tabular-nums">
            {(usage.minutes.included - usage.minutes.used).toLocaleString()}
          </p>
        </div>

        <div className="mt-5">
          <div className="h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {usage.minutes.used.toLocaleString()} of {usage.minutes.included.toLocaleString()} used
            · resets {usage.renewsOn}
          </p>
        </div>
      </div>
    </section>
  );
}
