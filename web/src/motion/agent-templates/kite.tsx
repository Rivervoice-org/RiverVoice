"use client";

import { box } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";
import { Chhaan } from "@/motion/agent-templates/bots";
import { Caption, Card, Ink, Tick, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * Three questions, and only then a handover.
 *
 * Staged as a staircase going down and to the right, because that is what
 * qualifying is: each answer is a step you cannot skip. Kona watches from the
 * top of the flight. The callback is only booked once all three are down —
 * a lead qualified rather than a lead pitched at.
 */
export type KiteScript = {
  /** The three it always asks. */
  questions: string[];
  /** When sales calls back. */
  tag: string;
  captions: [string, string, string];
};

export const KITE_VIEW = VIEW;

const STEPS = [
  { x: 28, y: 164 },
  { x: 48, y: 232 },
  { x: 68, y: 300 },
];
const STEP_W = 150;
const STEP_H = 52;
const BOOKED = { x: 42, y: 388, w: 158, h: 64 };

const BOT = { x: 196, y: 96 };

const FIRST = seconds(1.4);
const GAP = seconds(1.3);
const BOOK = seconds(5.5);
const TICK = seconds(6.3);
const RESET = seconds(8.0);

export const KITE_LENGTH = seconds(8.8);
/** All three answered, and the callback booked. */
export const KITE_STILL = seconds(7.2);

/** Two lines at most — a third means the question is too long to be asked. */
function wrap(line: string, at = 19): string[] {
  const out: string[] = [""];
  for (const word of line.split(" ")) {
    const i = out.length - 1;
    if (out[i] && `${out[i]} ${word}`.length > at) out.push(word);
    else out[i] = out[i] ? `${out[i]} ${word}` : word;
  }
  return out.slice(0, 2);
}

export function Kite({ f, script }: { f: number; script: KiteScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const questions = script.questions.slice(0, 3);

  const booked = interpolate(f, [BOOK, BOOK + seconds(0.6)], [0, 1]);
  const tick = interpolate(f, [TICK, TICK + seconds(0.45)], [0, 1]);
  const answered = Math.max(0, Math.min(3, Math.floor((f - FIRST) / GAP) + 1));

  return (
    <g>
      <Caption f={f} at={[0, FIRST, BOOK]} lines={script.captions} y={506} fade={gone} />

      {/* The flight, drawn before anything is asked — it always asks these three */}
      <g opacity={gone}>
        {STEPS.map((step, i) => {
          const drawn = ease(
            interpolate(f, [seconds(0.2 + i * 0.18), seconds(0.9 + i * 0.18)], [0, 1]),
          );
          const asked = ease(
            interpolate(f, [FIRST + GAP * i, FIRST + GAP * i + seconds(0.4)], [0, 1]),
          );
          const mark = interpolate(
            f,
            [FIRST + GAP * i + seconds(0.5), FIRST + GAP * i + seconds(0.95)],
            [0, 1],
          );

          return (
            <g key={step.y}>
              {/* The riser, joining this step to the one above */}
              {i > 0 ? (
                <Ink
                  d={`M${STEPS[i - 1].x + 18},${STEPS[i - 1].y + STEP_H} V${step.y} H${step.x + 18}`}
                  t={drawn}
                  w={1.6}
                  o={0.25}
                />
              ) : null}

              <Ink
                d={box(step.x, step.y, STEP_W, STEP_H, 12)}
                t={drawn}
                w={2.1}
                o={0.35 + asked * 0.6}
              />
              <Tick x={step.x + STEP_W - 30} y={step.y + STEP_H / 2 - 5} t={mark} />

              {wrap(questions[i] ?? "").map((line, n) => (
                <text
                  key={line}
                  x={step.x + 16}
                  y={step.y + 22 + n * 15}
                  className={text.small}
                  opacity={(0.34 + asked * 0.58) * 1}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </g>

      {/* Only once all three are down */}
      <g opacity={gone}>
        <Card {...BOOKED} t={booked}>
          <text x={BOOKED.x + 18} y={BOOKED.y + 26} className={text.small} opacity={0.6}>
            {`Qualified · ${answered}/3`}
          </text>
          <text x={BOOKED.x + 18} y={BOOKED.y + 48} className={text.strong}>
            {script.tag}
          </text>
          <Tick x={BOOKED.x + BOOKED.w - 34} y={BOOKED.y + 30} t={tick} />
        </Card>
      </g>

      <g opacity={gone}>
        <Chhaan
          x={BOT.x}
          y={BOT.y}
          size={0.82}
          blink={f % 88 < 4 ? 0.1 : 1}
          talk={f >= FIRST && f < BOOK ? Math.abs(Math.sin(f * 0.42)) * 0.75 : 0}
          smile={interpolate(f, [BOOK, BOOK + seconds(0.6)], [0, 1])}
          // Leans down the flight while asking, upright once it has what it needs.
          tilt={f >= BOOK ? 0 : -6}
          // The one that made it through all three, coming out the bottom.
          drop={interpolate(f, [BOOK - seconds(0.3), BOOK + seconds(0.7)], [0, 1])}
        />
      </g>
    </g>
  );
}
