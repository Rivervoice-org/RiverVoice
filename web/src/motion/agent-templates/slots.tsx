"use client";

import { box } from "@/motion/shapes";
import { ease, interpolate, seconds } from "@/motion/timeline";
import { Tally } from "@/motion/agent-templates/bots";
import { Caption, Card, Ink, Ring, Tick, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * "ఎప్పుడు కావాలి?" — the day as it already stands, and one of it taken.
 *
 * Staged as two columns: the day down the left, Tally standing to the right of
 * it. Nothing is offered that was not already free — it points at a time that
 * is on the sheet rather than producing one, which is the hard rule in this
 * template's instructions.
 */
export type SlotsScript = {
  slots: { at: string; free: boolean }[];
  /** Which one is taken — an index into slots. */
  chosen: number;
  /** Read back on the card, so it can be corrected. */
  slip: [string, string];
  captions: [string, string, string];
};

export const SLOTS_VIEW = VIEW;

const ROWS = [170, 214, 258, 302];
const LABEL = 108;
const MARK = 126;
const CARD = { x: 34, y: 368, w: 158, h: 74 };

const BOT = { x: 194, y: 296 };

const RING = seconds(0.7);
const OFFER = seconds(2.1);
const CIRCLE = seconds(3.5);
const WRITE = seconds(4.5);
const READ = seconds(5.6);
const RESET = seconds(7.4);

export const SLOTS_LENGTH = seconds(8.2);
/** Pointed at, written out, and read back. */
export const SLOTS_STILL = seconds(6.6);

export function Slots({ f, script }: { f: number; script: SlotsScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const slots = script.slots.slice(0, 4);
  const chosen = Math.min(Math.max(script.chosen, 0), slots.length - 1);

  const circled = ease(interpolate(f, [CIRCLE, CIRCLE + seconds(0.7)], [0, 1]));
  const card = interpolate(f, [WRITE, WRITE + seconds(0.6)], [0, 1]);
  const read = interpolate(f, [READ, READ + seconds(0.45)], [0, 1]);

  // The arm goes out to the row it is offering and comes back once written.
  const reach = ease(interpolate(f, [CIRCLE - seconds(0.5), CIRCLE], [0, 1]));
  const back = ease(interpolate(f, [WRITE, WRITE + seconds(0.4)], [0, 1]));

  return (
    <g>
      {/* The day, as it already stands */}
      <g opacity={gone}>
        <Ink d={`M${MARK + 14},152 V320`} w={1.4} o={0.22} />

        {slots.map((slot, i) => {
          const arrive = ease(
            interpolate(f, [seconds(0.2 + i * 0.13), seconds(0.8 + i * 0.13)], [0, 1]),
          );
          // Only the open ones stir, and only while they are being offered.
          const stir =
            slot.free && f >= OFFER && f < CIRCLE ? Math.sin((f - OFFER) / 5 + i * 1.7) * 1.2 : 0;

          return (
            <g key={slot.at} opacity={arrive} transform={`translate(${stir} 0)`}>
              <text
                x={LABEL}
                y={ROWS[i] + 4}
                textAnchor="end"
                className={text.body}
                opacity={slot.free ? 0.92 : 0.32}
              >
                {slot.at}
              </text>
              {slot.free ? (
                <circle
                  cx={MARK}
                  cy={ROWS[i]}
                  r={4.4}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  opacity={0.85}
                />
              ) : (
                <Ink d={`M${MARK - 6},${ROWS[i]} H${MARK + 6}`} w={1.6} o={0.3} />
              )}
            </g>
          );
        })}

        <Ink d={box(48, ROWS[chosen] - 18, 94, 36, 18)} t={circled} w={2.1} />
      </g>

      {/* Written out, and read back so it can be corrected */}
      <g opacity={gone}>
        <Card {...CARD} t={card}>
          <text x={CARD.x + 18} y={CARD.y + 30} className={text.strong}>
            {script.slip[0]}
          </text>
          <text x={CARD.x + 18} y={CARD.y + 52} className={text.small} opacity={0.62}>
            {script.slip[1]}
          </text>
          <Tick x={CARD.x + CARD.w - 34} y={CARD.y + 34} t={read} />
        </Card>
      </g>

      <Ring f={f} at={RING} x={BOT.x} y={BOT.y - 26} fade={gone} />

      <g opacity={gone}>
        <Tally
          x={BOT.x}
          y={BOT.y}
          size={1.05}
          blink={f % 96 < 4 ? 0.1 : 1}
          talk={f >= OFFER && f < CIRCLE ? Math.abs(Math.sin(f * 0.5)) * 0.8 : 0}
          smile={interpolate(f, [READ, READ + seconds(0.5)], [0, 1])}
          tilt={f >= WRITE ? 0 : -2}
          reach={Math.max(0, reach - back)}
        />
      </g>

      <Caption f={f} at={[0, OFFER, READ]} lines={script.captions} y={500} fade={gone} />
    </g>
  );
}
