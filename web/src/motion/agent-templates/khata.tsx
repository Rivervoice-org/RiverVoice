"use client";

import { box } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";
import { Ganak } from "@/motion/agent-templates/bots";
import { Caption, Ink, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * "₹2,400 பாக்கி" — the book, and the last line of it.
 *
 * No ledger drawn beside the mascot: Ganak is the ledger. Three instalments sit
 * as three rails across its chest, and each one clears by sliding right, the
 * balance above stepping down with it. Recovery that reads as bookkeeping
 * rather than pressure, which is the tone this template's instructions ask for.
 */
export type KhataScript = {
  /** The instalments still open. */
  entries: string[];
  /** What is left after each — one longer than entries. */
  balance: string[];
  /** Stamped across it at the end. */
  cleared: string;
  captions: [string, string, string];
};

export const KHATA_VIEW = VIEW;

const BOT = { x: 130, y: 300 };
const RAILS = [-12, 4, 20];
const STAMP = { x: 66, y: 404, w: 128, h: 46 };

const OPEN = seconds(0.6);
const FIRST = seconds(2.0);
const STEP = seconds(1.2);
const DONE = FIRST + STEP * 3;
const RESET = seconds(7.8);

export const KHATA_LENGTH = seconds(8.6);
/** All three cleared, and the page closed. */
export const KHATA_STILL = seconds(7.0);

export function Khata({ f, script }: { f: number; script: KhataScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const entries = script.entries.slice(0, 3);

  const up = ease(interpolate(f, [OPEN, OPEN + seconds(0.8)], [0, 1]));

  // Each bead run slides right on its own beat, and never comes back.
  const beads = RAILS.map((_, i) =>
    ease(interpolate(f, [FIRST + STEP * i, FIRST + STEP * i + seconds(0.55)], [0, 1])),
  );

  let paid = 0;
  for (let i = 0; i < entries.length; i += 1)
    if (f >= FIRST + STEP * i + seconds(0.4)) paid = i + 1;
  const balance = script.balance[Math.min(paid, script.balance.length - 1)];
  const bump = Math.sin(
    Math.PI *
      interpolate(
        f,
        [FIRST + STEP * (paid - 1) + seconds(0.4), FIRST + STEP * (paid - 1) + seconds(0.9)],
        [0, 1],
      ),
  );

  const stamped = interpolate(f, [DONE, DONE + seconds(0.6)], [0, 1]);

  return (
    <g>
      <Caption f={f} at={[0, FIRST, DONE]} lines={script.captions} fade={gone} />

      {/* What is left, above it, and it only ever goes down */}
      <g opacity={gone * up} transform={`translate(0 ${-bump * 3})`}>
        <text
          x={130}
          y={128}
          textAnchor="middle"
          className={text.strong}
          opacity={paid === entries.length ? 0.5 : 1}
        >
          {balance}
        </text>
        <Ink d="M96,142 H164" w={1.4} o={0.25} />
      </g>

      {/* The instalments, named beside the rail each one sits on */}
      <g opacity={gone * up}>
        {entries.map((entry, i) => (
          <text
            key={entry}
            x={30}
            y={BOT.y + RAILS[i] * 1.15 + 4}
            className={text.small}
            opacity={beads[i] > 0.9 ? 0.4 : 0.85}
          >
            {entry}
          </text>
        ))}
      </g>

      <g opacity={gone}>
        <Ganak
          x={BOT.x}
          y={BOT.y}
          size={1.15}
          beads={beads}
          blink={f % 100 < 4 ? 0.1 : 1}
          talk={f >= FIRST && f < DONE ? Math.abs(Math.sin(f * 0.45)) * 0.8 : 0}
          smile={interpolate(f, [DONE, DONE + seconds(0.7)], [0, 1])}
        />
      </g>

      {/* Closed, not chased */}
      {stamped > 0 ? (
        <g
          opacity={gone * stamped}
          transform={`rotate(${-4 + stamped * 1.6} ${STAMP.x + STAMP.w / 2} ${STAMP.y + STAMP.h / 2})`}
        >
          <Ink d={box(STAMP.x, STAMP.y, STAMP.w, STAMP.h, 10)} t={stamped} w={2.3} o={0.85} />
          <text
            x={STAMP.x + STAMP.w / 2}
            y={STAMP.y + 29}
            textAnchor="middle"
            className={text.strong}
          >
            {script.cleared}
          </text>
        </g>
      ) : null}
    </g>
  );
}
