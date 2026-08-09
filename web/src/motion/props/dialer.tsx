"use client";

/**
 * The rotary phone.
 *
 * Outbound calling needs a mechanism you can watch, and a dial is the only
 * telephone part that visibly does work: it winds round to the stop and springs
 * back on its own, once per digit. A keypad would be nine squares lighting up.
 *
 * Drawn the way one actually is, because half-remembered rotary phones look
 * wrong in a way people notice without being able to say why:
 *
 *   · The handset lies across the top with its cups hanging down over the ends
 *     of the body. Cups drawn standing up read as ears and turn the whole thing
 *     into a beetle.
 *   · The dial is a good deal smaller than the face it sits on. Filled to the
 *     edges it stops being a dial and becomes the phone.
 *   · The numbers are printed on the fixed plate and the finger wheel turns over
 *     them. Numbering the holes is the usual mistake — it rides the digits round
 *     with the dial, which no phone has ever done.
 *   · 1 sits just anticlockwise of the finger stop and 0 furthest from it: the
 *     drag back to the stop is what times each pulse.
 *   · The stop is fixed to the body, not the wheel, or there is nothing for the
 *     wheel to stop against.
 *
 * Reusable the same way Rover is — a point, a size, and pose props. It has no
 * clock of its own. About 136 wide and 86 tall at size 1.
 */

type Props = {
  x: number;
  y: number;
  size?: number;
  /** Degrees the finger wheel has been wound. 0 is home; a digit is about 250. */
  spin?: number;
  /** 0 resting in the cradle, 1 lifted and in use. */
  lifted?: number;
  /**
   * Where the receiver goes when it is lifted, in this phone's own units, and
   * how far it turns. Whoever is holding it is drawn somewhere else entirely, so
   * the phone cannot work this out for itself — the scene passes the hand.
   */
  carry?: { dx: number; dy: number; angle: number };
  /** Sound coming off it, for the ringing beat. */
  ring?: number;
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Comfortably inside the face it sits on, which is what makes it read as a dial. */
const DIAL = { x: 0, y: 12, r: 30, holes: 21, numbers: 27.5, hub: 8.5 };

/** 1 nearest the stop, 0 furthest — the order the pulses depend on. */
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const AT = DIGITS.map((_, i) => ((-8 - i * 30) * Math.PI) / 180);

const on = (angle: number, radius: number) => ({
  x: DIAL.x + Math.cos(angle) * radius,
  y: DIAL.y + Math.sin(angle) * radius,
});

/** The handset turns about its middle; the cup that meets a head is the left. */
const PIVOT = { x: 0, y: -30 };
const CUP = { x: 50, y: -18 };

/** A cord reads as a cord because it is coiled, not because it curves. */
function coil(x1: number, y1: number, x2: number, y2: number, loops = 8) {
  let d = `M${x1},${y1}`;
  for (let i = 0; i < loops; i += 1) {
    const a = i / loops;
    const b = (i + 1) / loops;
    const ax = x1 + (x2 - x1) * a;
    const ay = y1 + (y2 - y1) * a;
    const bx = x1 + (x2 - x1) * b;
    const by = y1 + (y2 - y1) * b;
    d += ` C${ax + 10},${ay + 3} ${bx + 10},${by - 3} ${bx},${by}`;
  }
  return d;
}

export function Dialer({
  x,
  y,
  size = 1,
  spin = 0,
  lifted = 0,
  carry = { dx: -20, dy: -34, angle: -14 },
  ring = 0,
}: Props) {
  const held = { dx: lifted * carry.dx, dy: lifted * carry.dy, angle: lifted * carry.angle };

  /* Where the mouthpiece cup actually ended up, so the cord runs to it rather
     than being drawn inside the receiver — held to a head, a cord rotating with
     the handset would loop over the top of it. */
  const a = (held.angle * Math.PI) / 180;
  const rel = { x: CUP.x - PIVOT.x, y: CUP.y - PIVOT.y };
  const anchor = {
    x: held.dx + rel.x * Math.cos(a) - rel.y * Math.sin(a) + PIVOT.x,
    y: held.dy + rel.x * Math.sin(a) + rel.y * Math.cos(a) + PIVOT.y,
  };
  const reach = Math.hypot(anchor.x - 58, anchor.y - 24);

  return (
    <g transform={`translate(${x} ${y}) scale(${size})`} {...stroke}>
      {/* The body: low and wide, shouldered in at the top so the handset has
          somewhere to sit, and flared at the foot so it stands. */}
      <path
        d="M-58,-8 C-58,-18 -40,-24 0,-24 C40,-24 58,-18 58,-8 L62,30 C63,40 57,44 49,44 H-49 C-57,44 -63,40 -62,30 Z"
        strokeWidth={2.6}
        fill="currentColor"
        fillOpacity={0.03}
      />
      <path d="M-54,38 H54" strokeWidth={1.4} opacity={0.22} />

      {/* The saddles the cups drop into, uncovered once it is lifted */}
      <g opacity={0.25 + lifted * 0.5}>
        <path d="M-52,-12 C-46,-18 -34,-18 -30,-12" strokeWidth={1.9} />
        <path d="M30,-12 C34,-18 46,-18 52,-12" strokeWidth={1.9} />
      </g>

      {/* The fixed plate: the numbers live here, not on the wheel */}
      <circle cx={DIAL.x} cy={DIAL.y} r={DIAL.r} strokeWidth={2.3} />
      {AT.map((angle, i) => {
        const at = on(angle, DIAL.numbers);
        return (
          <text
            key={DIGITS[i]}
            x={at.x}
            y={at.y + 2.8}
            textAnchor="middle"
            className="fill-current text-[8px] [font-family:var(--font-sans)]"
            opacity={0.45}
          >
            {DIGITS[i]}
          </text>
        );
      })}

      {/* The finger wheel. Only this turns. */}
      <g transform={`rotate(${spin} ${DIAL.x} ${DIAL.y})`}>
        {AT.map((angle, i) => {
          const at = on(angle, DIAL.holes);
          return <circle key={DIGITS[i]} cx={at.x} cy={at.y} r={4.4} strokeWidth={1.7} />;
        })}
        {[0, 120, 240].map((deg) => {
          const at = on((deg * Math.PI) / 180, DIAL.hub + 5);
          return (
            <path
              key={deg}
              d={`M${DIAL.x},${DIAL.y} L${at.x},${at.y}`}
              strokeWidth={1.3}
              opacity={0.22}
            />
          );
        })}
      </g>

      <circle
        cx={DIAL.x}
        cy={DIAL.y}
        r={DIAL.hub}
        strokeWidth={1.9}
        fill="currentColor"
        fillOpacity={0.05}
      />

      {/* The finger stop, fixed to the body at four o'clock */}
      <path
        d="M22,36 C29,33 34,28 36,22 L44,25 C41,34 34,40 25,43 Z"
        strokeWidth={1.9}
        opacity={0.65}
      />

      {/* The cord, drawn to wherever the receiver got to, with more coils the
          further it has to reach rather than a longer line between two curls. */}
      <path
        d={coil(58, 24, anchor.x, anchor.y, Math.max(5, Math.round(reach / 14)))}
        strokeWidth={1.6}
        opacity={0.45}
      />

      {/* The receiver: two flared cups hanging off a bowed handle, drawn as one
          silhouette so it reads at a glance rather than as three parts. */}
      <g transform={`translate(${held.dx} ${held.dy}) rotate(${held.angle} ${PIVOT.x} ${PIVOT.y})`}>
        <path
          d="M-60,-20 C-63,-32 -46,-38 -41,-30 C-24,-40 24,-40 41,-30 C46,-38 63,-32 60,-20 C58,-11 44,-9 41,-17 C39,-24 37,-25 32,-22 C16,-31 -16,-31 -32,-22 C-37,-25 -39,-24 -41,-17 C-44,-9 -58,-11 -60,-20 Z"
          strokeWidth={2.4}
          fill="currentColor"
          fillOpacity={0.05}
        />
        {/* The grilles, which are what say which end you talk into */}
        <path d="M-54,-22 h9 M-53,-18 h7" strokeWidth={1.3} opacity={0.4} />
        <path d="M45,-22 h9 M46,-18 h7" strokeWidth={1.3} opacity={0.4} />
      </g>

      {/* Ringing away down the line, so the arcs open outward rather than at
          whoever is holding it. A phone drawn ringing *at* you is an incoming
          call, which is the opposite of what this is for. */}
      {ring > 0
        ? [0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M${-70 - i * 10},${-4 - i * 5} C${-82 - i * 11},8 ${-82 - i * 11},18 ${-70 - i * 10},${30 + i * 5}`}
              strokeWidth={1.7}
              opacity={ring * (0.5 - i * 0.14)}
            />
          ))
        : null}
    </g>
  );
}
