"use client";

import { box } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";
import { Bell } from "@/motion/agent-templates/bots";
import { Caption, Card, Ink, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * "छह बजे तक खुला है" — the desk that is still there after six.
 *
 * Staged head-on: the sign above, Bell behind the counter, and the slip written
 * on the counter itself. A call during hours gets answered outright; the sign
 * turns over, the same call comes after hours, and the details are taken down
 * instead of missed.
 */
export type FrontDeskScript = {
  /** Open, then closed. */
  sign: [string, string];
  /** Answered outright, while the desk is open. */
  answer: string;
  /** Taken down after hours: name, number, what they wanted. */
  note: [string, string, string];
  captions: [string, string, string];
};

export const FRONTDESK_VIEW = VIEW;

const SIGN = { x: 80, y: 84, w: 100, h: 46 };
const SAID = { x: 34, y: 172, w: 192, h: 60 };
const SLIP = { x: 58, y: 396, w: 144, h: 78 };

const COUNTER = 376;
const BOT = { x: 130, y: 300 };

const RING = seconds(0.6);
const ANSWER = seconds(1.5);
const FLIP = seconds(3.3);
const NOTED = seconds(4.6);
const TICK = seconds(5.8);
const RESET = seconds(7.6);

export const FRONTDESK_LENGTH = seconds(8.4);
/** The slip taken and read back, with the sign already turned. */
export const FRONTDESK_STILL = seconds(6.8);

export function FrontDesk({ f, script }: { f: number; script: FrontDeskScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  const hung = ease(interpolate(f, [seconds(0.2), seconds(1)], [0, 1]));
  const said = interpolate(f, [ANSWER, ANSWER + seconds(0.5)], [0, 1]);
  // Turned over on its string rather than swapped, so it is plainly one sign.
  const turn = interpolate(f, [FLIP, FLIP + seconds(0.7)], [0, 1]);
  const closed = turn > 0.5;
  const edgeOn = Math.abs(Math.cos(Math.PI * turn));
  const slip = interpolate(f, [NOTED, NOTED + seconds(0.6)], [0, 1]);

  const ring = Math.max(
    interpolate(f, [RING, RING + seconds(0.9)], [1, 0]),
    interpolate(f, [FLIP + seconds(0.8), FLIP + seconds(1.7)], [1, 0]) *
      (f >= FLIP + seconds(0.8) ? 1 : 0),
  );

  return (
    <g>
      <Caption f={f} at={[0, FLIP, TICK]} lines={script.captions} y={524} fade={gone} />

      {/* The sign, on its strings */}
      <g opacity={gone}>
        <Ink d={`M${SIGN.x + 24},${SIGN.y - 20} l5,20`} t={hung} w={1.5} o={0.45} />
        <Ink d={`M${SIGN.x + SIGN.w - 24},${SIGN.y - 20} l-5,20`} t={hung} w={1.5} o={0.45} />
        <g
          transform={`translate(${SIGN.x + SIGN.w / 2} 0) scale(${Math.max(0.04, edgeOn)} 1) translate(${-(SIGN.x + SIGN.w / 2)} 0)`}
        >
          <Ink d={box(SIGN.x, SIGN.y, SIGN.w, SIGN.h, 10)} t={hung} w={2.2} />
          <text
            x={SIGN.x + SIGN.w / 2}
            y={SIGN.y + 29}
            textAnchor="middle"
            className={text.strong}
            opacity={hung * (closed ? 0.5 : 1)}
          >
            {closed ? script.sign[1] : script.sign[0]}
          </text>
        </g>
      </g>

      {/* Answered outright, while the desk is open */}
      {!closed ? (
        <g opacity={gone}>
          <Card {...SAID} t={said}>
            <text x={SAID.x + 16} y={SAID.y + 25} className={text.body}>
              {script.answer.slice(0, 22)}
            </text>
            <text x={SAID.x + 16} y={SAID.y + 45} className={text.body}>
              {script.answer.slice(22)}
            </text>
          </Card>
        </g>
      ) : null}

      <g opacity={gone}>
        <Bell
          x={BOT.x}
          y={BOT.y}
          size={1.15}
          blink={f % 104 < 4 ? 0.1 : 1}
          talk={f >= ANSWER && f < ANSWER + seconds(1.3) ? Math.abs(Math.sin(f * 0.5)) * 0.85 : 0}
          smile={interpolate(f, [TICK, TICK + seconds(0.5)], [0, 1])}
          ring={ring}
        />

        {/* The counter, in front — the desk is what you are standing at */}
        <Ink d={`M20,${COUNTER} H240`} w={2.7} o={0.85} />
        <Ink d={`M26,${COUNTER + 7} H234`} w={1.2} o={0.28} />
        <Ink d={`M34,${COUNTER + 7} V520`} w={2} o={0.35} />
        <Ink d={`M226,${COUNTER + 7} V520`} w={2} o={0.35} />

        {/* Written on the counter, after hours */}
        {closed ? (
          <Card {...SLIP} t={slip}>
            {script.note.map((line, i) => (
              <text
                key={line}
                x={SLIP.x + 16}
                y={SLIP.y + 26 + i * 21}
                className={i === 0 ? text.strong : text.small}
                opacity={i === 0 ? 1 : 0.66}
              >
                {line}
              </text>
            ))}
          </Card>
        ) : null}
      </g>
    </g>
  );
}
