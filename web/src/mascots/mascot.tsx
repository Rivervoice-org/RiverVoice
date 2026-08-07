import {
  MOUTH_OPEN,
  MOUTH_SHUT,
  draw,
  drawNotionists,
  invertsInDark,
  navGlyph,
  parseMascot,
} from "@/mascots/styles";
import { cn } from "@/lib/utils";

const hoverLean =
  "transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.5,1)] hover:-rotate-6 hover:scale-110 group-hover:-rotate-6 group-hover:scale-110";

export function Mascot({
  seed,
  className,
  size = 28,
  talking = false,
  talkDelay = "0s",
}: {
  seed: string;
  className?: string;
  size?: number;
  /** Alternates the set's own two mouths so the agent looks mid-sentence. */
  talking?: boolean;
  /** Offsets the mouth, so a crowd does not speak in unison. */
  talkDelay?: string;
}) {
  // Only notionists has the mouth options the animation swaps between.
  if (!talking || parseMascot(seed).style !== "notionists") {
    return (
      <span
        role="img"
        aria-label={`${seed} mascot`}
        style={{ width: size, height: size }}
        className={cn(
          "inline-block shrink-0 overflow-hidden rounded-full bg-muted",
          // The svg only: inverting the span would flip the tile behind it too.
          invertsInDark(seed) && "dark:[&>svg]:invert",
          hoverLean,
          className,
        )}
        dangerouslySetInnerHTML={{ __html: draw(seed, size) }}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`${seed} mascot, speaking`}
      style={{ width: size, height: size }}
      className={cn(
        "relative inline-block shrink-0 overflow-hidden rounded-full bg-muted",
        hoverLean,
        className,
      )}
    >
      <span
        aria-hidden
        style={{ animationDelay: talkDelay }}
        className="animate-mouth-open absolute inset-0 overflow-hidden rounded-full"
        dangerouslySetInnerHTML={{ __html: drawNotionists(seed, size, { lips: MOUTH_OPEN }) }}
      />
      <span
        aria-hidden
        style={{ animationDelay: talkDelay }}
        className="animate-mouth-shut absolute inset-0 overflow-hidden rounded-full"
        dangerouslySetInnerHTML={{ __html: drawNotionists(seed, size, { lips: MOUTH_SHUT }) }}
      />
    </span>
  );
}

/**
 * One agent in the rail. Two mouths sit stacked and stay still until you point
 * at the row, then they alternate — so the icon is quiet by default and starts
 * talking under the cursor.
 */
export function MascotNavIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Agents"
      style={{ width: size, height: size }}
      className={cn("relative inline-block shrink-0 dark:invert", className)}
    >
      <span
        className="absolute inset-0 opacity-0 group-hover/row:animate-mouth-open"
        dangerouslySetInnerHTML={{ __html: navGlyph(MOUTH_OPEN, size) }}
      />
      <span
        className="absolute inset-0 group-hover/row:animate-mouth-shut"
        dangerouslySetInnerHTML={{ __html: navGlyph(MOUTH_SHUT, size) }}
      />
    </span>
  );
}
