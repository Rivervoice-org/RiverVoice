"use client";

import * as React from "react";

/**
 * The cast.
 *
 * Six templates had been sharing one character and one staging, which is why
 * they read as the same panel with different words. These are six mascots with
 * six silhouettes — tall, domed, winged, flickering, wide, wedge — so a glance
 * at the shape already tells you which template you are looking at.
 *
 * Each is drawn around its own centre and scaled from there, so a scene places
 * it by a single point.
 */

type Ink = { d: string; w?: number; o?: number; fill?: number };

function Pen({ parts }: { parts: Ink[] }) {
  return (
    <>
      {parts.map((p) => (
        <path
          key={p.d}
          d={p.d}
          fill={p.fill ? "currentColor" : "none"}
          fillOpacity={p.fill ?? 0}
          stroke="currentColor"
          strokeWidth={p.w ?? 2.3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p.o ?? 1}
        />
      ))}
    </>
  );
}

function Eyes({
  at,
  r = 3.2,
  blink = 1,
  gaze = 0,
}: {
  at: [number, number][];
  r?: number;
  blink?: number;
  gaze?: number;
}) {
  return (
    <g transform={`scale(1 ${Math.max(0.08, blink)})`} style={{ transformOrigin: "center" }}>
      {at.map(([x, y]) => (
        <g key={`${x},${y}`} transform={`translate(0 ${y * (1 - Math.max(0.08, blink))})`}>
          <circle cx={x + gaze} cy={y} r={r} fill="currentColor" />
        </g>
      ))}
    </g>
  );
}

/** A mouth that speaks: shut is a line, open is a lens, pleased curls up. */
function Mouth({
  y,
  talk = 0,
  smile = 0,
  w = 9,
}: {
  y: number;
  talk?: number;
  smile?: number;
  w?: number;
}) {
  const open = talk * 3.4;
  const lift = smile * 2.4;
  const d = open
    ? `M${-w},${y} C${-w * 0.5},${y - lift - 1} ${w * 0.5},${y - lift - 1} ${w},${y} C${w * 0.5},${y + open} ${-w * 0.5},${y + open} ${-w},${y}`
    : `M${-w},${y - lift * 0.3} C${-w * 0.4},${y + 1.8 - lift} ${w * 0.4},${y + 1.8 - lift} ${w},${y - lift * 0.3}`;

  return <Pen parts={[{ d, w: 2.1 }]} />;
}

function Shadow({ w = 26, y = 0, o = 0.12 }: { w?: number; y?: number; o?: number }) {
  return <ellipse cx={0} cy={y} rx={w} ry={w * 0.2} fill="currentColor" opacity={o} />;
}

type Base = {
  x: number;
  y: number;
  size?: number;
  blink?: number;
  talk?: number;
  smile?: number;
  /** Degrees, toward what it is attending to. */
  tilt?: number;
};

function Frame({ x, y, size = 1, tilt = 0, children }: Base & { children: React.ReactNode }) {
  return <g transform={`translate(${x} ${y}) scale(${size}) rotate(${tilt})`}>{children}</g>;
}

/* ── Tally · Appointment management ─────────────────────────────────────────
   Tall and narrow, built like a column so it stands beside a column of times. */

export function Tally({ reach = 0, ...base }: Base & { reach?: number }) {
  return (
    <Frame {...base}>
      <Shadow w={24} y={62} />
      <Pen
        parts={[
          // Body — a standing column with a seam down it
          {
            d: "M-20,-4 h40 a8,8 0 0 1 8,8 v42 a8,8 0 0 1 -8,8 h-40 a8,8 0 0 1 -8,-8 v-42 a8,8 0 0 1 8,-8 Z",
          },
          { d: "M0,4 v46", w: 1.2, o: 0.3 },
          { d: "M-14,52 h8", w: 1.8, o: 0.5 },
          // Legs
          { d: "M-11,54 v6", w: 2.2 },
          { d: "M11,54 v6", w: 2.2 },
          // Head — a separate block, so the neck can turn
          { d: "M-6,-10 v6", w: 2 },
          { d: "M6,-10 v6", w: 2 },
          {
            d: "M-19,-40 h38 a7,7 0 0 1 7,7 v16 a7,7 0 0 1 -7,7 h-38 a7,7 0 0 1 -7,-7 v-16 a7,7 0 0 1 7,-7 Z",
          },
          { d: "M0,-40 v-8", w: 2 },
          { d: "M-3.6,-50 a3.6,3.6 0 1 1 7.2,0 a3.6,3.6 0 1 1 -7.2,0", w: 2 },
        ]}
      />
      <g transform="translate(0 -26)">
        <Eyes
          at={[
            [-7, 0],
            [7, 0],
          ]}
          blink={base.blink}
          r={3}
        />
        <Mouth y={9} talk={base.talk} smile={base.smile} w={7} />
      </g>
      {/* One long arm, only out when it is pointing at something */}
      {reach > 0 ? (
        <Pen
          parts={[
            {
              d: `M-26,14 C${-34 - reach * 12},14 ${-40 - reach * 22},${12 - reach * 4} ${-46 - reach * 30},${8 - reach * 8}`,
              w: 2.2,
            },
            {
              d: `M${-46 - reach * 30},${8 - reach * 8} m-2.6,0 a2.6,2.6 0 1 0 5.2,0 a2.6,2.6 0 1 0 -5.2,0`,
              w: 2,
            },
          ]}
        />
      ) : null}
    </Frame>
  );
}

/* ── Bell · Front desk ──────────────────────────────────────────────────────
   A dome, like the bell that used to sit on the counter it now stands behind. */

export function Bell({ ring = 0, ...base }: Base & { ring?: number }) {
  return (
    <Frame {...base}>
      <Pen
        parts={[
          { d: "M-34,26 C-34,-10 -20,-26 0,-26 C20,-26 34,-10 34,26", fill: 0.04 },
          { d: "M-40,26 h80", w: 2.6 },
          { d: "M0,-26 v-7", w: 2.2 },
          { d: "M-4,-37 a4,4 0 1 1 8,0 a4,4 0 1 1 -8,0", w: 2.1 },
          { d: "M-30,26 v6", w: 2 },
          { d: "M30,26 v6", w: 2 },
        ]}
      />
      <g transform="translate(0 -2)">
        <Eyes
          at={[
            [-10, 0],
            [10, 0],
          ]}
          blink={base.blink}
          r={3.4}
        />
        <Mouth y={13} talk={base.talk} smile={base.smile} w={10} />
      </g>
      {/* It is a bell, so being called shows as sound coming off it */}
      {ring > 0
        ? [0, 1].map((i) => (
            <path
              key={i}
              d={`M${38 + i * 7},${-10 - i * 3} C${44 + i * 8},${-2} ${44 + i * 8},${6} ${38 + i * 7},${14 + i * 3}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              opacity={ring * (0.7 - i * 0.25)}
            />
          ))
        : null}
    </Frame>
  );
}

/* ── Kaki · Order status ────────────────────────────────────────────────────
   Winged, because this one is the only scene that travels. Built the way a
   launched-bird character is: nearly all body, no neck, both eyes crowded to
   the front under heavy brows, and a wedge of beak. Ours, not theirs — the
   panel seam, the rivets and the antenna make it plainly one of our bots. */

export function Kaki({ flap = 0, ...base }: Base & { flap?: number }) {
  const wing = -26 + flap * 52;
  // Heavy brows, but arched up toward the middle rather than down: the build is
  // the borrowed part, the scowl is not. Being pleased only lifts them further.
  const lift = (base.smile ?? 0) * 3;
  const jaw = (base.talk ?? 0) * 11;

  return (
    <Frame {...base}>
      <Pen
        parts={[
          // All body, no neck — an egg carrying a little more weight low down
          {
            d: "M1,-29 C17,-29 29,-17 29.5,-2 C30,14 18,28 1,28.5 C-16,29 -29,15 -29.5,-1 C-30,-17 -16,-29 1,-29 Z",
            fill: 0.04,
            w: 2.6,
          },
          // The belly it sits on, and a cheek to give the head some volume
          { d: "M-17,15 C-10,24 11,24 17,14", w: 1.9, o: 0.42 },
          { d: "M-25,-6 C-21,-13 -15,-17 -8,-19", w: 1.2, o: 0.3 },
          // A seam and two rivets, because it is a bot as well as a bird
          { d: "M-22,2 a1.9,1.9 0 1 1 0.1,0 M-19,10 a1.9,1.9 0 1 1 0.1,0", w: 1.6, o: 0.4 },
          // Crest — two feathers that lean back, so it reads as moving forward
          { d: "M-8,-27 C-13,-34 -7,-39 -2,-33", w: 2.3 },
          { d: "M2,-29 C0,-37 7,-40 10,-34", w: 2.3 },
          // The antenna, the same one Tally wears
          { d: "M13,-26 C19,-31 23,-34 26,-35", w: 1.9 },
          { d: "M26,-35 a2.8,2.8 0 1 1 0.1,0", w: 1.9 },
          // Tail, three feathers fanned off the back
          { d: "M-28,-4 C-36,-8 -41,-11 -45,-13", w: 2.3 },
          { d: "M-29.5,3 C-38,3 -43,3 -47,4", w: 2.3 },
          { d: "M-28,10 C-35,13 -39,16 -42,19", w: 2.3 },
          // Feet tucked up, the way a bird carrying something holds them
          { d: "M-7,28 C-8,32 -6,34 -3,34", w: 2.1 },
          { d: "M7,27 C6,31 8,33 11,33", w: 2.1 },
        ]}
      />

      {/* Eyes crowded to the front, large and nearly touching */}
      <g transform="translate(4 -7)">
        <circle cx={-7} cy={0} r={8.6} fill="none" stroke="currentColor" strokeWidth={2.4} />
        <circle cx={8.6} cy={0.4} r={7.2} fill="none" stroke="currentColor" strokeWidth={2.4} />
        <g transform={`scale(1 ${Math.max(0.06, base.blink ?? 1)})`}>
          <circle cx={-4.2} cy={1.4} r={3.2} fill="currentColor" />
          <circle cx={10.2} cy={1.6} r={2.7} fill="currentColor" />
        </g>
      </g>

      {/* Brows arched over the eyes — the weight is there, the frown is not */}
      <g transform={`translate(0 ${-lift})`}>
        <Pen
          parts={[
            { d: "M-16,-18 C-13,-25 -6,-28 -0.5,-25.5", w: 3.4 },
            { d: "M23,-17 C21,-23 15,-26 10,-24.5", w: 3.2 },
          ]}
        />
      </g>

      {/* A wedge of beak, the lower half hinging down when it speaks */}
      <Pen
        parts={[{ d: "M12,-0.5 C20,0.5 27,2.5 31,4.5 C26,6 19,7 12,7.5 Z", fill: 0.1, w: 2.3 }]}
      />
      <g transform={`rotate(${jaw} 12 7.5)`}>
        <Pen parts={[{ d: "M12,7.5 C19,7 26,6 31,4.5 C26,9 19,13 12,14 Z", fill: 0.06, w: 2.3 }]} />
      </g>

      <g transform={`rotate(${wing} -2 2)`}>
        <Pen parts={[{ d: "M-3,3 C5,-14 22,-17 27,-5 C19,1 6,5 -3,3 Z", fill: 0.08, w: 2.4 }]} />
      </g>
    </Frame>
  );
}

/* ── Chaabi · Renewal nudge ─────────────────────────────────────────────────
   A wind-up. Everything this template sells is in the key: it runs down on its
   own, and renewing is not a document changing hands, it is somebody turning
   the key before it stops. Squat and barrel-built, so the slump is visible. */

export function Chaabi({
  /** 1 fully wound, 0 run down. */
  wound = 1,
  /** Degrees the key has been turned — a scene spins this several times. */
  turn = 0,
  ...base
}: Base & { wound?: number; turn?: number }) {
  const droop = 1 - Math.max(0, Math.min(1, wound));

  return (
    <Frame {...base}>
      <Shadow w={30} y={42} />
      <Pen
        parts={[
          // Barrel body, hooped like something that holds a spring
          { d: "M-24,-16 C-24,-25 24,-25 24,-16 V20 C24,29 -24,29 -24,20 Z", fill: 0.04, w: 2.5 },
          { d: "M-24,-16 C-24,-8 24,-8 24,-16", w: 1.6, o: 0.4 },
          { d: "M-23,10 C-14,15 14,15 23,10", w: 1.5, o: 0.3 },
          // Legs, set wide so the sag reads against them
          { d: "M-12,27 v9 M12,27 v9", w: 2.3 },
          { d: "M-17,36 h10 M7,36 h10", w: 2.3 },
        ]}
      />

      {/* The head sinks onto the body as it runs down */}
      <g transform={`translate(0 ${droop * 5}) rotate(${droop * 9} 0 -18)`}>
        <Pen
          parts={[
            { d: "M-6,-26 v6 M6,-26 v6", w: 2 },
            {
              d: "M-15,-46 h30 a6,6 0 0 1 6,6 v14 a6,6 0 0 1 -6,6 h-30 a6,6 0 0 1 -6,-6 v-14 a6,6 0 0 1 6,-6 Z",
              w: 2.4,
            },
          ]}
        />
        <g transform="translate(0 -33)">
          <Eyes
            at={[
              [-7, 0],
              [7, 0],
            ]}
            blink={Math.min(base.blink ?? 1, 1 - droop * 0.55)}
            r={3}
          />
          <Mouth y={10} talk={base.talk} smile={base.smile} w={7} />
        </g>
      </g>

      {/* The key, in its side. Turning it is the whole beat. */}
      <Pen parts={[{ d: "M24,-2 H38", w: 2.6 }]} />
      <g transform={`rotate(${turn} 42 -2)`}>
        <Pen
          parts={[
            { d: "M42,-4 C34,-4 33,-15 42,-15 C51,-15 50,-4 42,-4 Z", fill: 0.06, w: 2.4 },
            { d: "M42,0 C34,0 33,11 42,11 C51,11 50,0 42,0 Z", fill: 0.06, w: 2.4 },
            { d: "M38,-2 h8", w: 2.2 },
          ]}
        />
      </g>
    </Frame>
  );
}

/* ── Deepa · unused ─────────────────────────────────────────────────────────
   A lamp, kept in case a template ever wants something that can go out. */

export function Deepa({ flame = 1, ...base }: Base & { flame?: number }) {
  const h = 14 + flame * 16;

  return (
    <Frame {...base}>
      <Shadow w={26} y={26} />
      <Pen
        parts={[
          { d: "M-26,4 C-22,20 22,20 26,4 Z", fill: 0.05 },
          { d: "M-26,4 C-14,-2 14,-2 26,4", w: 2.1, o: 0.6 },
          { d: "M-13,22 h26", w: 2.2 },
        ]}
      />
      <g transform={`translate(0 -2)`}>
        <path
          d={`M0,${-h} C${7 + flame * 3},${-h * 0.5} 9,-2 0,2 C-9,-2 ${-7 - flame * 3},${-h * 0.5} 0,${-h} Z`}
          fill="currentColor"
          fillOpacity={0.06 + flame * 0.06}
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <g transform={`translate(0 ${-h * 0.42})`}>
          <Eyes
            at={[
              [-3.4, 0],
              [3.4, 0],
            ]}
            blink={base.blink}
            r={1.9}
          />
          <Mouth y={5} talk={base.talk} smile={base.smile} w={4} />
        </g>
      </g>
    </Frame>
  );
}

/* ── Ganak · EMI collection ─────────────────────────────────────────────────
   Wide, and the ledger is its own chest — the character is the object. */

export function Ganak({ beads = [0, 0, 0], ...base }: Base & { beads?: number[] }) {
  const rails = [-12, 4, 20];

  return (
    <Frame {...base}>
      <Shadow w={44} y={54} />
      <Pen
        parts={[
          {
            d: "M-46,-24 h92 a10,10 0 0 1 10,10 v50 a10,10 0 0 1 -10,10 h-92 a10,10 0 0 1 -10,-10 v-50 a10,10 0 0 1 10,-10 Z",
          },
          { d: "M-24,-24 v-8 h48 v8", w: 2.1 },
          { d: "M-30,46 v6 M30,46 v6", w: 2.2 },
        ]}
      />
      {/* Three rails, one per instalment, and beads that only ever go right */}
      {rails.map((y, i) => (
        <g key={y}>
          <Pen parts={[{ d: `M-38,${y} H38`, w: 1.5, o: 0.35 }]} />
          {[0, 1, 2].map((n) => (
            <circle
              key={n}
              cx={-30 + n * 9 + (beads[i] ?? 0) * (54 - n * 2)}
              cy={y}
              r={3.6}
              fill="currentColor"
              fillOpacity={0.12}
              stroke="currentColor"
              strokeWidth={1.9}
            />
          ))}
        </g>
      ))}
      <g transform="translate(0 -40)">
        <Eyes
          at={[
            [-9, 0],
            [9, 0],
          ]}
          blink={base.blink}
          r={2.8}
        />
      </g>
      <g transform="translate(0 -32)">
        <Mouth y={0} talk={base.talk} smile={base.smile} w={8} />
      </g>
    </Frame>
  );
}

/* ── Chhaan · Sales discovery ───────────────────────────────────────────────
   A funnel, which is what qualifying is: everything goes in the top, one thing
   comes out the bottom. Built as a proper funnel — flat rim, tapering cone,
   a spout with a lip — rather than a wedge, which only ever read as a samosa. */

export function Chhaan({
  /** A lead making it through, 0 at the spout to 1 clear of it. */
  drop = 0,
  ...base
}: Base & { drop?: number }) {
  return (
    <Frame {...base}>
      <Shadow w={20} y={54} />
      <Pen
        parts={[
          // The cone, hung between the two ends of the rim
          { d: "M-31,-22 C-28,-4 -14,6 -9,16 L9,16 C14,6 28,-4 31,-22 Z", fill: 0.04, w: 2.5 },
          // The rim, drawn as an opening rather than a line
          { d: "M-31,-22 C-31,-30 31,-30 31,-22 C31,-14 -31,-14 -31,-22 Z", w: 2.5 },
          { d: "M-24,-19 C-18,-16 -6,-15.5 2,-16.5", w: 1.3, o: 0.3 },
          // Spout, with a lip so it plainly pours
          { d: "M-9,16 V34 M9,16 V34", w: 2.4 },
          { d: "M-9,34 C-11,38 -7,40 -4,40 M9,34 C11,38 7,40 4,40", w: 2.2 },
          // Ridges down the cone, for volume
          { d: "M-19,-8 C-16,0 -12,6 -9,10", w: 1.2, o: 0.28 },
          { d: "M19,-8 C16,0 12,6 9,10", w: 1.2, o: 0.28 },
          // The family antenna
          { d: "M26,-27 C29,-33 32,-36 34,-38", w: 1.9 },
          { d: "M34,-38 a2.8,2.8 0 1 1 0.1,0", w: 1.9 },
        ]}
      />

      <g transform="translate(0 -4)">
        <Eyes
          at={[
            [-8, 0],
            [8, 0],
          ]}
          blink={base.blink}
          r={3.1}
        />
        <Mouth y={10} talk={base.talk} smile={base.smile} w={7} />
      </g>

      {/* What comes out the bottom, once it has been through all three */}
      {drop > 0 ? (
        <circle
          cx={0}
          cy={42 + drop * 16}
          r={4}
          fill="currentColor"
          fillOpacity={0.14}
          stroke="currentColor"
          strokeWidth={2}
          opacity={1 - Math.max(0, drop - 0.7) / 0.3}
        />
      ) : null}
    </Frame>
  );
}
