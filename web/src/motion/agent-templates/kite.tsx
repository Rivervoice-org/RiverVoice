"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "The kite" — three questions, and each answer lifts it.
 *
 * Kabir holds the string from the bottom-left. The kite starts just above his
 * hand and climbs a stage per answer, wobbling as it catches each time. At full
 * height the wobble stops and the string pulls taut, and that steadiness is the
 * whole verdict: this one is worth calling back. Nothing says so.
 *
 * The face is drawn rather than embedded: every way of getting the roster
 * avatar inside an inline svg failed silently, and the card beside the panel
 * already shows it.
 */
export type KiteScript = {
  /**
   * A data URI of the template's own face. Already circular — the mascots are
   * drawn with a full radius — so it needs no clip, which is what silently
   * hid it the first time round.
   */
  /** Exactly three, asked one at a time. */
  questions: [string, string, string];
  /** Settles onto the tail once it is holding. */
  tag: string;
  captions: [string, string, string];
};

export const KITE_VIEW = { w: 240, h: 560 };

const GROUND = 506;
const FACE = { x: 56, y: 450, r: 28 };
const ELBOW = { x: 98, y: 460 };
const HAND = { x: 110, y: 420 };

/** Just above his hand, then a stage per answer, most of the panel's height. */
const HEIGHTS = [470, 360, 250, 110];
const KITE_X = 150;

/* Beats. */

const LIFTS = [seconds(0.5), seconds(2.0), seconds(3.5)];
const CLIMB = seconds(1.2);
const TAG = seconds(5.0);
const BIRDS = seconds(5.4);
const NOD = seconds(5.6);
const HOLD = seconds(5.6);
const LOWER = seconds(6.8);

export const KITE_LENGTH = seconds(7.5);
/** Steady at full height with the tag on the tail. */
export const KITE_STILL = seconds(6.2);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const askText = "fill-current text-[10px] [font-family:var(--font-sans)]";
const tagText = "fill-current text-[8px] font-medium [font-family:var(--font-sans)]";

/** Rounded, with the tail rounded into it rather than a spike off the corner. */
function bubble(w: number, y: number) {
  return `${box(14, y, w, 26, 10)} M34,${y + 26} Q31,${y + 34} 40,${y + 33} Q44,${y + 30} 44,${y + 26}`;
}

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

export function Kite({ f, script }: { f: number; script: KiteScript }) {
  const gone = 1 - interpolate(f, [LOWER, KITE_LENGTH], [0, 1]);

  /* How high: one stage per answer, and back down at the end. */
  const stage = LIFTS.filter((at) => f >= at).length;
  const climbing =
    stage > 0 ? out(interpolate(f, [LIFTS[stage - 1], LIFTS[stage - 1] + CLIMB], [0, 1])) : 0;
  const lowering = out(interpolate(f, [LOWER, KITE_LENGTH], [0, 1]));

  const from = HEIGHTS[Math.max(0, stage - 1)];
  const to = HEIGHTS[stage];
  const flying = from + (to - from) * climbing;
  const y = flying + (HEIGHTS[0] - flying) * lowering;

  const x = KITE_X + (1 - lowering) * interpolate(f, [LIFTS[0], LIFTS[0] + CLIMB], [0, 10]);

  /** Nothing to full height, which everything that tracks the kite runs off. */
  const height = (HEIGHTS[0] - y) / (HEIGHTS[0] - HEIGHTS[3]);

  /* Wobble as it catches, and none at full height — the tell that it is holding. */
  const caught = stage > 0 ? 1 - Math.min(1, (f - LIFTS[stage - 1]) / CLIMB) : 0;
  const unsteady = stage >= 3 ? 0 : caught;
  const wobble = Math.sin(f * 0.9) * 7 * unsteady;

  const sway = f >= HOLD ? Math.sin((f - HOLD) / 15) * 3 : 0;
  const tilt = (stage === 2 ? 6 * (1 - climbing * 0.4) : 0) + wobble + sway;
  const flick = stage === 2 ? Math.sin((f - LIFTS[1]) * 1.1) * 10 * caught : 0;

  /* He tracks it: the forearm swings up, and he looks up with it. */
  const forearm = -15 + height * 27;
  const look = -2 - height * 7;
  // A nod at the payoff, since an imported face cannot blink.
  const nod = Math.sin(Math.PI * interpolate(f, [NOD, NOD + seconds(0.4)], [0, 1])) * 2;

  /* String: sagging when low, taut at the top, which is what sells it. */
  const tailY = y + 20;
  const sag = 34 * (1 - height);
  const mid = { x: (HAND.x + x) / 2 - sag * 0.35, y: (HAND.y + tailY) / 2 + sag };

  /* Captions, and the question being asked. */
  const capIndex = f >= TAG ? 2 : f >= LIFTS[1] ? 1 : 0;
  const capAt = f >= TAG ? TAG : f >= LIFTS[1] ? LIFTS[1] : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const asking = LIFTS.findIndex((at) => f >= at && f < at + seconds(1.3));
  const askShow =
    asking >= 0
      ? Math.min(
          interpolate(f, [LIFTS[asking], LIFTS[asking] + seconds(0.25)], [0, 1]),
          1 - interpolate(f, [LIFTS[asking] + seconds(1.05), LIFTS[asking] + seconds(1.3)], [0, 1]),
        )
      : 0;

  const tagOn = interpolate(f, [TAG, TAG + seconds(0.6)], [0, 1]) * gone;
  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);

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

      {/* Two birds, once it is holding, so they read as reward not clutter */}
      {[
        { x: 196, y: 150, at: BIRDS },
        { x: 214, y: 132, at: BIRDS + seconds(0.25) },
      ].map((bird) => {
        const t = interpolate(f, [bird.at, bird.at + seconds(2.0)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <path
            key={bird.x}
            d="M-7,3 Q-3.5,-3.5 0,0 Q3.5,-3.5 7,3"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={Math.min(1, t * 5, (1 - t) * 5) * 0.3 * gone}
            transform={`translate(${bird.x - t * 120} ${bird.y + Math.sin(t * 7) * 5})`}
          />
        );
      })}

      {/* Ground */}
      <path
        d={`M0,${GROUND} L240,${GROUND}`}
        stroke="currentColor"
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.22 * gone}
      />

      {/* String, before the kite so the kite sits over the knot */}
      <path
        d={`M${HAND.x},${HAND.y} Q${mid.x},${mid.y} ${x},${tailY}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.1}
        opacity={(0.35 + height * 0.3) * gone}
      />

      {/* The kite: a diamond with a spar each way, and a short tail */}
      <g opacity={gone} transform={`translate(${x} ${y}) rotate(${tilt})`}>
        <S d="M0,-20 L17,0 L0,20 L-17,0 Z" w={2.2} />
        <S d="M0,-20 L0,20" w={1} o={0.4} />
        <S d="M-17,0 L17,0" w={1} o={0.4} />

        <g transform={`translate(0 20) rotate(${flick + wobble * 0.5})`}>
          <S d="M0,0 Q5,9 0,17 Q-5,25 0,33" w={1.4} o={0.7} />
          <S d="M-4,10 L4,7" w={1.4} o={0.5} />
          <S d="M-4,26 L4,23" w={1.4} o={0.5} />

          {tagOn > 0 ? (
            <g opacity={tagOn} transform={`translate(0 ${34 - (1 - tagOn) * 6})`}>
              <path
                d={box(-24, 0, 48, 16, 6)}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              />
              <text x={0} y={10.5} textAnchor="middle" className={tagText}>
                {script.tag}
              </text>
            </g>
          ) : null}
        </g>
      </g>

      {/* Kabir: the roster badge, and a body drawn under it */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        {/* Shoulders and sides, down to the ground */}
        <S d={`M28,484 Q56,490 84,484`} />
        <S d={`M28,484 L26,${GROUND}`} />
        <S d={`M84,484 L86,${GROUND}`} />

        {/* Upper arm out to the elbow, then a forearm that swings with the kite */}
        <S d={`M80,486 L${ELBOW.x},${ELBOW.y}`} />
        <g transform={`rotate(${forearm} ${ELBOW.x} ${ELBOW.y})`}>
          <S d={`M${ELBOW.x},${ELBOW.y} L${HAND.x},${HAND.y}`} />
          <circle
            cx={HAND.x}
            cy={HAND.y}
            r={3}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
          />
        </g>

        {/* The face, looking up at it as it climbs */}
        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={look} />
      </g>

      {/* One question at a time, over his shoulder */}
      {askShow > 0 && asking >= 0 ? (
        <g opacity={askShow} transform={`translate(0 ${(1 - askShow) * 4})`}>
          <path
            d={bubble(Math.min(212, 20 + script.questions[asking].length * 5.4), 392)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <text x={24} y={409} className={askText}>
            {script.questions[asking]}
          </text>
        </g>
      ) : null}
    </g>
  );
}
