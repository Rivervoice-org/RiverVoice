import { cn } from "@/lib/utils";

/**
 * Every agent gets its own mascot: a small pixel creature derived from its
 * name. Same name always draws the same shape and hue, so an agent is
 * recognisable at a glance without anyone picking an avatar.
 */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const GRID = 5;

export function Mascot({
  seed,
  className,
  size = 28,
}: {
  seed: string;
  className?: string;
  size?: number;
}) {
  const h = hash(seed);
  const hue = h % 360;
  const fill = `oklch(0.58 0.16 ${hue})`;
  const shade = `oklch(0.72 0.11 ${hue})`;

  const cells: { x: number; y: number; tone: string }[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < Math.ceil(GRID / 2); x++) {
      // Two bits per cell: one decides fill, one picks the lighter tone.
      const bit = (h >> ((y * 3 + x) % 29)) & 1;
      const tone = (h >> ((y * 5 + x * 2 + 3) % 29)) & 1;
      if (!bit) continue;
      const color = tone ? shade : fill;
      cells.push({ x, y, tone: color });
      if (x !== GRID - 1 - x) cells.push({ x: GRID - 1 - x, y, tone: color });
    }
  }

  return (
    <svg
      role="img"
      aria-label={`${seed} mascot`}
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
    >
      {cells.map((cell, i) => (
        <rect key={i} x={cell.x} y={cell.y} width={1.02} height={1.02} rx={0.18} fill={cell.tone} />
      ))}
    </svg>
  );
}
