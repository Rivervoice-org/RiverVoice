export type MascotStyleId = "notionists" | "lorelei";

const DEFAULT_STYLE: MascotStyleId = "notionists";

/** Stored as "style:seed". A bare string is a seed in the default style. */
export function parseMascot(ref: string): { style: MascotStyleId; seed: string } {
  const split = ref.indexOf(":");
  const head = split > 0 ? ref.slice(0, split) : "";
  if (head === "notionists" || head === "lorelei") {
    return { style: head, seed: ref.slice(split + 1) };
  }
  return { style: DEFAULT_STYLE, seed: ref };
}

export function mascotRef(style: MascotStyleId, seed: string) {
  return style === DEFAULT_STYLE ? seed : `${style}:${seed}`;
}

export const MASCOT_STYLE_IDS: MascotStyleId[] = ["notionists", "lorelei"];

/** Annotated so the per-style literal types widen to one shape at the call site. */
export function mascotStyle(id: MascotStyleId): { label: string; meta: { title: string; license?: { name: string } } } {
  return id === "notionists"
    ? { label: "Hand-drawn", meta: { title: "Notionists", license: { name: "CC0" } } }
    : { label: "Inked", meta: { title: "Lorelei", license: { name: "CC0" } } };
}

/**
 * DiceBear's API URL for a face. The URL is deterministic — same ref, same
 * size, same image — so the app can prefetch and Image's cache serves the rest.
 *
 * `extraParams` passes through style-specific DiceBear options (e.g.
 * notionists' `glassesProbability`) for the rare call site that needs a
 * specific trait rather than whatever the seed's hash happens to produce.
 */
export function avatarUrl(
  ref: string,
  size: number,
  extraParams?: Record<string, string | number>
) {
  const { style, seed } = parseMascot(ref);
  const params = new URLSearchParams({
    seed,
    size: String(size),
    radius: "50",
    scale: "130",
    translateY: "6",
  });
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    params.set(key, String(value));
  }
  return `https://api.dicebear.com/9.x/${style}/png?${params.toString()}`;
}

/** The set of faces a picker shows: one per offered name, in one style. */
export const SEEDS = [
  "Aarav",
  "Ananya",
  "Bilal",
  "Chitra",
  "Dev",
  "Eesha",
  "Farhan",
  "Gauri",
  "Hari",
  "Ira",
  "Jai",
  "Kabir",
  "Lakshmi",
  "Meera",
  "Nikhil",
  "Omkar",
  "Priya",
  "Rhea",
] as const;
