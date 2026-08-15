"use client";

import { IndianRupee } from "lucide-react";

import { computeSegments, formatINR, type SegmentCost } from "@/lib/pricing/rates";
import type { Agent } from "@/lib/agents/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEGMENT_COLOR: Record<SegmentCost["key"], string> = {
  telephony: "bg-cost-telephony",
  stt: "bg-cost-stt",
  llm: "bg-cost-llm",
  tts: "bg-cost-tts",
};

const AVG_CALL_MINUTES = 3.5;

export function BuilderPricingSummary({ agent }: { agent: Agent }) {
  const segments = computeSegments(agent, AVG_CALL_MINUTES);
  const totalSell = segments.reduce((sum, s) => sum + s.sell, 0);
  const totalCost = segments.reduce((sum, s) => sum + s.cost, 0);
  const marginPct = totalSell > 0 ? Math.round(((totalSell - totalCost) / totalSell) * 100) : 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Price per call breakdown"
            className="hidden rounded-full text-[13px] sm:flex"
          />
        }
      >
        <IndianRupee className="text-muted-foreground" strokeWidth={1.75} />
        <span className="font-mono tabular-nums">{formatINR(totalSell)}</span>
        <span className="text-muted-foreground">/ call</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-80 gap-3 p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium">Price per call</p>
          <p className="text-[11px] text-muted-foreground">
            at {AVG_CALL_MINUTES.toFixed(1)} min avg
          </p>
        </div>

        <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted">
          {segments.map((segment) => {
            const pct = totalSell > 0 ? (segment.sell / totalSell) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={segment.key}
                className={cn(
                  "h-full first:rounded-l-full last:rounded-r-full",
                  SEGMENT_COLOR[segment.key],
                )}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>

        <ul className="flex flex-col gap-1.5">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-2 text-[12px]">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", SEGMENT_COLOR[segment.key])}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {segment.label} · {segment.vendor}
                {segment.model ? ` ${segment.model}` : ""}
              </span>
              <span className="shrink-0 font-mono tabular-nums">{formatINR(segment.sell)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between border-t border-border pt-2 text-[12px]">
          <span className="text-muted-foreground">Vendor cost {formatINR(totalCost)}</span>
          <span className="font-medium">{marginPct}% margin</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
