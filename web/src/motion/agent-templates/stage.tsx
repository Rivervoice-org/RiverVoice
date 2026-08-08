"use client";

import * as React from "react";

import { box } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";

/**
 * The furniture every template scene shares: one frame size, one caption slot,
 * one ground line, and a pen that draws a stroke on rather than fading it in.
 *
 * The scenes differ in what happens, not in how they are staged — six panels
 * that each invented their own margins is what made the set look unrelated.
 */

export const VIEW = { w: 260, h: 560 };

/** Everything that matters lives inside this, since the panel can clip the sides. */
export const SAFE = { left: 34, right: 226, mid: 130 };

export const GROUND = 512;

export const text = {
  caption: "fill-current text-[11.5px] [font-family:var(--font-sans)]",
  body: "fill-current text-[12px] [font-family:var(--font-sans)]",
  strong: "fill-current text-[12px] font-medium [font-family:var(--font-sans)]",
  small: "fill-current text-[10.5px] [font-family:var(--font-sans)]",
};

/** A stroke arriving the way a pen puts it down — from one end to the other. */
export function Ink({
  d,
  t = 1,
  w = 2.2,
  o = 1,
  fill,
}: {
  d: string;
  t?: number;
  w?: number;
  o?: number;
  fill?: number;
}) {
  if (t <= 0) return null;

  return (
    <path
      d={d}
      fill={fill ? "currentColor" : "none"}
      fillOpacity={fill ? fill * t : 0}
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={o}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - Math.min(1, t)}
    />
  );
}

/**
 * One line at the top, swapped on the beat. Held in place rather than sliding,
 * because three captions sliding through a narrow panel reads as a ticker.
 */
export function Caption({
  f,
  at,
  lines,
  y = 62,
  fade = 1,
}: {
  f: number;
  at: number[];
  lines: string[];
  y?: number;
  fade?: number;
}) {
  let i = 0;
  for (let n = 0; n < at.length; n += 1) if (f >= at[n]) i = n;

  const show = interpolate(f, [at[i], at[i] + seconds(0.3)], [0, 1]);

  return (
    <text
      x={SAFE.mid}
      y={y}
      textAnchor="middle"
      className={text.caption}
      opacity={show * 0.85 * fade}
      transform={`translate(0 ${(1 - show) * 3})`}
    >
      {lines[i]}
    </text>
  );
}

export function Ground({ t = 1 }: { t?: number }) {
  return (
    <g opacity={t}>
      <Ink d={`M${SAFE.left - 14},${GROUND} L${SAFE.right + 14},${GROUND}`} w={2.6} o={0.75} />
      <Ink d={`M${SAFE.left - 8},${GROUND + 5} L${SAFE.right + 6},${GROUND + 4}`} w={1.1} o={0.3} />
    </g>
  );
}

/** A card that is drawn, then settles — the one shape a scene resolves into. */
export function Card({
  x,
  y,
  w,
  h,
  t,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  children?: React.ReactNode;
}) {
  if (t <= 0) return null;
  const settle = ease(t);

  return (
    <g
      opacity={settle}
      transform={`translate(0 ${(1 - settle) * -5}) rotate(${-1.6 + settle * 1.6} ${x + w / 2} ${y + h / 2})`}
    >
      <path
        d={box(x, y, w, h, 12)}
        fill="currentColor"
        fillOpacity={0.03}
        stroke="currentColor"
        strokeWidth={2.1}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - Math.min(1, t * 1.4)}
      />
      {settle > 0.5 ? children : null}
    </g>
  );
}

/** The call landing on the agent, twice, so it reads as ringing. */
export function Ring({
  f,
  at,
  x,
  y,
  fade = 1,
}: {
  f: number;
  at: number;
  x: number;
  y: number;
  fade?: number;
}) {
  return (
    <>
      {[0, 1].map((i) => {
        const t = interpolate(f, [at + i * seconds(0.16), at + seconds(1)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={10 + t * 40}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            opacity={0.3 * (1 - t) * fade}
          />
        );
      })}
    </>
  );
}

/** A tick, drawn in two strokes the way a hand does it. */
export function Tick({ x, y, t, size = 11 }: { x: number; y: number; t: number; size?: number }) {
  return (
    <Ink
      d={`M${x},${y} l${size * 0.36},${size * 0.42} l${size * 0.74},${-size * 0.86}`}
      t={t}
      w={2.4}
    />
  );
}
