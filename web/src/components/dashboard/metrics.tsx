import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { metrics } from "@/components/dashboard/data";
import { cn } from "@/lib/utils";

function Sparkline({ series, className }: { series: number[]; className?: string }) {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const step = 100 / (series.length - 1);
  const points = series
    .map((value, i) => `${(i * step).toFixed(2)},${(28 - ((value - min) / span) * 24).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 30"
      preserveAspectRatio="none"
      className={cn("h-7 w-full", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Metrics() {
  return (
    <section aria-label="This week" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, i) => (
        <article
          key={metric.label}
          className="surface animate-rise flex flex-col gap-3 p-4 transition-shadow hover:shadow-(--shadow-lift)"
          style={{ animationDelay: `${60 + i * 45}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                metric.trend === "up" ? "bg-river-tint text-river" : "bg-amber-tint text-amber",
              )}
            >
              {metric.trend === "up" ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
              {metric.delta}
            </span>
          </div>

          <p className="font-serif text-4xl leading-none font-light tracking-tight tabular-nums">
            {metric.value}
          </p>

          <div className="flex items-end justify-between gap-3">
            <p className="text-[11px] text-muted-foreground">{metric.caption}</p>
            <Sparkline
              series={metric.series}
              className={cn("max-w-24", metric.trend === "up" ? "text-river" : "text-amber")}
            />
          </div>
        </article>
      ))}
    </section>
  );
}
