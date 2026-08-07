import { lorelei, notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

import { bot } from "@/components/dashboard/bot-art";
import { cn } from "@/lib/utils";

/**
 * Every agent gets its own mascot, drawn from its name — the same name always
 * produces the same character, so nobody has to pick an avatar.
 *
 * Three styles are offered; notionists is the default. Both DiceBear styles are
 * CC0 and the bots are ours, so nothing here owes attribution — but the picker
 * credits each from the `meta` below, so check the licence before adding one.
 */

/** Two mouths from the set's own `lips` options: open, then closed. */
const MOUTH_OPEN = "variant19";
const MOUTH_SHUT = "variant10";

type Extra = { lips?: string };

type Frame = { seed: string; size: number; radius: number };

/** Mirrors DiceBear's own meta, where every field is optional. */
type StyleMeta = {
  title?: string;
  creator?: string;
  source?: string;
  license?: { name: string; url?: string };
};

type StyleEntry = {
  label: string;
  meta: StyleMeta;
  render: (frame: Frame) => { toString: () => string; toDataUri: () => string };
};

/**
 * Each style needs its own call so the option types stay checked, and only
 * notionists needs reframing — the rest sit correctly at their own defaults.
 */
const STYLES = {
  notionists: {
    label: "Hand-drawn",
    meta: notionists.meta,
    render: (f: Frame) => createAvatar(notionists, { ...f, scale: 130, translateY: 6 }),
  },
  rivervoice: {
    label: "Bots",
    meta: { title: "Rivervoice bots", creator: "Rivervoice" },
    render: (f: Frame) => bot(f.seed, f.size),
  },
  lorelei: {
    label: "Inked",
    meta: lorelei.meta,
    render: (f: Frame) => createAvatar(lorelei, f),
  },
} satisfies Record<string, StyleEntry>;

export type MascotStyleId = keyof typeof STYLES;

export const MASCOT_STYLE_IDS = Object.keys(STYLES) as MascotStyleId[];

/** Annotated so the per-style literal types widen to one shape at the call site. */
export function mascotStyle(id: MascotStyleId): { label: string; meta: StyleMeta } {
  return STYLES[id];
}

const DEFAULT_STYLE: MascotStyleId = "notionists";

/** Stored as "style:seed". A bare string is a seed in the default style. */
export function parseMascot(ref: string): { style: MascotStyleId; seed: string } {
  const split = ref.indexOf(":");
  const head = split > 0 ? ref.slice(0, split) : "";
  if (head in STYLES) {
    return { style: head as MascotStyleId, seed: ref.slice(split + 1) };
  }
  return { style: DEFAULT_STYLE, seed: ref };
}

export function mascotRef(style: MascotStyleId, seed: string) {
  return style === DEFAULT_STYLE ? seed : `${style}:${seed}`;
}

function memo<T>(store: Map<string, T>, key: string, make: () => T) {
  const hit = store.get(key);
  if (hit !== undefined) return hit;
  const made = make();
  if (store.size > 400) store.clear();
  store.set(key, made);
  return made;
}

const drawn = new Map<string, string>();

/** Mouths and beards are notionists-only options, so this path stays on it. */
function drawNotionists(seed: string, size: number, extra: Extra = {}) {
  const key = `${seed}|${size}|${extra.lips ?? ""}`;
  return memo(drawn, key, () =>
    createAvatar(notionists, {
      seed,
      size,
      ...(extra.lips ? { lips: [extra.lips as "variant10"] } : {}),
      radius: 50,
      scale: 130,
      translateY: 6,
    }).toString(),
  );
}

function draw(ref: string, size: number) {
  return memo(drawn, `svg|${ref}|${size}`, () => {
    const { style, seed } = parseMascot(ref);
    return STYLES[style].render({ seed, size, radius: 50 }).toString();
  });
}

const uris = new Map<string, string>();

/** For grids: an <img> costs one decode, inline SVG costs hundreds of nodes. */
export function mascotDataUri(ref: string, size: number) {
  return memo(uris, `${ref}|${size}`, () => {
    const { style, seed } = parseMascot(ref);
    return STYLES[style].render({ seed, size, radius: 50 }).toDataUri();
  });
}

export function warmMascots(refs: string[], size: number) {
  for (const ref of refs) mascotDataUri(ref, size);
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
  // Only notionists has the mouth options the animation swaps between.
  if (!talking || parseMascot(seed).style !== "notionists") {
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
 * One agent in the rail: line art, no tile, inverted in dark. Two mouths sit
 * stacked and stay still until you point at the row, then they alternate — so
 * the icon is quiet by default and starts talking under the cursor.
 */
function glyph(lips: string, size: number) {
  return createAvatar(notionists, {
    seed: "Rivervoice agent",
    size,
    scale: 185,
    translateY: 14,
    backgroundColor: ["transparent"],
    beardProbability: 100,
    lips: [lips as "variant10"],
  }).toString();
}

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
        dangerouslySetInnerHTML={{ __html: glyph(MOUTH_OPEN, size) }}
      />
      <span
        className="absolute inset-0 group-hover/row:animate-mouth-shut"
        dangerouslySetInnerHTML={{ __html: glyph(MOUTH_SHUT, size) }}
      />
    </span>
  );
}
