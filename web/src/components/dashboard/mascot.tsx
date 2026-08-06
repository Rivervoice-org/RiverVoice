import { notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

import { cn } from "@/lib/utils";

/**
 * Every agent gets its own mascot, drawn from its name — the same name always
 * produces the same character, so nobody has to pick an avatar.
 *
 * Style: DiceBear "notionists" (CC0, no attribution required), rendered on the
 * server as inline SVG so there are no image requests at runtime. To change the
 * look, swap both the import and the first argument to createAvatar: bottts
 * (robots), thumbs (abstract, CC0), icons (pictograms, MIT), funEmoji or
 * croodles (CC BY 4.0 — those two need attribution).
 */

/** The ground comes from the theme, so faces stay right in dark mode. */

/** Two mouths from the set's own `lips` options: open, then closed. */
const MOUTH_OPEN = "variant19";
const MOUTH_SHUT = "variant10";

function draw(seed: string, size: number, lips?: string) {
  return createAvatar(notionists, {
    seed,
    size,
    ...(lips ? { lips: [lips as "variant10"] } : {}),
    radius: 50,
    scale: 130,
    translateY: 6,
  }).toString();
}

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
  if (!talking) {
    return (
      <span
        role="img"
        aria-label={`${seed} mascot`}
        style={{ width: size, height: size }}
        className={cn(
          "inline-block shrink-0 overflow-hidden rounded-full bg-muted",
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
        dangerouslySetInnerHTML={{ __html: draw(seed, size, MOUTH_OPEN) }}
      />
      <span
        aria-hidden
        style={{ animationDelay: talkDelay }}
        className="animate-mouth-shut absolute inset-0 overflow-hidden rounded-full"
        dangerouslySetInnerHTML={{ __html: draw(seed, size, MOUTH_SHUT) }}
      />
    </span>
  );
}
