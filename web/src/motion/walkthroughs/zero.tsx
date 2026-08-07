"use client";

import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "Down to zero" — one object, one transformation.
 *
 * A balance drops in, a single ripple says a call happened, and the tag walks
 * down to the baseline rewriting itself at each mark until it reads nothing.
 * The descent is the only long movement and it carries the number with it, so
 * nothing travels through empty space.
 *
 * The caption arc names the problem and closes on the outcome, never on the
 * chase — the same rule the template's instructions are written under.
 */
export type ZeroScript = {
  /** Five, from the opening balance down to nothing. */
  steps: string[];
  /** Named problem, method, outcome. */
  captions: [string, string, string];
};

export const ZERO_VIEW = { w: 240, h: 560 };

const X = 120;
const BASE_Y = 470;
const TICKS = [200, 275, 350, 425];
const TAG = { w: 56, h: 40 };

const DROP_TO = 120;
const LAND_Y = 452;

/* Beats, to the tenth. */

const CAP1 = seconds(0);
const DROP = seconds(0.3);
const OVERSHOOT = seconds(0.78);
const SETTLED = seconds(0.95);
const RIPPLE = seconds(0.95);
const CAP2 = seconds(2.2);
const FALL = seconds(2.5);
const FALL_END = seconds(5.3);
const LAND = seconds(5.3);
const LANDED = seconds(5.55);
const CAP3 = seconds(5.55);
const RESET = seconds(6.8);

export const ZERO_LENGTH = seconds(7.2);
/** Resting on the baseline at nothing, every mark lit. */
export const ZERO_STILL = seconds(6.0);

/** Ease-out cubic, which is what the descent is written against. */
const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** The frame at which the tag's centre crosses each mark, solved rather than polled. */
const CROSSINGS = TICKS.map((y) => {
  const p = (y - DROP_TO) / (LAND_Y - DROP_TO);
  return FALL + (1 - Math.pow(1 - p, 1 / 3)) * (FALL_END - FALL);
});

const numberText = "fill-current text-[13px] font-medium [font-family:var(--font-sans)]";
const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";

/** Rounded, because a sharp-cornered rectangle reads as a UI card, not paper. */
const TAG_PATH = box(-TAG.w / 2, -TAG.h / 2, TAG.w, TAG.h, 9);

export function Zero({ f, script }: { f: number; script: ZeroScript }) {
  const steps = script.steps.slice(0, 5);

  /* Caption: three of them, each 0.15s out and 0.15s in with a 3-unit drift. */
  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capSwap = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : CAP1;
  const capIn = interpolate(f, [capSwap, capSwap + seconds(0.3)], [0, 1]);
  const capOut = 1 - interpolate(f, [RESET, RESET + seconds(0.4)], [0, 1]);
  const capShow = Math.min(capIn, capOut);

  /* The tag: dropped in, held, walked down, landed, gone. */
  const arriving = interpolate(f, [DROP, OVERSHOOT], [0, 1]);
  const settling = interpolate(f, [OVERSHOOT, SETTLED], [0, 1]);

  const falling = out(interpolate(f, [FALL, FALL_END], [0, 1]));
  const landed = interpolate(f, [LAND, LANDED], [0, 1]);

  const y =
    f < DROP
      ? -40
      : f < OVERSHOOT
        ? -40 + out(arriving) * (DROP_TO + 6 + 40)
        : f < SETTLED
          ? DROP_TO + 6 - settling * 6
          : DROP_TO + falling * (LAND_Y - DROP_TO);

  // Idle sway while it waits, and a lean as it settles from the drop.
  const sway = f >= SETTLED && f < FALL ? Math.sin((f - SETTLED) / 11.5) * 0.8 : 0;
  const tilt = f < OVERSHOOT ? -2 : f < SETTLED ? -2 + settling * 3 : 1 + sway;

  // Meets the baseline with a compress and release.
  const squash = landed > 0 && landed < 1 ? Math.sin(Math.PI * landed) : 0;

  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.4)], [0, 1]);
  const visible = f >= DROP ? gone : 0;

  /* The number rewrites as each mark is crossed, with a scale pop and no fade. */
  const passed = CROSSINGS.filter((at) => f >= at).length;
  const lastCrossed = CROSSINGS[passed - 1];
  const pop =
    lastCrossed !== undefined && f - lastCrossed < seconds(0.12)
      ? Math.sin(Math.PI * ((f - lastCrossed) / seconds(0.12))) * 0.06
      : 0;

  /* The baseline firms up as it takes the weight. */
  const base = interpolate(f, [LAND, LANDED], [0, 1]) * gone;
  const tick = interpolate(f, [LANDED, LANDED + seconds(0.3)], [0, 1]) * gone;

  return (
    <g>
      {/* Standing set: the baseline and the four marks, present throughout */}
      <path
        d={`M40,${BASE_Y} L200,${BASE_Y}`}
        stroke="currentColor"
        strokeWidth={1.2 + base * 1.4}
        strokeLinecap="round"
        opacity={0.25 + base * 0.65}
      />

      {TICKS.map((ty, i) => (
        <path
          key={ty}
          d={`M${X - 4},${ty} L${X + 4},${ty}`}
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          // Lit as it is passed, and stays lit — the panel keeps the record.
          opacity={(i < passed ? 0.3 : 0.12) * gone}
        />
      ))}

      {/* One ripple, the whole "a call happened" beat */}
      {[0, 1].map((i) => {
        const t = interpolate(f, [RIPPLE + i * seconds(0.12), RIPPLE + seconds(0.9)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={X - TAG.w / 2}
            cy={DROP_TO}
            r={6 + t * 34}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            opacity={0.4 * (1 - t)}
          />
        );
      })}

      {/* The tag */}
      <g
        opacity={visible}
        transform={`translate(${X} ${y}) rotate(${tilt}) scale(${1 + squash * 0.05} ${1 - squash * 0.1})`}
      >
        <path d={TAG_PATH} fill="none" stroke="currentColor" strokeWidth={2} />
        <g transform={`scale(${1 + pop})`}>
          <text x={0} y={4.5} textAnchor="middle" className={numberText}>
            {steps[Math.min(passed, steps.length - 1)] ?? ""}
          </text>
        </g>
      </g>

      {/* Drawn in once it is down */}
      {tick > 0 ? (
        <path
          d={`M164,${BASE_Y - 16} l5,6 l11,-12`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - tick}
          opacity={gone}
        />
      ) : null}

      {/* Named problem, then method, then outcome */}
      <text
        x={X}
        y={78}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>
    </g>
  );
}
