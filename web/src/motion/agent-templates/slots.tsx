"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "రెండు ఖాళీలు ఉన్నాయి" — the two nearest, and one of them taken.
 *
 * A day's slots hang in a column, two of them free. A call lands, the free ones
 * breathe, one gets a line drawn round it, and a slip is written out and read
 * back. Nothing is invented and nothing is offered that was not already open —
 * which is the one hard rule in this template's instructions.
 */
export type SlotsScript = {
  /** The day's times, and whether each is still free. */
  slots: { at: string; free: boolean }[];
  /** Which one is taken — an index into slots. */
  chosen: number;
  /** Read back on the slip, so it can be corrected. */
  slip: [string, string];
  captions: [string, string, string];
};

export const SLOTS_VIEW = { w: 240, h: 560 };

const ROWS = [156, 206, 256, 306];
const MARK_X = 180;
const SLIP = { x: 62, y: 360, w: 132, h: 62 };

const FACE = { x: 52, y: 470, r: 28 };
const DESK = 508;

/* Beats. */

const CALL = seconds(0.9);
const OFFER = seconds(2.0);
const CIRCLE = seconds(3.6);
const WRITE = seconds(4.6);
const READ = seconds(5.6);
const CAP2 = seconds(2.0);
const CAP3 = seconds(5.6);
const RESET = seconds(7.4);

export const SLOTS_LENGTH = seconds(8.0);
/** Circled, written out, and read back. */
export const SLOTS_STILL = seconds(6.6);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const timeText = "fill-current text-[12px] [font-family:var(--font-sans)]";
const slipText = "fill-current text-[11px] font-medium [font-family:var(--font-sans)]";

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

export function Slots({ f, script }: { f: number; script: SlotsScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const slots = script.slots.slice(0, 4);
  const chosen = Math.min(script.chosen, slots.length - 1);

  const circled = out(interpolate(f, [CIRCLE, CIRCLE + seconds(0.7)], [0, 1]));
  const written = out(interpolate(f, [WRITE, WRITE + seconds(0.5)], [0, 1]));
  const read = interpolate(f, [READ, READ + seconds(0.5)], [0, 1]);

  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capAt = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);
  const nod = Math.sin(Math.PI * interpolate(f, [READ, READ + seconds(0.5)], [0, 1])) * 2;
  // Looks down the column while offering, then at the slip once it is written.
  const look = f >= WRITE ? 3 : f >= OFFER ? -5 : -2;

  return (
    <g>
      <text
        x={120}
        y={68}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* The day, as it already stands — nothing here is invented later */}
      {slots.map((slot, i) => {
        // Only the free ones stir, and only once they are being offered.
        const breathing =
          slot.free && f >= OFFER && f < CIRCLE ? Math.sin((f - OFFER) / 5 + i) * 1.2 : 0;

        return (
          <g key={slot.at} opacity={gone} transform={`translate(0 ${breathing})`}>
            <text
              x={MARK_X - 22}
              y={ROWS[i] + 4}
              textAnchor="end"
              className={timeText}
              opacity={slot.free ? 0.9 : 0.35}
            >
              {slot.at}
            </text>
            {slot.free ? (
              <circle
                cx={MARK_X}
                cy={ROWS[i]}
                r={4}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                opacity={0.8}
              />
            ) : (
              <S d={`M${MARK_X - 6},${ROWS[i]} L${MARK_X + 6},${ROWS[i]}`} w={1.6} o={0.3} />
            )}
          </g>
        );
      })}

      {/* Drawn round the one they picked */}
      {circled > 0 ? (
        <path
          d={box(56, ROWS[chosen] - 18, 148, 36, 18)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - circled}
          opacity={gone}
        />
      ) : null}

      {/* Written out, and read back so it can be corrected */}
      {written > 0 ? (
        <g
          opacity={written * gone}
          transform={`translate(0 ${(1 - written) * -6}) rotate(${-2 + written * 3} ${SLIP.x + SLIP.w / 2} ${SLIP.y})`}
        >
          <path
            d={box(SLIP.x, SLIP.y, SLIP.w, SLIP.h, 10)}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          />
          <text x={SLIP.x + 18} y={SLIP.y + 26} className={slipText}>
            {script.slip[0]}
          </text>
          <text x={SLIP.x + 18} y={SLIP.y + 46} className={captionText} opacity={0.6}>
            {script.slip[1]}
          </text>

          {read > 0 ? (
            <path
              d={`M${SLIP.x + SLIP.w - 34},${SLIP.y + 30} l5,6 l11,-12`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - read}
            />
          ) : null}
        </g>
      ) : null}

      {/* The call landing */}
      {[0, 1].map((i) => {
        const t = interpolate(f, [CALL + i * seconds(0.14), CALL + seconds(0.9)], [0, 1]);
        if (t <= 0 || t >= 1) return null;
        return (
          <circle
            key={i}
            cx={FACE.x + FACE.r - 2}
            cy={FACE.y - 10}
            r={8 + t * 38}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            opacity={0.32 * (1 - t) * gone}
          />
        );
      })}

      {/* Meera, at the book */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        <S d={`M14,${DESK} L226,${DESK}`} w={2.8} o={0.8} />
        <S d={`M18,${DESK + 5} L222,${DESK + 4}`} w={1.2} o={0.35} />

        <S d="M26,504 Q52,510 78,504" />
        <S d="M26,504 L24,508" />
        <S d="M78,504 L80,508" />

        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={look} />
      </g>
    </g>
  );
}
