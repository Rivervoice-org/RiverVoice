import { lorelei, notionists } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

import { bot } from "@/mascots/bot";

/**
 * Every agent gets its own mascot, drawn from its name — the same name always
 * produces the same character, so nobody has to pick an avatar.
 *
 * Three styles are offered; notionists is the default. Both DiceBear styles are
 * CC0 and the bots are ours, so nothing here owes attribution — but the picker
 * credits each from the `meta` below, so check the licence before adding one.
 */

/** Two mouths from the set's own `lips` options: open, then closed. */
export const MOUTH_OPEN = "variant19";
export const MOUTH_SHUT = "variant10";

export type Extra = { lips?: string };

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

// Ink on nothing, so it vanishes on a dark surface. The DiceBear styles carry
// their own colour and would come out lurid, hence the narrow test.
export const invertsInDark = (ref: string) => parseMascot(ref).style === "rivervoice";

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
export function drawNotionists(seed: string, size: number, extra: Extra = {}) {
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

export function draw(ref: string, size: number) {
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

/** The sidebar glyph: line art, no tile, one fixed face. */
export function navGlyph(lips: string, size: number) {
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
