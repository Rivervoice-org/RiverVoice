"use client";

import * as React from "react";

import { Sketch, type Shape } from "@/motion/sketch";
import { ease, interpolate, seconds } from "@/motion/timeline";

/**
 * The agent fishing for the right time.
 *
 * It sits on a jetty with a line in the water. Something bites; it pulls a slot
 * out, looks at it, and throws it back. The next one is right: into the basket,
 * tick. Finding a time that suits, drawn as what it feels like.
 *
 * The scene knows nothing about calendars — it fishes up whatever labels the
 * script gives it, so a qualification template fishes "Cold" and "Hot" from the
 * same water.
 */
export type FisherScript = {
  /** Comes up first, and goes back in. */
  reject: string;
  /** The keeper. */
  accept: string;
};

export const FISHER_VIEW = { w: 240, h: 560 };

/* The character is drawn the way the product's mascots are drawn — authored
   paths with deliberate irregularity and varied stroke weight — not rough.js,
   whose uniform jitter reads as scribble at this size. Rough is kept for the
   water, where sameness is the point. */

const HIP = { x: 78, y: 352 };
const SHOULDER = { x: 14, y: -24 };
const WATER = 382;
const BOBBER_X = 178;
const BASKET = { x: 28, y: 332, w: 34, h: 24 };

const WAVES: Shape[] = [
  { kind: "svg", d: "M-40,398 Q0,392 40,398 T120,398 T200,398 T280,398" },
  { kind: "svg", d: "M-40,424 Q0,419 40,424 T120,424 T200,424 T280,424" },
  { kind: "svg", d: "M-40,456 Q0,450 40,456 T120,456 T200,456 T280,456" },
  { kind: "svg", d: "M-40,492 Q0,487 40,492 T120,492 T200,492 T280,492" },
];

/* Beats. */

const TUG1 = seconds(2.6);
const PULL1 = seconds(3.2);
const DANGLE1 = seconds(4.0);
const SHAKE = seconds(4.9);
const TOSS = seconds(5.7);
const SPLASH = seconds(6.45);
const BACK1 = seconds(7.3);
const TUG2 = seconds(8.7);
const PULL2 = seconds(9.3);
const DANGLE2 = seconds(10.1);
const NOD = seconds(10.4);
const SWING = seconds(11.3);
const DROP = seconds(12.15);
const CHECK = seconds(12.45);
const FADE = seconds(14.2);

export const FISHER_LENGTH = seconds(15);
/** The keeper in the basket and the tick drawn. */
export const FISHER_STILL = seconds(13.2);

const tagText =
  "fill-current text-[10px] font-medium tracking-[0.02em] [font-family:var(--font-sans)]";

type P = { x: number; y: number };

const rot = (v: P, deg: number): P => {
  const a = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};

const add = (a: P, b: P): P => ({ x: a.x + b.x, y: a.y + b.y });

/** Flight of a caught tag: a straight lerp lifted on a sine. */
const arc = (t: number, from: P, to: P, lift: number): P => ({
  x: from.x + (to.x - from.x) * t,
  y: from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * lift,
});

/** A window eased in and out, for gestures that must leave no trace. */
const pulse = (f: number, at: number, length: number) => {
  const t = (f - at) / length;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
};

/** A rounded rect with baked-in wobble, so it is hand-drawn but not scribbled. */
function tagBox(w: number, h: number) {
  const r = 7;
  return [
    `M${r},0.5 L${w - r},-0.3`,
    `Q${w + 0.6},0.2 ${w + 0.2},${r}`,
    `L${w - 0.3},${h - r}`,
    `Q${w - 0.1},${h + 0.5} ${w - r},${h + 0.2}`,
    `L${r},${h - 0.2}`,
    `Q-0.6,${h + 0.1} 0.2,${h - r}`,
    `L-0.3,${r}`,
    `Q-0.4,-0.5 ${r},0.5 Z`,
  ].join(" ");
}

function Tag({ label, sway = 0 }: { label: string; sway?: number }) {
  const w = Math.max(36, label.length * 6.6 + 15);
  return (
    <g transform={`translate(${-w / 2} -10) rotate(${sway})`}>
      <path d={tagBox(w, 20)} fill="none" stroke="currentColor" strokeWidth={2.1} />
      {/* The hole the line goes through */}
      <circle cx={w / 2} cy={-0.4} r={1.6} fill="none" stroke="currentColor" strokeWidth={1.2} />
      <text x={w / 2} y={14} textAnchor="middle" className={tagText}>
        {label}
      </text>
    </g>
  );
}

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

function Ripple({ at, r, o }: { at: P; r: number; o: number }) {
  if (o <= 0) return null;
  return (
    <ellipse
      cx={at.x}
      cy={at.y}
      rx={r}
      ry={r * 0.3}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      opacity={o}
    />
  );
}

/** Three droplets fanning from a point, for the moment something breaks water. */
function Droplets({ f, at, when }: { f: number; at: P; when: number }) {
  const t = interpolate(f, [when, when + seconds(0.5)], [0, 1]);
  if (t <= 0 || t >= 1) return null;

  return (
    <g opacity={1 - t}>
      {[-1, 0, 1].map((side) => (
        <path
          key={side}
          d="M0,0 l0,-5"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          transform={`translate(${at.x + side * 14 * t} ${at.y - 26 * t + 18 * t * t}) rotate(${side * 24})`}
        />
      ))}
    </g>
  );
}

/** Glides in under the surface just before each bite, so the tug has a cause. */
function FishShadow({
  f,
  from,
  to,
  at,
  y,
}: {
  f: number;
  from: number;
  to: number;
  at: [number, number];
  y: number;
}) {
  const t = interpolate(f, at, [0, 1]);
  if (t <= 0 || t >= 1) return null;

  const x = from + (to - from) * t;
  const fade = Math.min(1, t * 5, (1 - t) * 5);
  const flip = to < from ? -1 : 1;

  return (
    <g
      opacity={fade * 0.2}
      transform={`translate(${x} ${y + Math.sin(t * 9) * 1.5}) scale(${flip} 1)`}
    >
      <path d="M0,0 Q5,-3.5 11,-1.2 Q14,0.4 11,1.8 Q5,3.6 0,0 Z" fill="currentColor" />
      <path d="M0,0 L-4,-2.6 M0,0 L-4,2.6" stroke="currentColor" strokeWidth={1.1} fill="none" />
    </g>
  );
}

export function Fisher({ f, script }: { f: number; script: FisherScript }) {
  /* One continuous pose, never snapped: how far the arm is raised, how far the
     body leans with it, and the small gestures layered on top. */

  const armUp =
    f < PULL1
      ? 0
      : f < TOSS
        ? ease(interpolate(f, [PULL1, PULL1 + seconds(0.5)], [0, 1]))
        : f < TOSS + seconds(0.9)
          ? 1 - ease(interpolate(f, [TOSS, TOSS + seconds(0.9)], [0, 1]))
          : f < PULL2
            ? 0
            : f < DROP
              ? ease(interpolate(f, [PULL2, PULL2 + seconds(0.5)], [0, 1]))
              : 1 - ease(interpolate(f, [DROP, DROP + seconds(0.7)], [0, 1]));

  const shake = pulse(f, SHAKE, seconds(0.7)) * Math.sin((f - SHAKE) * 1.1) * 3.5;
  const nod = pulse(f, NOD, seconds(0.8)) * Math.sin((f - NOD) * 0.75) * 3;
  const lean = -7 * armUp + shake + nod;

  const tug = pulse(f, TUG1, seconds(0.6)) + pulse(f, TUG2, seconds(0.6)) * 1.3;

  const breeze = Math.sin(f / 30);
  const blink = f % seconds(5.3) < 4 ? 0.15 : 1;

  // From the nod that approves the catch until the scene settles for the loop.
  const happy =
    ease(interpolate(f, [NOD, NOD + seconds(0.5)], [0, 1])) *
    (1 - ease(interpolate(f, [FADE, FADE + seconds(0.6)], [0, 1])));

  /* Rod tip, composed exactly as the JSX groups nest, so the line always meets
     the rod however the body is leaning. */

  const armAngle = -36 * armUp;
  const shoulder = add(HIP, rot(SHOULDER, lean));
  const tip = add(shoulder, rot(rot({ x: 76, y: -66 }, armAngle), lean));

  /* Where the line ends, per beat: the bobber, then the flying tag, then back. */

  const bob = Math.sin(f / 9) * 2.4 + tug * 9;
  const bobber: P = { x: BOBBER_X, y: WATER + bob };
  const dangle: P = { x: tip.x + breeze * 3, y: tip.y + 40 };

  const pull1 = ease(interpolate(f, [PULL1, DANGLE1], [0, 1]));
  const pull2 = ease(interpolate(f, [PULL2, DANGLE2], [0, 1]));
  const tossT = ease(interpolate(f, [TOSS, SPLASH], [0, 1]));
  const swingT = ease(interpolate(f, [SWING, DROP], [0, 1]));

  const basketMouth: P = { x: BASKET.x + BASKET.w / 2, y: BASKET.y + 4 };

  const tag1: P | null =
    f >= PULL1 && f < SPLASH
      ? f < DANGLE1
        ? arc(pull1, { x: BOBBER_X, y: WATER }, dangle, 46)
        : f < TOSS
          ? dangle
          : arc(tossT, dangle, { x: 212, y: WATER + 2 }, 40)
      : null;

  const tag2: P | null =
    f >= PULL2
      ? f < DANGLE2
        ? arc(pull2, { x: BOBBER_X, y: WATER }, dangle, 46)
        : f < SWING
          ? dangle
          : f < DROP
            ? arc(swingT, dangle, basketMouth, 30)
            : basketMouth
      : null;

  const lineOut = (f >= PULL1 && f < TOSS + seconds(0.4)) || (f >= PULL2 && f < DROP);
  const lineBack1 = ease(interpolate(f, [TOSS + seconds(0.4), BACK1], [0, 1]));
  const lineBack2 = ease(interpolate(f, [DROP, DROP + seconds(0.8)], [0, 1]));

  const lineEnd: P = lineOut
    ? { x: (tag1 ?? tag2 ?? dangle).x, y: (tag1 ?? tag2 ?? dangle).y - 10 }
    : f < PULL1
      ? bobber
      : f < PULL2
        ? {
            x: dangle.x + (bobber.x - dangle.x) * lineBack1,
            y: dangle.y + (bobber.y - dangle.y) * lineBack1,
          }
        : {
            x: dangle.x + (bobber.x - dangle.x) * lineBack2,
            y: dangle.y + (bobber.y - dangle.y) * lineBack2,
          };

  const slack = lineOut ? 2 : 16 - tug * 12;
  const line = `M${tip.x},${tip.y} Q${(tip.x + lineEnd.x) / 2 + breeze * 2},${(tip.y + lineEnd.y) / 2 + slack} ${lineEnd.x},${lineEnd.y}`;

  const bobberVisible = f < PULL1 || (lineBack1 >= 1 && f < PULL2) || lineBack2 >= 1;

  /* Post-catch furniture. */

  const check = ease(interpolate(f, [CHECK, CHECK + seconds(0.5)], [0, 1]));
  const settle = 1 - ease(interpolate(f, [FADE, FADE + seconds(0.6)], [0, 1]));
  const basketBump = pulse(f, DROP, seconds(0.4)) * 2;

  const eye: P =
    f >= DANGLE1 && f < TOSS
      ? { x: 1, y: -1.5 }
      : f >= SWING && f < DROP + seconds(0.5)
        ? { x: -2, y: 0.5 }
        : { x: 1.5, y: 0 };

  return (
    <g>
      {/* Sky: two slow strokes, nothing else. The space is the point. */}
      {[
        { y: 64, speed: 0.05, o: 0.14 },
        { y: 104, speed: 0.033, o: 0.1 },
      ].map((cloud) => (
        <path
          key={cloud.y}
          d="M0,0 q20,-6 44,0 q18,4 38,0"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.3}
          opacity={cloud.o}
          transform={`translate(${((f * cloud.speed + cloud.y) % 320) - 80} ${cloud.y})`}
        />
      ))}

      {/* Water breathes sideways rather than scrolling, so it has no seam */}
      {WAVES.map((wave, i) => (
        <g
          key={i}
          opacity={0.3 - i * 0.045}
          transform={`translate(${Math.sin(f / 40 + i * 1.7) * 9 * (i % 2 ? -1 : 1)} ${Math.sin(f / 26 + i) * 1.4})`}
        >
          <Sketch shapes={[wave]} progress={1} />
        </g>
      ))}

      <FishShadow f={f} from={224} to={186} at={[seconds(1.1), seconds(2.5)]} y={402} />
      <FishShadow f={f} from={128} to={170} at={[seconds(7.5), seconds(8.9)]} y={406} />

      {/* The jetty: two planks and two legs, slightly out of true */}
      <g opacity={0.75}>
        <S d="M26,353 L113,352" w={2.8} />
        <S d="M30,357.5 L109,357" w={1.3} o={0.5} />
        <S d="M44,358 L45.5,394" w={2.4} />
        <S d="M95,358 L93.5,399" w={2.4} />
      </g>

      {/* Ripples where the bobber sits, breathing on their own clock */}
      {bobberVisible ? (
        <>
          <Ripple
            at={{ x: BOBBER_X, y: WATER + 3 }}
            r={7 + ((f / 2) % 16)}
            o={0.32 * (1 - ((f / 2) % 16) / 16)}
          />
          <Ripple
            at={{ x: BOBBER_X, y: WATER + 3 }}
            r={7 + (((f + 60) / 2) % 16)}
            o={0.2 * (1 - (((f + 60) / 2) % 16) / 16)}
          />
        </>
      ) : null}

      {/* Splashes: where the reject lands, and where each catch left the water */}
      <Ripple
        at={{ x: 212, y: WATER + 3 }}
        r={4 + pulse(f, SPLASH, seconds(1)) * 16}
        o={pulse(f, SPLASH, seconds(1)) * 0.45}
      />
      <Droplets f={f} at={{ x: BOBBER_X, y: WATER }} when={PULL1} />
      <Droplets f={f} at={{ x: BOBBER_X, y: WATER }} when={PULL2} />
      <Droplets f={f} at={{ x: 212, y: WATER }} when={SPLASH - seconds(0.1)} />

      {/* The line, the bobber, and whatever is on the hook */}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.1} opacity={0.65} />
      {bobberVisible ? (
        <g transform={`translate(${bobber.x} ${bobber.y})`}>
          <S d="M0,-8 L0,-2" w={1.6} />
          <circle cx={0} cy={1.5} r={3.4} fill="none" stroke="currentColor" strokeWidth={2} />
        </g>
      ) : null}

      {tag1 ? (
        <g transform={`translate(${tag1.x} ${tag1.y})`}>
          <Tag
            label={script.reject}
            sway={f < DANGLE1 ? 0 : f < TOSS ? breeze * 7 + shake : tossT * 150}
          />
        </g>
      ) : null}
      {tag2 && f < DROP ? (
        <g transform={`translate(${tag2.x} ${tag2.y})`}>
          <Tag
            label={script.accept}
            sway={f < DANGLE2 ? 0 : f < SWING ? breeze * 7 : swingT * -20}
          />
        </g>
      ) : null}

      {/* The keeper, tucked in the basket */}
      {f >= DROP ? (
        <g
          opacity={settle}
          transform={`translate(${basketMouth.x} ${basketMouth.y + 3}) rotate(-9) scale(0.9)`}
        >
          <Tag label={script.accept} />
        </g>
      ) : null}

      {/* The basket, drawn after the tag so its rim tucks the catch in */}
      <g transform={`translate(0 ${-basketBump})`}>
        <S
          d={`M${BASKET.x - 2},${BASKET.y} L${BASKET.x + BASKET.w + 2},${BASKET.y + 0.5}`}
          w={2.8}
        />
        <S
          d={`M${BASKET.x + 1},${BASKET.y + 1} L${BASKET.x + 5},${BASKET.y + BASKET.h} L${BASKET.x + BASKET.w - 5},${BASKET.y + BASKET.h + 0.5} L${BASKET.x + BASKET.w - 1},${BASKET.y + 1}`}
          w={2.4}
        />
        <S
          d={`M${BASKET.x + 4},${BASKET.y + 8} L${BASKET.x + BASKET.w - 3},${BASKET.y + 8.5}`}
          w={1.2}
          o={0.5}
        />
        <S
          d={`M${BASKET.x + 5},${BASKET.y + 15} L${BASKET.x + BASKET.w - 4},${BASKET.y + 15.5}`}
          w={1.2}
          o={0.5}
        />
      </g>

      {/* The tick, drawn as one stroke once the keeper is in */}
      {check > 0 ? (
        <path
          d={`M${basketMouth.x - 9},${BASKET.y - 22} l6,7 l13,-14`}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - check}
          opacity={settle}
        />
      ) : null}

      {/* The fisher, in the same hand as every other mascot in the product */}
      <g transform={`translate(${HIP.x} ${HIP.y}) rotate(${lean})`}>
        {/* Legs over the edge, drawn first so the shell sits over them */}
        <S d="M-7,-1 C-7,6 -8.5,10 -7.5,14" w={2.6} />
        <S d="M3,0 C3,7 2,11 3,15" w={2.6} />

        {/* The shell: one closed body, an overshoot where the pen turned */}
        <S
          d="M-16,-2 C-20.5,-26 -13,-38.5 2,-39.2 C16.5,-39.8 22.5,-29 21.3,-15.5 C20.4,-5.5 15.5,0.4 5.5,1.2 C-2.5,1.9 -12.5,2.2 -16,-2 Z"
          w={2.9}
        />
        <S d="M-14.5,-9 C-16.5,-20 -13.5,-30 -6,-35.5" w={1.3} o={0.5} />

        {/* Ear cup on the side we can see */}
        <S d="M-19,-25 C-24.5,-24 -24.5,-16 -18.5,-15" w={2.4} />

        {/* One lens, looking where the work is */}
        <g transform={`translate(10 -26) scale(1 ${blink})`}>
          <circle r={5.6} fill="none" stroke="currentColor" strokeWidth={2.3} />
          <circle cx={eye.x} cy={eye.y} r={2.1} fill="currentColor" />
        </g>

        {/* Speaker mouth, until the catch is right — then it curls into a smile */}
        <g opacity={1 - happy}>
          <S d="M3.5,-14.5 H13" w={1.9} o={0.9} />
          <S d="M5.5,-11 H11" w={1.6} o={0.7} />
        </g>
        <path
          d="M3,-15 Q8.5,-9 14,-14.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.1}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - happy}
        />

        {/* Antenna, leaning on the breeze */}
        <g transform={`rotate(${breeze * 7} 2 -39)`}>
          <S d="M2,-39 C1.5,-44 3,-47 4,-50" w={2.1} />
          <circle cx={4.3} cy={-52} r={2.6} fill="none" stroke="currentColor" strokeWidth={2} />
        </g>

        {/* Arm and rod turn together at the shoulder, so they can never part */}
        <g transform={`translate(${SHOULDER.x} ${SHOULDER.y}) rotate(${armAngle})`}>
          <S d="M-6,3 C1,-1 10,-7 20,-12" w={2.6} />
          <path
            d={`M20,-12 Q${52},${-46 + tug * 12} 76,-66`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.1}
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}
