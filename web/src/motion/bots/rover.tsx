"use client";

/**
 * Rover — the little worker.
 *
 * A boxy tracked robot with binocular eyes on a stalk: the archetype from the
 * films, drawn as ours rather than copied. The expression lives entirely in the
 * brows and the tilt of the head, because at this size a mouth would be mud.
 *
 * Reusable on purpose. It takes a point, a size and a handful of pose props, and
 * draws itself around that point in whatever coordinate space it is dropped
 * into — no viewBox of its own, no clock, nothing to wire up. Anything that
 * needs a character rather than a mascot avatar can use it, and unlike the
 * DiceBear mascots it is real svg, so it survives being nested in a scene.
 *
 * Drawn around the centre of the body block: the treads sit at +50 and the top
 * of the head at -70, so a size of 1 occupies roughly 120 units of height.
 */

type Props = {
  x: number;
  y: number;
  /** 1 draws it about 120 units tall. */
  size?: number;
  /** Degrees the head turns, toward whatever it is attending to. */
  look?: number;
  /** Degrees the head rolls. A little of this reads as curiosity. */
  tilt?: number;
  /** Degrees the whole body leans, from the treads. */
  lean?: number;
  /** 1 open, 0 shut. */
  blink?: number;
  /** How pleased it is, which only the brows carry. */
  smile?: number;
  /** Arms out in front, as though holding whatever is drawn there. */
  holding?: boolean;
  /** The lenses lit, for when it is the one talking. */
  lit?: number;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function Rover({
  x,
  y,
  size = 1,
  look = 0,
  tilt = 0,
  lean = 0,
  blink = 1,
  smile = 0,
  holding = false,
  lit = 0,
}: Props) {
  // Down at the inner ends is a frown, up is pleased. Everything this character
  // feels is these two short lines.
  const brow = 4 - smile * 7;
  const shut = Math.max(0.06, blink);

  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} {...stroke}>
      <g transform={`rotate(${lean} 0 44)`}>
        {/* Treads. Two blocks rather than one, or it reads as a crate. */}
        {[-1, 1].map((side) => (
          <g key={side} transform={`translate(${side * 27} 0)`}>
            <path
              d="M-13,28 h26 a11,11 0 0 1 0,22 h-26 a11,11 0 0 1 0,-22 Z"
              strokeWidth={2.4}
              fill="currentColor"
              fillOpacity={0.04}
            />
            {[-6, 0, 6].map((n) => (
              <path key={n} d={`M${n},32 v14`} strokeWidth={1.4} opacity={0.35} />
            ))}
          </g>
        ))}

        {/* The body: a box that has been worked in, with a hatch across it */}
        <path
          d="M-31,-25 h62 a8,8 0 0 1 8,8 v34 a8,8 0 0 1 -8,8 h-62 a8,8 0 0 1 -8,-8 v-34 a8,8 0 0 1 8,-8 Z"
          strokeWidth={2.6}
          fill="currentColor"
          fillOpacity={0.03}
        />
        <path d="M-33,-2 h66" strokeWidth={1.6} opacity={0.4} />
        <path d="M-8,-2 v8 h16 v-8" strokeWidth={1.6} opacity={0.5} />

        {/* A panel on the chest, which is what makes it a machine and not a bin */}
        <path d="M-24,-18 h18 v10 h-18 Z" strokeWidth={1.5} opacity={0.4} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={12 + i * 7} cy={-13} r={1.6} fill="currentColor" opacity={0.4} />
        ))}

        {/* Arms. Out in front when it is carrying something, tucked otherwise. */}
        {holding ? (
          <>
            <path d="M-39,-6 C-50,-2 -52,10 -44,20" strokeWidth={2.4} />
            <path d="M39,-6 C50,-2 52,10 44,20" strokeWidth={2.4} />
            <path d="M-48,18 l-5,5 M-44,20 l-2,7" strokeWidth={2.2} />
            <path d="M48,18 l5,5 M44,20 l2,7" strokeWidth={2.2} />
          </>
        ) : (
          <>
            <path d="M-39,-8 C-46,-4 -47,8 -42,16" strokeWidth={2.4} />
            <path d="M39,-8 C46,-4 47,8 42,16" strokeWidth={2.4} />
          </>
        )}

        {/* The neck, telescoping out of the body */}
        <path d="M-7,-25 v-10 M7,-25 v-10" strokeWidth={2.2} />
        <path d="M-9,-35 h18" strokeWidth={2} opacity={0.6} />

        {/* The head turns on the neck rather than the body pivoting under it */}
        <g transform={`rotate(${look} 0 -35) translate(0 -35) rotate(${tilt})`}>
          {/* The yoke both lenses hang off */}
          <path d="M-16,-14 h32" strokeWidth={2.2} opacity={0.6} />
          <path d="M0,-8 v-6" strokeWidth={2} opacity={0.6} />

          {[-15, 15].map((cx) => (
            <g key={cx}>
              <circle
                cx={cx}
                cy={-20}
                r={13}
                strokeWidth={2.6}
                fill="currentColor"
                fillOpacity={0.03 + lit * 0.09}
              />
              {/* The lens shuts by closing, not by shrinking */}
              <g transform={`translate(${cx} -20) scale(1 ${shut}) translate(${-cx} 20)`}>
                <circle cx={cx} cy={-20} r={5.4} strokeWidth={2.2} />
                <circle cx={cx - 1.8} cy={-21.8} r={1.8} fill="currentColor" stroke="none" />
              </g>
            </g>
          ))}

          {/* The brows. The whole face, really. */}
          <path d={`M-27,${-35 + brow * 0.3} L-5,${-33 + brow}`} strokeWidth={3} />
          <path d={`M27,${-35 + brow * 0.3} L5,${-33 + brow}`} strokeWidth={3} />
        </g>
      </g>
    </g>
  );
}
