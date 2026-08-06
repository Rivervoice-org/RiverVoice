import { cn } from "@/lib/utils";

/**
 * Live audio bars. Deterministic heights and delays so the server and client
 * render the same markup — the motion is pure CSS.
 */
const AMPLITUDES = [
  0.32, 0.58, 0.86, 0.44, 0.7, 0.95, 0.5, 0.26, 0.62, 0.88, 0.4, 0.74, 0.55, 0.92, 0.34, 0.66, 0.48,
  0.8, 0.28, 0.6, 0.9, 0.42, 0.72, 0.52, 0.84, 0.3, 0.68, 0.46, 0.78, 0.36, 0.64, 0.98, 0.38, 0.56,
  0.82, 0.44,
];

export function Waveform({
  className,
  live = true,
  bars = AMPLITUDES.length,
}: {
  className?: string;
  live?: boolean;
  bars?: number;
}) {
  return (
    <div aria-hidden className={cn("flex h-10 items-center gap-[3px] overflow-hidden", className)}>
      {AMPLITUDES.slice(0, bars).map((amplitude, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] flex-1 origin-center rounded-full",
            live ? "animate-bar bg-river" : "bg-border",
          )}
          style={{
            height: `${Math.round(amplitude * 100)}%`,
            animationDelay: `-${(i % 7) * 0.16 + amplitude * 0.3}s`,
            animationDuration: `${0.9 + (i % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Flat static trace used for completed recordings. */
export function WaveformStatic({ className }: { className?: string }) {
  return <Waveform className={className} live={false} bars={28} />;
}
