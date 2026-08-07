"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "Carried on" — a plan running out, and offered more.
 *
 * A thread comes down the panel to a knot: the date it lapses. Below it, two
 * frayed ends and nothing. The agent asks once, and then waits — that silence
 * is the longest beat in the loop on purpose, because the template's rule is to
 * ask once and never a second time. When the answer comes the thread carries on
 * past the knot to a new one.
 *
 * Nothing is asked twice here, and nothing is pushed.
 */
export type ThreadScript = {
  /** On the knot it was going to end at. */
  ends: string;
  /** What the agent asks, once. */
  ask: string;
  /** On the knot it ends at now. */
  extended: string;
  captions: [string, string, string];
};

export const THREAD_VIEW = { w: 240, h: 560 };

const X = 152;
const TOP = 96;
const KNOT = 330;
const NEW_KNOT = 470;

const FACE = { x: 54, y: 452, r: 28 };

/* Beats. */

const ASK = seconds(1.6);
const ASK_GONE = seconds(3.0);
/** The wait. Nothing happens here, and that is the point. */
const ANSWER = seconds(4.0);
const CARRY = seconds(4.3);
const CARRIED = seconds(5.8);
const CAP2 = seconds(1.6);
const CAP3 = seconds(5.8);
const RESET = seconds(7.4);

export const THREAD_LENGTH = seconds(8.0);
/** Carried on, with the new date written. */
export const THREAD_STILL = seconds(6.6);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const dateText = "fill-current text-[10px] [font-family:var(--font-sans)]";
const askText = "fill-current text-[10px] [font-family:var(--font-sans)]";

/** Rounded, with the tail rounded into it rather than a spike off the corner. */
function bubble(w: number, y: number) {
  return `${box(14, y, w, 26, 10)} M34,${y + 26} Q31,${y + 34} 40,${y + 33} Q44,${y + 30} 44,${y + 26}`;
}

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

export function Thread({ f, script }: { f: number; script: ThreadScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  const carried = out(interpolate(f, [CARRY, CARRIED], [0, 1]));
  const answered = interpolate(f, [ANSWER, ANSWER + seconds(0.4)], [0, 1]);

  const sway = Math.sin(f / 30);
  // The frayed ends stir until there is something to carry on to.
  const loose = (1 - carried) * gone;

  const askShow = Math.min(
    interpolate(f, [ASK, ASK + seconds(0.3)], [0, 1]),
    1 - interpolate(f, [ASK_GONE, ASK_GONE + seconds(0.3)], [0, 1]),
  );

  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capAt = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);
  const nod = Math.sin(Math.PI * interpolate(f, [ANSWER, ANSWER + seconds(0.5)], [0, 1])) * 2;

  // She waits with it, then looks down the new stretch as it goes.
  const look = -3 + carried * 6;

  return (
    <g>
      {/* Caption */}
      <text
        x={120}
        y={64}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* The run so far: there from the first frame, because it already happened */}
      <path
        d={`M${X},${TOP} C${X - 6},${(TOP + KNOT) / 2} ${X + 6},${(TOP + KNOT) / 2 + 30} ${X},${KNOT}`}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        opacity={0.7 * gone}
      />

      {/* Where it was going to stop */}
      <g opacity={gone}>
        <circle cx={X} cy={KNOT} r={4.5} fill="none" stroke="currentColor" strokeWidth={2.2} />
        <text x={X - 16} y={KNOT + 3.5} textAnchor="end" className={dateText} opacity={0.55}>
          {script.ends}
        </text>
      </g>

      {/* Frayed ends, stirring, until there is more thread */}
      <g opacity={loose * 0.5}>
        <S
          d={`M${X},${KNOT + 5} C${X - 4 + sway * 3},${KNOT + 18} ${X - 9},${KNOT + 26} ${X - 12 + sway * 4},${KNOT + 36}`}
          w={1.6}
        />
        <S
          d={`M${X},${KNOT + 5} C${X + 5 - sway * 2},${KNOT + 16} ${X + 9},${KNOT + 24} ${X + 11 - sway * 3},${KNOT + 33}`}
          w={1.4}
        />
      </g>

      {/* Carried on, drawn from the old knot to the new */}
      {carried > 0 ? (
        <>
          <path
            d={`M${X},${KNOT} C${X + 7},${KNOT + 46} ${X - 7},${NEW_KNOT - 46} ${X},${NEW_KNOT}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - carried}
            opacity={0.7 * gone}
          />

          {carried > 0.94 ? (
            <g opacity={interpolate(carried, [0.94, 1], [0, 1]) * gone}>
              <circle
                cx={X}
                cy={NEW_KNOT}
                r={4.5}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
              />
              <text x={X + 16} y={NEW_KNOT + 3.5} className={dateText} opacity={0.75}>
                {script.extended}
              </text>
            </g>
          ) : null}
        </>
      ) : null}

      {/* Asked once, and then not again */}
      {askShow > 0 ? (
        <g opacity={askShow} transform={`translate(0 ${(1 - askShow) * 4})`}>
          <path
            d={bubble(Math.min(212, 20 + script.ask.length * 6.2), 394)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <text x={22} y={411} className={askText}>
            {script.ask}
          </text>
        </g>
      ) : null}

      {/* One ripple, once — there is no second ask in this template */}
      {[0, 1].map((i) => {
        const t = interpolate(f, [ASK + i * seconds(0.14), ASK + seconds(0.9)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={FACE.x + FACE.r - 2}
            cy={FACE.y - 10}
            r={8 + t * 38}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            opacity={0.32 * (1 - t) * gone}
          />
        );
      })}

      {/* The answer, when it comes */}
      {answered > 0 ? (
        <path
          d={`M${X + 20},${KNOT - 26} l5,6 l11,-12`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - answered}
          opacity={gone}
        />
      ) : null}

      {/* Ananya, waiting with it */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        <S d="M28,486 Q54,492 80,486" />
        <S d="M28,486 L26,514" />
        <S d="M80,486 L82,514" />

        {/* A hand toward the thread, open rather than reaching */}
        <S d="M76,490 C90,489 100,486 108,482" w={2.5} />

        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={look} />
      </g>
    </g>
  );
}
