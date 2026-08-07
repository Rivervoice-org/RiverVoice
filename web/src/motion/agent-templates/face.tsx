"use client";

/**
 * The agent, drawn.
 *
 * Every scene had been embedding the roster avatar — as an <image href>, behind
 * a clipPath, in a foreignObject — and every one of those fails silently inside
 * an inline svg, so the face simply never appeared. This is drawn in the panel's
 * own line instead, which cannot fail, and the card beside it already shows the
 * template's real mascot.
 *
 * One of our own bots, so the thing on the line is plainly the agent.
 */
export function Face({
  x,
  y,
  r = 28,
  look = 0,
  blink = 1,
}: {
  x: number;
  y: number;
  r?: number;
  /** Degrees, toward whatever it is attending to. */
  look?: number;
  /** 1 open, near 0 shut. */
  blink?: number;
}) {
  // Drawn at r = 28 and scaled, so the line weight stays even at any size.
  const k = r / 28;

  return (
    <g transform={`translate(${x} ${y}) rotate(${look}) scale(${k})`}>
      <circle r={28} fill="currentColor" opacity={0.07} />

      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Shell */}
        <path
          d="M-17,-13 H17 A9,9 0 0 1 26,-4 V6 A9,9 0 0 1 17,15 H-17 A9,9 0 0 1 -26,6 V-4 A9,9 0 0 1 -17,-13 Z"
          strokeWidth={2.6}
        />
        {/* A second pass down one edge, the way a pen goes round twice */}
        <path d="M-22,-6 C-24,0 -23,6 -20,10" strokeWidth={1.1} opacity={0.45} />

        {/* Ear cups */}
        <path d="M-26,-3 C-31,-2 -31,4 -26,5" strokeWidth={2.2} />
        <path d="M26,-3 C31,-2 31,4 26,5" strokeWidth={2.2} />

        {/* Lenses, deliberately mismatched */}
        <g transform={`scale(1 ${blink})`}>
          <circle cx={-8} cy={-1} r={6} strokeWidth={2.3} />
          <circle cx={9} cy={-1} r={4.4} strokeWidth={2.1} />
          <circle cx={-6.6} cy={-2.2} r={1.5} fill="currentColor" stroke="none" />
          <circle cx={10} cy={-2} r={1.2} fill="currentColor" stroke="none" />
        </g>

        {/* It talks for a living, so the mouth is a speaker */}
        <path d="M-7,8 H7" strokeWidth={1.8} opacity={0.85} />
        <path d="M-4.5,11.5 H4.5" strokeWidth={1.5} opacity={0.6} />

        {/* Antenna */}
        <path d="M1,-13 C0.5,-18 2,-21 3,-24" strokeWidth={2.1} />
        <circle cx={3.4} cy={-26} r={2.6} strokeWidth={2} />
      </g>
    </g>
  );
}
