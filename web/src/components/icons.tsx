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

/**
 * A contact list with a call leaving it: three rows that shorten as the queue
 * drains, and an arrow going up and out to the right. Megaphone read as
 * marketing blast; a campaign here is a list being dialed.
 */
export function CampaignIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.4 6.2h11.4" />
      <path d="M3.4 11.2h7.6" />
      <path d="M3.4 16.2h5.4" />
      <path d="m13.2 18.6 7.4-7.4" />
      <path d="M15.4 11.2h5.2v5.2" />
    </Svg>
  );
}

/**
 * A snippet in a rounded frame — the same frame as AnalyticsIcon, so the two
 * read as one family. The marks sit a touch wider than lucide's SquareCode
 * would put them, which keeps the gaps open at 16px.
 */
export function DeployCodeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2.75" y="2.75" width="18.5" height="18.5" rx="5" />
      <path d="M9.3 9.3 6.9 12l2.4 2.7" />
      <path d="m14.7 9.3 2.4 2.7-2.4 2.7" />
      <path d="M13.2 8.6 10.8 15.4" />
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
