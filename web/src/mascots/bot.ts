import { EYES, INK, MOUTHS, SHELLS, TOPS } from "@/mascots/parts";

/** FNV-1a hashed into an LCG, so every slot draws an independent number. */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

function pick(list: readonly string[], n: number) {
  return list[n % list.length];
}

function botSvg(seed: string, size: number) {
  const next = rng(seed);
  const shell = pick(SHELLS, next());
  const eyes = pick(EYES, next());
  const mouth = pick(MOUTHS, next());
  const top = pick(TOPS, next());
  // A degree or two of lean, so a grid of them never looks stamped out.
  const lean = ((next() % 5) - 2) * 0.9;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<g transform="rotate(${lean} 50 52)" fill="none" stroke="${INK}" ` +
    `stroke-linecap="round" stroke-linejoin="round">` +
    `${shell}${top}${eyes}${mouth}</g></svg>`
  );
}

/** Matches what DiceBear's createAvatar returns, so every style is one shape. */
export function bot(seed: string, size: number) {
  const svg = botSvg(seed, size);
  return {
    toString: () => svg,
    toDataUri: () => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
  };
}
