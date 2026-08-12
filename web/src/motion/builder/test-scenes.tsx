"use client";

import * as React from "react";

import { Mascot } from "@/mascots";
import { Loop } from "@/motion/loop";
import { Ink } from "@/motion/agent-templates/stage";
import { bubble } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";

/**
 * The idle loop for each way of testing.
 *
 * The agent's own mascot, not a drawn stand-in — you are about to test this
 * agent, so it should be its face on the panel. It is laid out beside the
 * drawing rather than inside it: a mascot is html, and html cannot be placed in
 * an inline svg, which is what defeated every earlier attempt at this.
 *
 * So the split is: the mascot is the agent, the svg is the line. One character
 * across all three tabs, because this is one agent being tried three ways —
 * only the staging changes.
 */

const VIEW = { w: 160, h: 140 };

function Scene({
  seed,
  talking = false,
  halo = false,
  length,
  still,
  tint,
  children,
}: {
  seed: string;
  /** Mouths alternate on their own clock; the svg carries the beats. */
  talking?: boolean;
  halo?: boolean;
  length: number;
  still: number;
  tint: string;
  children: (f: number) => React.ReactNode;
}) {
  return (
    <div className={`flex h-full w-full items-center justify-center gap-3 ${tint}`}>
      <span className="relative flex shrink-0 items-center justify-center">
        {halo
          ? [0, 1].map((i) => (
              <span
                key={i}
                aria-hidden
                className="animate-halo absolute size-14 rounded-full border motion-reduce:hidden"
                style={{ borderColor: "var(--tint)", animationDelay: `${i * 1.2}s` }}
              />
            ))
          : null}
        <Mascot seed={seed} size={64} talking={talking} className="relative" />
      </span>

      <Loop
        length={length}
        still={still}
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        preserve="xMidYMid meet"
        className="h-full min-w-0 flex-1 text-foreground/70"
      >
        {children}
      </Loop>
    </div>
  );
}

/* ── Voice ─────────────────────────────────────────────────────────────────
   A call in progress: the agent is being spoken to, and speaks back. */

const V_SPEAK = seconds(1.2);
const V_END = seconds(3.4);
const V_LENGTH = seconds(4.4);

const BARS = [0, 1, 2, 3, 4, 5, 6, 7];

export function VoiceScene({
  seed,
  /** The caller's live input level (0–1), updated imperatively at mic-chunk
   *  rate. A ref rather than a prop that re-renders: this changes ~30 times a
   *  second, far faster than the bars need a React commit, and `Loop` already
   *  re-renders every frame on its own clock — we just read the latest value
   *  when it does. Omit while there is no live call, and the bars fall back
   *  to the scripted idle envelope below. */
  level,
}: {
  seed: string;
  level?: React.RefObject<number>;
}) {
  // Smoothed toward `level.current` each frame so real mic input (which
  // arrives in bursts, not a clean curve) doesn't make the bars stutter.
  const smoothed = React.useRef(0);

  return (
    <Scene
      seed={seed}
      talking
      halo
      length={V_LENGTH}
      still={seconds(2.4)}
      tint="[--tint:var(--color-river)]"
    >
      {(f) => {
        let barLevel: number;

        if (level) {
          smoothed.current += (level.current - smoothed.current) * 0.35;
          barLevel = smoothed.current;
        } else {
          // Idle: runs up as the line opens and eases off at the end, so it
          // is never a loop of identical bars pumping.
          barLevel =
            interpolate(f, [V_SPEAK, V_SPEAK + seconds(0.5)], [0, 1]) *
            (1 - interpolate(f, [V_END, V_END + seconds(0.6)], [0, 1]));
        }

        return (
          <g transform={`translate(30 ${VIEW.h / 2})`}>
            {BARS.map((i) => {
              const wobble = Math.sin(f * 0.42 + i * 1.3) * 0.5 + Math.sin(f * 0.7 + i) * 0.5;
              const h = 4 + barLevel * (10 + Math.abs(wobble) * 30);

              return (
                <rect
                  key={i}
                  x={i * 13}
                  y={-h / 2}
                  width={5}
                  height={h}
                  rx={2.5}
                  fill="var(--tint)"
                  opacity={0.32 + barLevel * 0.5}
                />
              );
            })}
          </g>
        );
      }}
    </Scene>
  );
}

/* ── Phone ─────────────────────────────────────────────────────────────────
   The other direction: the agent places the call and waits to be picked up. */

const P_DIAL = seconds(0.7);
const P_ANSWER = seconds(2.6);
const P_LENGTH = seconds(4.6);

const CARD = { x: 26, y: 48, w: 122, h: 44 };

export function PhoneScene({ seed }: { seed: string }) {
  return (
    <Scene
      seed={seed}
      length={P_LENGTH}
      still={seconds(3.4)}
      tint="[--tint:var(--color-foreground)]"
    >
      {(f) => {
        const drawn = ease(interpolate(f, [seconds(0.2), seconds(0.9)], [0, 1]));
        const answered = f >= P_ANSWER;
        const tick = interpolate(f, [P_ANSWER, P_ANSWER + seconds(0.4)], [0, 1]);

        return (
          <g>
            {/* The number being dialled */}
            <Ink
              d={`M${CARD.x},${CARD.y + 12} a12,12 0 0 1 12,-12 h${CARD.w - 24} a12,12 0 0 1 12,12 v20 a12,12 0 0 1 -12,12 h-${CARD.w - 24} a12,12 0 0 1 -12,-12 Z`}
              t={drawn}
              w={2.1}
            />
            <Ink d={`M${CARD.x + 16},${CARD.y + 17} h40`} t={drawn} w={2.4} o={0.75} />
            <Ink d={`M${CARD.x + 16},${CARD.y + 29} h64`} t={drawn} w={2.4} o={0.28} />

            {/* Rings going out, and nothing coming back until it is picked up */}
            {!answered
              ? [0, 1, 2].map((i) => {
                  const at = P_DIAL + i * seconds(0.5);
                  const t = interpolate(f, [at, at + seconds(0.7)], [0, 1]);
                  if (t <= 0 || t >= 1) return null;
                  return (
                    <path
                      key={i}
                      d={`M2,${CARD.y + 2} q${10 + t * 20},${20} 0,${40}`}
                      fill="none"
                      stroke="var(--tint)"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      opacity={0.4 * (1 - t)}
                    />
                  );
                })
              : null}

            {/* Picked up */}
            <Ink d={`M${CARD.x + CARD.w - 30},${CARD.y + 20} l4,5 l9,-11`} t={tick} w={2.4} />
          </g>
        );
      }}
    </Scene>
  );
}

/* ── Chat ──────────────────────────────────────────────────────────────────
   Typed rather than spoken, so the beat is one message in and one back. */

const C_ASK = seconds(0.6);
const C_THINK = seconds(1.7);
const C_REPLY = seconds(2.5);
const C_LENGTH = seconds(4.8);

export function ChatScene({ seed }: { seed: string }) {
  return (
    <Scene seed={seed} length={C_LENGTH} still={seconds(3.4)} tint="[--tint:var(--color-amber)]">
      {(f) => {
        const asked = ease(interpolate(f, [C_ASK, C_ASK + seconds(0.4)], [0, 1]));
        const replied = ease(interpolate(f, [C_REPLY, C_REPLY + seconds(0.4)], [0, 1]));
        const thinking = f >= C_THINK && f < C_REPLY;

        return (
          <g>
            {/* Theirs, arriving */}
            <g opacity={asked} transform={`translate(0 ${(1 - asked) * 5})`}>
              <path
                d={bubble(12, 22, 118, 34, "left")}
                fill="var(--tint)"
                fillOpacity={0.1}
                stroke="var(--tint)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Ink d="M28,36 h58" w={2.4} o={0.5} />
              <Ink d="M28,46 h36" w={2.4} o={0.3} />
            </g>

            {/* Ours, once it has read it */}
            <g opacity={replied} transform={`translate(0 ${(1 - replied) * 5})`}>
              <path
                d={bubble(22, 80, 122, 36, "right")}
                fill="none"
                stroke="var(--tint)"
                strokeWidth={2}
                strokeLinejoin="round"
              />
              <Ink d="M38,96 h68" w={2.4} o={0.55} />
              <Ink d="M38,106 h44" w={2.4} o={0.32} />
            </g>

            {/* The pause between reading and answering, which is the whole point */}
            {thinking
              ? [0, 1, 2].map((i) => (
                  <circle
                    key={i}
                    cx={38 + i * 10}
                    cy={98}
                    r={3}
                    fill="var(--tint)"
                    opacity={0.3 + 0.6 * Math.max(0, Math.sin(f * 0.5 - i * 0.9))}
                  />
                ))
              : null}
          </g>
        );
      }}
    </Scene>
  );
}
