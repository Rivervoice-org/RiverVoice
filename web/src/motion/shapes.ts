import type { Shape } from "@/motion/sketch";

const round = (n: number) => Math.round(n * 10) / 10;

export function box(x: number, y: number, w: number, h: number, r = 10): string {
  const radius = Math.min(r, w / 2, h / 2);
  return [
    `M${round(x + radius)},${round(y)}`,
    `H${round(x + w - radius)}`,
    `A${radius},${radius} 0 0 1 ${round(x + w)},${round(y + radius)}`,
    `V${round(y + h - radius)}`,
    `A${radius},${radius} 0 0 1 ${round(x + w - radius)},${round(y + h)}`,
    `H${round(x + radius)}`,
    `A${radius},${radius} 0 0 1 ${round(x)},${round(y + h - radius)}`,
    `V${round(y + radius)}`,
    `A${radius},${radius} 0 0 1 ${round(x + radius)},${round(y)}`,
    "Z",
  ].join(" ");
}

/** The tail points left for the other person, right for you. */
export function bubble(x: number, y: number, w: number, h: number, side: "left" | "right"): string {
  const r = 9;
  const tail = 7;

  if (side === "left") {
    return [
      `M${round(x + r)},${round(y)}`,
      `H${round(x + w - r)}`,
      `A${r},${r} 0 0 1 ${round(x + w)},${round(y + r)}`,
      `V${round(y + h - r)}`,
      `A${r},${r} 0 0 1 ${round(x + w - r)},${round(y + h)}`,
      `H${round(x + r)}`,
      `L${round(x - tail)},${round(y + h + tail * 0.7)}`,
      `L${round(x)},${round(y + h - r)}`,
      `V${round(y + r)}`,
      `A${r},${r} 0 0 1 ${round(x + r)},${round(y)}`,
      "Z",
    ].join(" ");
  }

  return [
    `M${round(x + r)},${round(y)}`,
    `H${round(x + w - r)}`,
    `A${r},${r} 0 0 1 ${round(x + w)},${round(y + r)}`,
    `V${round(y + h - r)}`,
    `L${round(x + w + tail)},${round(y + h + tail * 0.7)}`,
    `L${round(x + w - r)},${round(y + h)}`,
    `H${round(x + r)}`,
    `A${r},${r} 0 0 1 ${round(x)},${round(y + h - r)}`,
    `V${round(y + r)}`,
    `A${r},${r} 0 0 1 ${round(x + r)},${round(y)}`,
    "Z",
  ].join(" ");
}

/** Straight folds only — curves turn to mush once sketched. */
export function plane(x: number, y: number, size: number): string {
  const s = size / 32;
  const at = (px: number, py: number) => `${round(x + px * s)},${round(y + py * s)}`;

  return [
    `M${at(0, 13)}`,
    `L${at(32, 1)}`,
    `L${at(25, 31)}`,
    `L${at(16, 22)}`,
    `L${at(9, 27)}`,
    `L${at(10, 18)}`,
    "Z",
    // The crease, so it reads as folded paper rather than a dart.
    `M${at(10, 18)}`,
    `L${at(32, 1)}`,
  ].join(" ");
}

export function phone(x: number, y: number, w: number, h: number): Shape[] {
  return [
    { kind: "svg", d: box(x, y, w, h, 18) },
    { kind: "svg", d: box(x + w / 2 - 16, y + 8, 32, 4, 2) },
  ];
}

export const check = (x: number, y: number, size = 9): Shape => ({
  kind: "path",
  points: [
    [x, y],
    [x + size * 0.4, y + size * 0.5],
    [x + size, y - size * 0.5],
  ],
});

export function ticks(x: number, y: number): Shape[] {
  return [check(x, y, 7), check(x + 5, y, 7)];
}

export const chevronLeft = (x: number, y: number, size = 8): Shape => ({
  kind: "path",
  points: [
    [x + size * 0.6, y - size * 0.7],
    [x, y],
    [x + size * 0.6, y + size * 0.7],
  ],
});
