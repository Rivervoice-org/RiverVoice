import { cn } from "@/lib/utils";

/**
 * A jaali — the perforated stone lattice cut into Indian screens and windows,
 * built here from the interlocking circles the real ones are set out with.
 * Drawn geometrically and kept near-invisible so it reads as architecture
 * behind the page rather than as decoration on top of it.
 *
 * It inherits currentColor, so it survives the dark theme without a second
 * palette.
 */
export function Jaali({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      style={style}
      // Over-wide, so a drifting lattice never uncovers the right-hand edge.
      className={cn(
        "pointer-events-none absolute -inset-x-16 inset-y-0 text-foreground",
        className,
      )}
    >
      <svg className="size-full" aria-hidden>
        <defs>
          <pattern id="jaali" width="56" height="56" patternUnits="userSpaceOnUse">
            {/* Circles on the corners and centre interlock into the lattice */}
            <g fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="0" cy="0" r="28" />
              <circle cx="56" cy="0" r="28" />
              <circle cx="0" cy="56" r="28" />
              <circle cx="56" cy="56" r="28" />
              <circle cx="28" cy="28" r="28" />
            </g>
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#jaali)" opacity="0.055" />
      </svg>
    </div>
  );
}

/**
 * A marigold stroke under a phrase — drawn slightly loose and overshooting the
 * word, the way a garland sits rather than a ruled underline.
 */
export function Swash({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 12"
      preserveAspectRatio="none"
      className={cn("absolute inset-x-0 -bottom-1 h-2.5 w-full text-amber", className)}
    >
      <path
        d="M2 8.5C38 3.2 96 2 198 5.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="swash-draw"
      />
    </svg>
  );
}
