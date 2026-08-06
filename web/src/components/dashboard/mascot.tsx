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

/** Soft grounds pulled from the app's own warm neutrals. */
const BACKGROUNDS = ["f0efec", "e7efee", "efeaf3", "f5ece5", "e9eef5", "f4ece9"];

export function Mascot({
  seed,
  className,
  size = 28,
}: {
  seed: string;
  className?: string;
  size?: number;
}) {
  const svg = createAvatar(notionists, {
    seed,
    size,
    radius: 50,
    scale: 130,
    translateY: 6,
    backgroundColor: BACKGROUNDS,
    backgroundType: ["solid"],
  }).toString();

  return (
    <span
      role="img"
      aria-label={`${seed} mascot`}
      style={{ width: size, height: size }}
      className={cn("inline-block shrink-0 overflow-hidden rounded-full", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
