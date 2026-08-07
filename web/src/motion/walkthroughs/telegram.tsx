"use client";

import type * as React from "react";

import { Sketch, type Shape } from "@/motion/sketch";
import { box, bubble, chevronLeft, phone, plane, ticks } from "@/motion/shapes";
import { ease, enter, interpolate, seconds, typed } from "@/motion/timeline";
import type { Scene } from "@/motion/types";

export type TelegramScript = {
  agentName: string;
  /** A data URI. Passed in so the walkthrough never imports the avatar code. */
  avatar: string;
  username: string;
  group: string;
  summary: [string, string];
};

type SceneProps = { f: number; script: TelegramScript };

const body = "fill-current text-[11px]";
const dim = "fill-current text-[11px] opacity-55";
const mono = "fill-current font-mono text-[10px]";

/* The phone sits in the same place all the way through, so scenes feel like
   one continuous device rather than six unrelated drawings. */
const PHONE = { x: 40, y: 16, w: 214, h: 292 };
const SCREEN = { x: PHONE.x + 10, y: PHONE.y + 42, w: PHONE.w - 20, h: PHONE.h - 62 };

function Avatar({ src, x, y, size }: { src: string; x: number; y: number; size: number }) {
  return <image href={src} x={x} y={y} width={size} height={size} />;
}

function ChatHeader({
  title,
  subtitle,
  progress,
  avatar,
}: {
  title: string;
  subtitle: string;
  progress: number;
  avatar?: React.ReactNode;
}) {
  return (
    <>
      <Sketch
        shapes={[
          chevronLeft(PHONE.x + 16, PHONE.y + 30),
          { kind: "line", x1: PHONE.x, y1: PHONE.y + 44, x2: PHONE.x + PHONE.w, y2: PHONE.y + 44 },
        ]}
        progress={progress}
      />
      {avatar}
      <text x={PHONE.x + 62} y={PHONE.y + 27} className={body}>
        {title}
      </text>
      <text x={PHONE.x + 62} y={PHONE.y + 38} className={dim}>
        {subtitle}
      </text>
    </>
  );
}

type Line = { at: number; side: "left" | "right"; text: string[] };

// Measured off the rendered font rather than passed in, so injected names fit.
const widthOf = (text: string[]) =>
  Math.min(SCREEN.w - 34, Math.max(...text.map((row) => row.length)) * 5.7 + 20);

function Thread({ f, lines, top = SCREEN.y + 12 }: { f: number; lines: Line[]; top?: number }) {
  // Stacked by folding over the run, so nothing is reassigned mid-render.
  const placed = lines.reduce<{ line: Line; y: number; h: number }[]>((rows, line) => {
    const h = 14 + line.text.length * 13;
    const previous = rows.at(-1);
    const y = previous ? previous.y + previous.h + 14 : top;
    return [...rows, { line, y, h }];
  }, []);

  return (
    <>
      {placed.map(({ line, y, h }) => {
        const w = widthOf(line.text);
        const x = line.side === "left" ? SCREEN.x + 10 : SCREEN.x + SCREEN.w - 10 - w;
        const pop = ease(interpolate(f, [line.at, line.at + seconds(0.35)], [0, 1]));

        return (
          <g key={line.text.join()} opacity={pop} transform={`translate(0 ${(1 - pop) * 10})`}>
            <Sketch shapes={[{ kind: "svg", d: bubble(x, y, w, h, line.side) }]} progress={pop} />
            {line.text.map((row, i) => (
              <text key={row} x={x + 9} y={y + 17 + i * 13} className={body}>
                {typed(row, f, line.at + seconds(0.3) + i * seconds(0.35))}
              </text>
            ))}
          </g>
        );
      })}
    </>
  );
}

const TAU = Math.PI * 2;
const ICON = { x: PHONE.x + PHONE.w / 2, y: PHONE.y + 128 };

// A plane drawn at the origin, so it can be spun and scaled by transform alone.
const PLANE: Shape[] = [{ kind: "svg", d: plane(0, 0, 32) }];

/**
 * One swooping glide in from off-screen: up over the top, down across, then a
 * long shallow approach. A cubic curve rather than a spiral, so it reads as
 * flying somewhere rather than circling.
 */
const FLIGHT: [number, number][] = [
  [-80, 236],
  [130, 22],
  [430, 196],
  [ICON.x, ICON.y],
];

function bezier(t: number) {
  const u = 1 - t;
  const [a, b, c, d] = FLIGHT;
  const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];

  return {
    x: a[0] * w[0] + b[0] * w[1] + c[0] * w[2] + d[0] * w[3],
    y: a[1] * w[0] + b[1] * w[1] + c[1] * w[2] + d[1] * w[3],
  };
}

function planeAt(t: number) {
  const e = ease(t);
  const point = bezier(e);

  // A slow lift and fall over the curve, easing off as it lines up to land.
  const breeze = (1 - e) ** 1.5;
  return {
    x: point.x + Math.sin(e * TAU * 1.1) * 9 * breeze,
    y: point.y + Math.sin(e * TAU * 1.6 + 1) * 13 * breeze,
  };
}

function trailTo(t: number) {
  const from = Math.max(0, t - 0.16);
  const steps = 14;

  return Array.from({ length: steps }, (_, i) => planeAt(from + ((t - from) * i) / (steps - 1)))
    .map((point, i) => `${i === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
}

function Arrive({ f, script }: SceneProps) {
  const flight = Math.min(1, f / seconds(3.2));
  const here = planeAt(flight);
  const before = planeAt(Math.max(0, flight - 0.012));
  const heading = (Math.atan2(here.y - before.y, here.x - before.x) * 180) / Math.PI;

  // Rocking on top of the heading, so it looks pushed about rather than steered.
  const rock = Math.sin(flight * TAU * 1.4) * 7 * (1 - ease(flight));

  const land = ease(interpolate(f, [seconds(3.2), seconds(4.2)], [0, 1]));
  const x = interpolate(land, [0, 1], [here.x, ICON.x]);
  const y = interpolate(land, [0, 1], [here.y, ICON.y]);
  const spin = interpolate(land, [0, 1], [heading + rock, 0]);
  const scale = interpolate(land, [0, 1], [1, 0.58]);

  return (
    <>
      {/* A wisp of wake, gone by the time it lands. */}
      <path
        d={trailTo(flight)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={interpolate(f, [seconds(2.4), seconds(3.4)], [0.28, 0])}
      />

      <Sketch
        shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)}
        progress={interpolate(f, [seconds(3.8), seconds(4.8)], [0, 1])}
      />

      {/* The rounded tile the plane lands inside — the app icon. */}
      <Sketch
        shapes={[{ kind: "svg", d: box(ICON.x - 30, ICON.y - 30, 60, 60, 16) }]}
        progress={interpolate(f, [seconds(3.9), seconds(4.6)], [0, 1])}
      />

      <g transform={`translate(${x} ${y}) rotate(${spin}) scale(${scale}) translate(-16 -16)`}>
        <Sketch shapes={PLANE} progress={interpolate(f, [0, seconds(0.5)], [0, 1])} />
      </g>

      <text
        x={ICON.x}
        y={ICON.y + 48}
        textAnchor="middle"
        className={dim}
        style={enter(f, seconds(4.6))}
      >
        Telegram
      </text>

      {/* The agent turns up to watch. */}
      <g opacity={interpolate(f, [seconds(5), seconds(5.6)], [0, 1])}>
        <Avatar src={script.avatar} x={PHONE.x + PHONE.w + 14} y={PHONE.y + 196} size={42} />
      </g>

      <text x={300} y={104} className="fill-current text-[15px]" style={enter(f, seconds(4.4))}>
        {script.agentName} can reach you
      </text>
      <text x={300} y={126} className="fill-current text-[15px]" style={enter(f, seconds(4.6))}>
        where you already are.
      </text>
      <text x={300} y={162} className={dim} style={enter(f, seconds(5.4))}>
        Here is the whole setup, end to end.
      </text>
    </>
  );
}

function Intro({ f, script }: SceneProps) {
  const { agentName, avatar, summary } = script;
  // Carried over from the scene before, rather than drawn again.
  const draw = 1;

  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={draw} />
      <ChatHeader
        title={agentName}
        subtitle="bot"
        progress={interpolate(f, [seconds(1), seconds(1.8)], [0, 1])}
        avatar={
          <g opacity={interpolate(f, [seconds(1.2), seconds(1.8)], [0, 1])}>
            <Avatar src={avatar} x={PHONE.x + 32} y={PHONE.y + 16} size={24} />
          </g>
        }
      />

      <Thread
        f={f}
        lines={[
          { at: seconds(2.2), side: "left", text: summary },
          { at: seconds(4.4), side: "left", text: ["Two missed calls at 6pm."] },
        ]}
      />

      <text x={300} y={110} className="fill-current text-[15px]" style={enter(f, seconds(1))}>
        This is where {agentName}
      </text>
      <text x={300} y={132} className="fill-current text-[15px]" style={enter(f, seconds(1.2))}>
        ends up after every call.
      </text>
      <text x={300} y={168} className={dim} style={enter(f, seconds(4.6))}>
        Setting it up takes about a minute.
      </text>
    </>
  );
}

function BotFather({ f, script }: SceneProps) {
  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={1} />
      <ChatHeader
        title="BotFather"
        subtitle="bot"
        progress={1}
        avatar={
          <Sketch
            shapes={[
              { kind: "circle", x: PHONE.x + 44, y: PHONE.y + 28, d: 26 },
              { kind: "svg", d: plane(PHONE.x + 36, PHONE.y + 20, 16) },
            ]}
            progress={interpolate(f, [0, seconds(0.8)], [0, 1])}
          />
        }
      />

      <Thread
        f={f}
        lines={[
          { at: seconds(0.8), side: "right", text: ["/newbot"] },
          { at: seconds(2.2), side: "left", text: ["Alright. How are we", "going to call it?"] },
          { at: seconds(4.4), side: "right", text: [script.agentName] },
          { at: seconds(6), side: "left", text: ["Good. Now choose a", "username for it."] },
          { at: seconds(8), side: "right", text: [script.username] },
        ]}
      />

      <text x={300} y={104} className="fill-current text-[15px]" style={enter(f, seconds(2.6))}>
        Telegram only lets a
      </text>
      <text x={300} y={126} className="fill-current text-[15px]" style={enter(f, seconds(2.8))}>
        person create a bot.
      </text>
      <text x={300} y={162} className={dim} style={enter(f, seconds(5))}>
        A name, and a username. That is the
      </text>
      <text x={300} y={180} className={dim} style={enter(f, seconds(5.1))}>
        whole conversation.
      </text>
    </>
  );
}

function Token({ f }: SceneProps) {
  const shown = interpolate(f, [seconds(1.2), seconds(1.6)], [0, 1]);

  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={1} />
      <ChatHeader title="BotFather" subtitle="bot" progress={1} />

      <Thread
        f={f}
        lines={[{ at: 0, side: "left", text: ["Done! Congratulations on", "your new bot."] }]}
      />

      <g opacity={shown} transform={`translate(0 ${(1 - shown) * 10})`}>
        <Sketch
          shapes={[{ kind: "svg", d: bubble(SCREEN.x + 10, SCREEN.y + 74, 160, 54, "left") }]}
          progress={shown}
        />
        <text x={SCREEN.x + 19} y={SCREEN.y + 91} className={dim}>
          Use this token:
        </text>
        <text x={SCREEN.x + 19} y={SCREEN.y + 108} className={mono}>
          {typed("8478099275:", f, seconds(1.8))}
        </text>
        <text x={SCREEN.x + 19} y={SCREEN.y + 121} className={mono}>
          {typed("AAH8z3jZ4mWfAqPMz…", f, seconds(2.6))}
        </text>
      </g>

      <text x={300} y={110} className="fill-current text-[15px]" style={enter(f, seconds(3.4))}>
        Copy the token.
      </text>
      <text x={300} y={146} className={dim} style={enter(f, seconds(4))}>
        It is the bot&apos;s password, and the
      </text>
      <text x={300} y={164} className={dim} style={enter(f, seconds(4.1))}>
        only thing RiverVoice needs.
      </text>
    </>
  );
}

const appWindow: Shape[] = [
  { kind: "svg", d: box(300, 74, 274, 150, 12) },
  { kind: "line", x1: 300, y1: 104, x2: 574, y2: 104 },
  { kind: "svg", d: box(322, 136, 190, 30, 8) },
];

function Paste({ f, script }: SceneProps) {
  const fly = ease(interpolate(f, [seconds(1.4), seconds(2.6)], [0, 1]));
  const x = interpolate(fly, [0, 1], [SCREEN.x + 10, 322]);
  const y = interpolate(fly, [0, 1], [SCREEN.y + 74, 136]);
  const scale = interpolate(fly, [0, 1], [1, 0.9]);

  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={1} opacity={0.35} />
      <Sketch shapes={appWindow} progress={interpolate(f, [0, seconds(1.2)], [0, 1])} />

      <text x={316} y={95} className={dim}>
        RiverVoice — Message on Telegram
      </text>

      <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={fly < 1 ? 1 : 0}>
        <Sketch shapes={[{ kind: "svg", d: box(0, 0, 160, 34, 8) }]} progress={1} />
        <text x={12} y={22} className={mono}>
          8478099275:AAH8z3…
        </text>
      </g>

      <text
        x={334}
        y={156}
        className={mono}
        opacity={interpolate(f, [seconds(2.6), seconds(2.9)], [0, 1])}
      >
        ••••••••••••••••••
      </text>

      <Sketch
        shapes={[{ kind: "circle", x: 534, y: 151, d: 24 }]}
        progress={interpolate(f, [seconds(3), seconds(3.4)], [0, 1])}
      />
      <Sketch
        shapes={[
          {
            kind: "path",
            points: [
              [528, 151],
              [532, 156],
              [541, 145],
            ],
          },
        ]}
        progress={interpolate(f, [seconds(3.4), seconds(3.9)], [0, 1])}
      />

      <text x={322} y={196} className={body} style={enter(f, seconds(3.8))}>
        Connected as @{script.username}
      </text>

      <text x={300} y={250} className={dim} style={enter(f, seconds(4.8))}>
        Paste it once. RiverVoice can now speak as that bot.
      </text>
    </>
  );
}

const qr: Shape[] = [
  { kind: "svg", d: box(SCREEN.x + 34, SCREEN.y + 30, 110, 110, 6) },
  { kind: "svg", d: box(SCREEN.x + 46, SCREEN.y + 42, 26, 26, 3) },
  { kind: "svg", d: box(SCREEN.x + 106, SCREEN.y + 42, 26, 26, 3) },
  { kind: "svg", d: box(SCREEN.x + 46, SCREEN.y + 102, 26, 26, 3) },
];

function Scan({ f, script }: SceneProps) {
  const { avatar, group, username } = script;
  const swap = interpolate(f, [seconds(3.4), seconds(3.9)], [1, 0]);
  const list = interpolate(f, [seconds(4), seconds(4.6)], [0, 1]);
  const rows = [group, "Clinic ops", "Family"];

  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={1} />

      <g opacity={swap}>
        <ChatHeader title="Scan the code" subtitle="with your camera" progress={1} />
        <Sketch shapes={qr} progress={interpolate(f, [seconds(0.4), seconds(2.4)], [0, 1])} />
      </g>

      <g opacity={list}>
        <ChatHeader title="Select Chat" subtitle={`add ${username}`} progress={list} />
        {rows.map((row, i) => {
          const top = SCREEN.y + 16 + i * 44;
          const picked = i === 0 && f > seconds(6.4);
          return (
            <g
              key={row}
              opacity={interpolate(f, [seconds(4.4) + i * 6, seconds(4.9) + i * 6], [0, 1])}
            >
              <Sketch
                shapes={[
                  { kind: "circle", x: SCREEN.x + 26, y: top + 14, d: 26 },
                  ...(picked
                    ? [{ kind: "svg" as const, d: box(SCREEN.x + 4, top - 6, SCREEN.w - 8, 40, 8) }]
                    : []),
                ]}
                progress={1}
              />
              <text x={SCREEN.x + 50} y={top + 12} className={body}>
                {row}
              </text>
              <text x={SCREEN.x + 50} y={top + 24} className={dim}>
                {i === 0 ? "4 members" : "group"}
              </text>
            </g>
          );
        })}
      </g>

      <g opacity={interpolate(f, [seconds(7), seconds(7.6)], [0, 1])}>
        <Avatar src={avatar} x={SCREEN.x + 26} y={SCREEN.y + 22} size={22} />
      </g>

      <text x={300} y={110} className="fill-current text-[15px]" style={enter(f, seconds(0.8))}>
        Scan it, pick a group.
      </text>
      <text x={300} y={150} className={dim} style={enter(f, seconds(5))}>
        Telegram tells RiverVoice which group
      </text>
      <text x={300} y={168} className={dim} style={enter(f, seconds(5.1))}>
        it landed in. Nothing to copy.
      </text>
    </>
  );
}

function Deliver({ f, script }: SceneProps) {
  const { agentName, avatar, group, summary } = script;
  const arrive = ease(interpolate(f, [seconds(1.4), seconds(2.1)], [0, 1]));

  return (
    <>
      <Sketch shapes={phone(PHONE.x, PHONE.y, PHONE.w, PHONE.h)} progress={1} />
      <ChatHeader
        title={group}
        subtitle="4 members, 1 bot"
        progress={1}
        avatar={
          <Sketch
            shapes={[{ kind: "circle", x: PHONE.x + 44, y: PHONE.y + 28, d: 26 }]}
            progress={1}
          />
        }
      />

      <g opacity={arrive} transform={`translate(0 ${(1 - arrive) * 14})`}>
        <Avatar src={avatar} x={SCREEN.x + 4} y={SCREEN.y + 20} size={20} />
        <Sketch
          shapes={[{ kind: "svg", d: bubble(SCREEN.x + 30, SCREEN.y + 14, 148, 66, "left") }]}
          progress={arrive}
        />
        <text x={SCREEN.x + 39} y={SCREEN.y + 30} className={dim}>
          {agentName}
        </text>
        <text x={SCREEN.x + 39} y={SCREEN.y + 46} className={body}>
          {typed(summary[0], f, seconds(2.2))}
        </text>
        <text x={SCREEN.x + 39} y={SCREEN.y + 59} className={body}>
          {typed(summary[1], f, seconds(3))}
        </text>
        <text x={SCREEN.x + 39} y={SCREEN.y + 74} className={dim}>
          14:41
        </text>
        <Sketch
          shapes={ticks(SCREEN.x + 160, SCREEN.y + 71)}
          progress={interpolate(f, [seconds(4), seconds(4.4)], [0, 1])}
        />
      </g>

      <text x={300} y={110} className="fill-current text-[15px]" style={enter(f, seconds(2.6))}>
        Then it just happens.
      </text>
      <text x={300} y={150} className={dim} style={enter(f, seconds(4.4))}>
        Every call, in the group your team
      </text>
      <text x={300} y={168} className={dim} style={enter(f, seconds(4.5))}>
        already reads. Nobody has to ask.
      </text>
    </>
  );
}

export const telegramScenes: Scene<TelegramScript>[] = [
  { at: 0, length: seconds(6.5), caption: "Telegram, meet your agent", Body: Arrive },
  { at: seconds(6.5), length: seconds(7), caption: "Where your agent ends up", Body: Intro },
  {
    at: seconds(13.5),
    length: seconds(11),
    caption: "Create the bot in BotFather",
    Body: BotFather,
  },
  { at: seconds(24.5), length: seconds(7), caption: "Copy the token", Body: Token },
  { at: seconds(31.5), length: seconds(9), caption: "Paste it into RiverVoice", Body: Paste },
  { at: seconds(40.5), length: seconds(11), caption: "Scan, and pick a group", Body: Scan },
  { at: seconds(51.5), length: seconds(10), caption: "It posts after every call", Body: Deliver },
];
