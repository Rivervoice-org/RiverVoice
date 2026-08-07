"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "On its way" — a parcel, walked down to the door.
 *
 * The agent is asked where something is, looks it up, and the parcel comes down
 * a route past three stops, rewriting what it says at each one. It lands on the
 * step and the day is written beside it.
 *
 * The stops stay lit once passed, so by the end the panel holds the whole
 * answer at once — which is what reading a status back actually is.
 */
export type ParcelScript = {
  /** Where it is, rewritten as each stop is passed. The last is the doorstep. */
  stops: [string, string, string, string];
  /** When it lands. */
  tag: string;
  captions: [string, string, string];
};

export const PARCEL_VIEW = { w: 240, h: 560 };

const ROUTE_X = 154;
const START_Y = 120;
const STEP_Y = 452;
const DOOR = 470;
const STOPS = [212, 288, 364];

const FACE = { x: 56, y: 452, r: 28 };

/* Beats. */

const DROP = seconds(0.5);
const OVERSHOOT = seconds(0.95);
const SETTLED = seconds(1.15);
const LOOKUP = seconds(1.5);
const CAP2 = seconds(2.2);
const FALL = seconds(2.5);
const FALL_END = seconds(5.3);
const LAND = seconds(5.3);
const LANDED = seconds(5.6);
const CAP3 = seconds(5.6);
const RESET = seconds(6.8);

export const PARCEL_LENGTH = seconds(7.5);
/** On the step, every stop lit, the day written. */
export const PARCEL_STILL = seconds(6.2);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The frame the parcel's centre meets each stop, solved rather than polled. */
const CROSSINGS = STOPS.map((y) => {
  const p = (y - START_Y) / (STEP_Y - START_Y);
  return FALL + (1 - Math.pow(1 - p, 1 / 3)) * (FALL_END - FALL);
});

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const stopText = "fill-current text-[10px] [font-family:var(--font-sans)]";
const tagText = "fill-current text-[11px] font-medium [font-family:var(--font-sans)]";

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

/** Rounded at the corners, with a band of tape each way. */
const BOX = [box(-19, -15, 38, 30, 6), "M-19,-2.4 L19.2,-3", "M0.4,-15 L0.8,14.4"].join(" ");

export function Parcel({ f, script }: { f: number; script: ParcelScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.5)], [0, 1]);

  /* The parcel: dropped in, held while it is looked up, then walked down. */
  const arriving = interpolate(f, [DROP, OVERSHOOT], [0, 1]);
  const settling = interpolate(f, [OVERSHOOT, SETTLED], [0, 1]);
  const falling = out(interpolate(f, [FALL, FALL_END], [0, 1]));
  const landed = interpolate(f, [LAND, LANDED], [0, 1]);

  const y =
    f < DROP
      ? -40
      : f < OVERSHOOT
        ? -40 + out(arriving) * (START_Y + 7 + 40)
        : f < SETTLED
          ? START_Y + 7 - settling * 7
          : START_Y + falling * (STEP_Y - START_Y);

  const idle = f >= SETTLED && f < FALL ? Math.sin((f - SETTLED) / 12) * 0.9 : 0;
  const tilt = f < OVERSHOOT ? -2.5 : f < SETTLED ? -2.5 + settling * 3.5 : 1 + idle;

  // Meets the step with a compress and release.
  const squash = landed > 0 && landed < 1 ? Math.sin(Math.PI * landed) : 0;
  const visible = f >= DROP ? gone : 0;

  /* What it says now, rewritten as each stop is passed. */
  const passed = CROSSINGS.filter((at) => f >= at).length;
  const said = Math.min(passed, script.stops.length - 1);
  const lastCrossed = CROSSINGS[passed - 1];
  const pop =
    lastCrossed !== undefined && f - lastCrossed < seconds(0.12)
      ? Math.sin(Math.PI * ((f - lastCrossed) / seconds(0.12))) * 0.06
      : 0;

  /* Captions, and the lookup that answers the question. */
  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capAt = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const step = interpolate(f, [LAND, LANDED], [0, 1]) * gone;
  const tagOn = interpolate(f, [LANDED, LANDED + seconds(0.4)], [0, 1]) * gone;
  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);

  // He watches it come down, and nods once when it lands.
  const track = (y - START_Y) / (STEP_Y - START_Y);
  const look = -7 + track * 9;
  const nod = Math.sin(Math.PI * interpolate(f, [LANDED, LANDED + seconds(0.4)], [0, 1])) * 2;

  return (
    <g>
      {/* Caption */}
      <text
        x={120}
        y={70}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* The route, present the whole time — the journey is not a surprise */}
      <path
        d={`M${ROUTE_X},${START_Y} L${ROUTE_X},${DOOR}`}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeDasharray="1 7"
        strokeLinecap="round"
        opacity={0.22 * gone}
      />

      {STOPS.map((sy, i) => (
        <g key={sy} opacity={gone}>
          <circle
            cx={ROUTE_X}
            cy={sy}
            r={3.4}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            // Lit as it is passed, and stays lit, so the panel holds the answer
            opacity={i < passed ? 0.75 : 0.18}
          />
          <text
            x={ROUTE_X - 14}
            y={sy + 3.5}
            textAnchor="end"
            className={stopText}
            opacity={i < passed ? 0.55 : 0}
          >
            {script.stops[i]}
          </text>
        </g>
      ))}

      {/* The doorstep it lands on */}
      <path
        d={`M${ROUTE_X - 44},${DOOR} L${ROUTE_X + 44},${DOOR}`}
        stroke="currentColor"
        strokeWidth={1.2 + step * 1.4}
        strokeLinecap="round"
        opacity={(0.25 + step * 0.6) * gone}
      />

      {/* The parcel, saying where it is */}
      <g
        opacity={visible}
        transform={`translate(${ROUTE_X} ${y}) rotate(${tilt}) scale(${1 + squash * 0.06} ${1 - squash * 0.1})`}
      >
        <S d={BOX} w={2.2} />
        <g transform={`scale(${1 + pop})`}>
          <text x={0} y={30} textAnchor="middle" className={stopText} opacity={0.85}>
            {script.stops[said]}
          </text>
        </g>
      </g>

      {/* When it lands, written beside the step */}
      {tagOn > 0 ? (
        <text
          x={ROUTE_X}
          y={DOOR + 26}
          textAnchor="middle"
          className={tagText}
          opacity={tagOn}
          transform={`translate(0 ${(1 - tagOn) * 3})`}
        >
          {script.tag}
        </text>
      ) : null}

      {/* Dev, watching it down */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        <S d="M30,486 Q56,492 82,486" />
        <S d="M30,486 L28,514" />
        <S d="M82,486 L84,514" />

        {/* An arm out toward the route, following it down */}
        <g transform={`rotate(${-14 + track * 22} 78 488)`}>
          <S d="M78,488 C92,486 102,482 110,478" w={2.5} />
        </g>

        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={look} />
      </g>

      {/* The lookup: one ripple off him, once, before it starts moving */}
      {[0, 1].map((i) => {
        const t = interpolate(f, [LOOKUP + i * seconds(0.14), LOOKUP + seconds(0.9)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={FACE.x + FACE.r}
            cy={FACE.y - 8}
            r={8 + t * 40}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            opacity={0.35 * (1 - t) * gone}
          />
        );
      })}
    </g>
  );
}
