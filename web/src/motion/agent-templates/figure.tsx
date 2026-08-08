"use client";

/**
 * The person, drawn properly.
 *
 * Every scene used to sketch its own character inline, which is why they came
 * out naive and no two matched. This is one figure with a real construction —
 * jaw, brow, ear, neck, shoulder line — drawn once at a canonical size and
 * scaled, so the pen weight stays even and the proportions never drift.
 *
 * Origin is the centre of the head, not the feet: everything a scene wants to
 * aim at (eyeline, mouth, the hand) is measured from the face.
 */

type Hair = "braid" | "crop" | "bun";

const HEAD =
  "M-16,-6 C-16,-18.5 -9,-24.5 0,-24.5 C9,-24.5 16,-18.5 16,-6 C16,4.5 10,16.5 0,16.5 C-10,16.5 -16,4.5 -16,-6";

/** Drawn as a cap that sits on the skull, never as an outline round it. */
const HAIR: Record<Hair, string[]> = {
  braid: [
    "M-16.5,-5 C-18.5,-18 -9.5,-26.5 0,-26.5 C10,-26.5 18.5,-18.5 16.8,-5 C15.2,-10.5 12,-14 6,-15.2 C-0.5,-16.5 -8.5,-14 -12.5,-9.8 C-14.2,-8 -15.6,-6.4 -16.5,-5 Z",
    // The braid, falling behind the shoulder.
    "M15,-8 C20,0 21,10 19,19 C18.2,22.5 17.6,25.5 18.4,28",
    "M17.6,20 C19.6,21 21,21.6 22.2,21.4",
  ],
  crop: [
    "M-16.2,-6 C-17.6,-19 -9,-26.5 0.5,-26.5 C10.5,-26.5 18,-19.5 16.6,-6 C15.6,-11.5 13.4,-15 9.5,-16.4 C6.5,-13.4 -3,-11.6 -11.5,-13.6 C-13.8,-12 -15.4,-9.4 -16.2,-6 Z",
  ],
  bun: [
    "M-16.4,-5 C-18,-18 -9,-26 0,-26 C9.5,-26 18,-18 16.6,-5 C15,-11 11.5,-14.6 5.5,-15.6 C-1,-16.8 -8.5,-14 -12.5,-10 C-14.2,-8.2 -15.6,-6.4 -16.4,-5 Z",
    "M-2,-25.5 C-2,-32 3,-35.5 8,-33.5 C12.5,-31.6 12.5,-25.5 8,-23.6",
  ],
};

const EARS = ["M16,-6 C20.5,-7 21,1 16,1.6", "M-16,-6 C-20.5,-7 -21,1 -16,1.6"];

const NECK = "M-5.5,15 C-5.8,19 -6,21 -6.5,23  M5.5,15 C5.8,19 6,21 6.5,23";

/** One line from cuff to cuff — a body reads as a shoulder line, not a box. */
const SHOULDERS = "M-30,44 C-29,29.5 -16,23 0,23 C16,23 29,29.5 30,44";
const COLLAR = "M-7.5,23.5 C-4,28 -2,30.5 0,31.5 C2,30.5 4,28 7.5,23.5";

export function Figure({
  x,
  y,
  size = 1,
  hair = "braid",
  /** Degrees of head turn, toward whatever it is attending to. */
  look = 0,
  /** 1 open, 0 shut. */
  blink = 1,
  /** 0 closed, 1 mid-syllable. */
  talk = 0,
  /** 0 level, 1 pleased. */
  smile = 0,
  /** Degrees of lean at the waist, positive toward the work. */
  lean = 0,
  /** Reaching for something, in the figure's own coordinates. */
  hand,
  headset = true,
}: {
  x: number;
  y: number;
  size?: number;
  hair?: Hair;
  look?: number;
  blink?: number;
  talk?: number;
  smile?: number;
  lean?: number;
  hand?: { x: number; y: number };
  headset?: boolean;
}) {
  // A mouth that only ever opens looks like a gasp, so the corners lift with it.
  const lip = 8.5 + smile * 1.5;
  const open = talk * 3.6;
  const corner = smile * 2.6;
  const mouth = open
    ? `M-4.6,${lip} C-3,${lip - corner - open * 0.4} 3,${lip - corner - open * 0.4} 4.6,${lip}
       C3,${lip + open} -3,${lip + open} -4.6,${lip}`
    : `M-4.6,${lip - corner * 0.4} C-2.5,${lip + 1.6 - corner} 2.5,${lip + 1.6 - corner} 4.6,${lip - corner * 0.4}`;

  return (
    <g
      transform={`translate(${x} ${y}) scale(${size})`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Body first, so the jaw sits over the collar the way a pen would go */}
      <g transform={`rotate(${lean} 0 44)`}>
        <path d={SHOULDERS} strokeWidth={2.5} />
        <path d={COLLAR} strokeWidth={1.9} opacity={0.85} />
        <path d={NECK} strokeWidth={2.2} />

        {hand ? (
          <>
            <path
              d={`M22,32 C${22 + (hand.x - 22) * 0.35},${32 + (hand.y - 32) * 0.15}
                  ${22 + (hand.x - 22) * 0.7},${32 + (hand.y - 32) * 0.55} ${hand.x},${hand.y}`}
              strokeWidth={2.3}
            />
            <circle cx={hand.x} cy={hand.y} r={2.6} strokeWidth={2} />
          </>
        ) : null}
      </g>

      <g transform={`rotate(${look} 0 16)`}>
        <path d={EARS[0]} strokeWidth={2} />
        <path d={EARS[1]} strokeWidth={2} />

        <path d={HEAD} strokeWidth={2.6} />
        {/* A second pass down the jaw, the way a pen goes round twice */}
        <path d="M-14.5,2 C-13,8.5 -8,14 -2,15.8" strokeWidth={1} opacity={0.4} />

        {HAIR[hair].map((d, i) => (
          <path
            key={d}
            d={d}
            strokeWidth={i === 0 ? 2.4 : 2}
            fill={i === 0 ? "currentColor" : "none"}
            fillOpacity={i === 0 ? 0.1 : 0}
          />
        ))}

        <path d="M-10.5,-9.5 C-8.5,-11.5 -5.5,-11.5 -3.5,-10.2" strokeWidth={1.7} opacity={0.75} />
        <path d="M3.5,-10.2 C5.5,-11.5 8.5,-11.5 10.5,-9.5" strokeWidth={1.7} opacity={0.75} />

        <g transform={`translate(0 -4) scale(1 ${Math.max(0.08, blink)}) translate(0 4)`}>
          <path d="M-9.6,-4 C-8,-6.4 -5.2,-6.4 -3.6,-4" strokeWidth={2.1} />
          <path d="M3.6,-4 C5.2,-6.4 8,-6.4 9.6,-4" strokeWidth={2.1} />
          <circle cx={-6.6} cy={-3.6} r={1.5} fill="currentColor" stroke="none" />
          <circle cx={6.6} cy={-3.6} r={1.5} fill="currentColor" stroke="none" />
        </g>

        <path d="M0.4,-2 C2,1.5 2.6,3.4 0.2,4.4" strokeWidth={1.7} opacity={0.8} />

        <path d={mouth} strokeWidth={2.1} />

        {headset ? (
          <>
            <path d="M-17.5,-9 C-18.5,-23 -8,-30 0,-30 C8.5,-30 19,-23 17.5,-9" strokeWidth={2.3} />
            <path
              d="M-17.5,-8.5 C-22,-8 -22.5,0.5 -18,1.5 C-16.6,1.8 -16.2,1 -16.4,-0.5 L-16,-7 Z"
              strokeWidth={2.1}
              fill="currentColor"
              fillOpacity={0.09}
            />
            <path
              d="M17.5,-8.5 C22,-8 22.5,0.5 18,1.5 C16.6,1.8 16.2,1 16.4,-0.5 L16,-7 Z"
              strokeWidth={2.1}
              fill="currentColor"
              fillOpacity={0.09}
            />
            {/* The boom, stopping short of the mouth so it never crosses the lip */}
            <path d="M-19.5,1.5 C-19.5,7.5 -16,11.5 -10.5,12.5" strokeWidth={1.9} />
            <circle cx={-9} cy={12.7} r={1.9} strokeWidth={1.7} />
          </>
        ) : null}
      </g>
    </g>
  );
}

/** Blink on a rhythm that is not quite regular, so it reads as a person. */
export function blinkAt(f: number, period = 96) {
  const t = f % period;
  if (t > 5) return 1;
  return Math.abs(Math.cos((t / 5) * Math.PI));
}

/** Mouth movement while a line is being spoken, syllable-ish rather than even. */
export function talkAt(f: number, from: number, to: number) {
  if (f < from || f > to) return 0;
  return Math.max(0, Math.sin(f * 0.55) * 0.55 + Math.sin(f * 0.31) * 0.45);
}
