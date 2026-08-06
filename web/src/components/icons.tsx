import { cn } from "@/lib/utils";

/**
 * Icons we draw ourselves, on the same 24px grid and 1.75 stroke as the lucide
 * set the rest of the app uses, so the two can sit side by side.
 */
type IconProps = { className?: string; strokeWidth?: number };

function Svg({
  className,
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/**
 * Two volumes leaning together, each with a band across the spine. Drawn to
 * span 3–21 on the grid, the same optical size as the lucide glyphs beside it
 * (their artwork runs 2–22); the first pass sat at 5–19 and read small.
 */
export function KnowledgeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <g transform="rotate(-9 7 12)">
        <rect x="3.4" y="3.4" width="7" height="17.2" rx="1.5" />
        <path d="M3.4 7.8h7" />
      </g>
      <g transform="rotate(9 17 12)">
        <rect x="13.6" y="3.4" width="7" height="17.2" rx="1.5" />
        <path d="M13.6 7.8h7" />
      </g>
    </Svg>
  );
}

/** Bars in a rounded frame — a report, rather than a loose chart. */
export function AnalyticsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" />
      <path d="M8 16v-3.2" />
      <path d="M12 16V8.4" />
      <path d="M16 16v-5.4" />
    </Svg>
  );
}
