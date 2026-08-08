"use client";

import { ease, interpolate, seconds } from "@/motion/timeline";
import { Chaabi } from "@/motion/agent-templates/bots";
import { Caption, Card, Ink, Tick, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * "क्या इसे बढ़ा दूँ?" — wound for another year.
 *
 * A wind-up, because that is what a renewal actually is: the thing runs down on
 * its own and somebody has to turn the key before it stops. The year fills as a
 * band of months across the panel, Chaabi sags a little further with each one,
 * and the ask lands while there is still a turn left in it — not after.
 */
export type ThreadScript = {
  /** The date it runs out. */
  ends: string;
  /** The one question. */
  ask: string;
  /** What it says afterwards. */
  extended: string;
  captions: [string, string, string];
};

export const THREAD_VIEW = VIEW;

const MONTHS = 12;
const BAND = { y: 168, from: 40, to: 220 };
const STEP = (BAND.to - BAND.from) / (MONTHS - 1);

const ASK = { x: 40, y: 232, w: 180, h: 54 };
const NOW = { x: 48, y: 232, w: 164, h: 54 };

const BOT = { x: 118, y: 372 };
const FLOOR = 434;

const FILL = seconds(0.7);
const ENDS = seconds(3.3);
const ASKED = seconds(3.9);
const WIND = seconds(5.1);
const TURNS = seconds(0.9);
const NEW = WIND + TURNS;
const RESET = seconds(7.9);

export const THREAD_LENGTH = seconds(8.6);
/** Wound back up, and dated a year on. */
export const THREAD_STILL = seconds(7.0);

export function Thread({ f, script }: { f: number; script: ThreadScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  // The year filling up, and the spring running down with it.
  const used = interpolate(f, [FILL, ENDS], [0, MONTHS]);
  const rewound = ease(interpolate(f, [WIND, NEW], [0, 1]));
  const wound = Math.max(0.1, 1 - used / MONTHS) + rewound * (used / MONTHS);
  // Three full turns, so it plainly takes winding rather than a nudge.
  const turn = rewound * 1080;

  const ask = interpolate(f, [ASKED, ASKED + seconds(0.5)], [0, 1]);
  const now = interpolate(f, [NEW, NEW + seconds(0.5)], [0, 1]);
  const tick = interpolate(f, [NEW + seconds(0.5), NEW + seconds(0.95)], [0, 1]);

  return (
    <g>
      <Caption f={f} at={[0, ENDS, NEW]} lines={script.captions} fade={gone} />

      {/* The year, a month at a time. After winding it is a fresh band. */}
      <g opacity={gone}>
        <Ink d={`M${BAND.from - 8},${BAND.y} H${BAND.to + 8}`} w={1.4} o={0.22} />

        {Array.from({ length: MONTHS }, (_, i) => {
          const x = BAND.from + i * STEP;
          const spent = rewound > 0.5 ? 0 : Math.max(0, Math.min(1, used - i));
          const last = i === MONTHS - 1;

          return (
            <g key={x}>
              <Ink
                d={`M${x},${BAND.y - (last ? 13 : 9)} V${BAND.y + (last ? 13 : 9)}`}
                w={last ? 2.6 : 2}
                o={0.18 + spent * 0.72}
              />
            </g>
          );
        })}

        {/* Named only at the end of the band — the date it stops */}
        <text
          x={BAND.to}
          y={BAND.y + 32}
          textAnchor="end"
          className={text.small}
          opacity={
            (rewound > 0.5 ? 0.3 : interpolate(f, [ENDS, ENDS + seconds(0.4)], [0, 0.9])) * 1
          }
        >
          {script.ends}
        </text>
      </g>

      {/* Asked while there is still a turn left in it */}
      <g opacity={gone}>
        {now > 0 ? (
          <>
            <Card {...NOW} t={now}>
              <text
                x={NOW.x + NOW.w / 2}
                y={NOW.y + 33}
                textAnchor="middle"
                className={text.strong}
              >
                {script.extended}
              </text>
            </Card>
            <Tick x={NOW.x + NOW.w - 2} y={NOW.y + 22} t={tick} />
          </>
        ) : (
          <Card {...ASK} t={ask}>
            <text x={ASK.x + ASK.w / 2} y={ASK.y + 33} textAnchor="middle" className={text.body}>
              {script.ask}
            </text>
          </Card>
        )}
      </g>

      {/* The turn itself */}
      <g opacity={gone}>
        <Chaabi
          x={BOT.x}
          y={BOT.y}
          size={1.3}
          wound={wound}
          turn={turn}
          blink={f % 94 < 4 ? 0.1 : 1}
          talk={f >= ASKED && f < ASKED + seconds(1.1) ? Math.abs(Math.sin(f * 0.5)) * 0.8 : 0}
          smile={interpolate(f, [NEW, NEW + seconds(0.6)], [0, 1])}
        />
        <Ink d={`M28,${FLOOR} H232`} w={2.4} o={0.6} />
        <Ink d={`M36,${FLOOR + 5} H224`} w={1.1} o={0.24} />
      </g>
    </g>
  );
}
