"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "After six" — the same desk, answering two different ways.
 *
 * A call comes in while the sign says open and gets an answer straight back.
 * The sign turns. The next call gets no answer at all — it gets a note, written
 * down and left on the spike for the morning.
 *
 * One object changes, and the behaviour around it changes with it. That is the
 * whole of what a front desk does, and the only thing worth drawing.
 */
export type FrontDeskScript = {
  /** What the sign says, before and after. */
  sign: [string, string];
  /** The answer given while it is still open. */
  answer: string;
  /** Who called, on what number, about what. */
  note: [string, string, string];
  captions: [string, string, string];
};

export const FRONTDESK_VIEW = { w: 240, h: 560 };

const WIRE = 96;
const SIGN = { x: 150, y: 132, w: 92, h: 40 };
const DESK = 486;
const SPIKE = { x: 150, y: DESK };

const FACE = { x: 54, y: 448, r: 28 };

/* Beats: a call in hours, the turn, and a call after. */

const CALL1 = seconds(0.9);
const ANSWER = seconds(1.6);
const ANSWER_GONE = seconds(3.0);
const TURN = seconds(3.2);
const CAP2 = seconds(3.2);
const CALL2 = seconds(4.2);
const WRITE = [seconds(4.8), seconds(5.5), seconds(6.2)];
const SPIKED = seconds(7.0);
const CAP3 = seconds(7.0);
const RESET = seconds(8.4);

export const FRONTDESK_LENGTH = seconds(9.0);
/** Shut, with the message written and left on the spike. */
export const FRONTDESK_STILL = seconds(7.8);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const signText = "fill-current text-[13px] font-medium [font-family:var(--font-sans)]";
const noteText = "fill-current text-[9px] [font-family:var(--font-sans)]";
const answerText = "fill-current text-[10px] [font-family:var(--font-sans)]";

/** Rounded, with the tail rounded into it rather than a spike off the corner. */
function bubble(w: number, y: number) {
  return `${box(14, y, w, 26, 10)} M34,${y + 26} Q31,${y + 34} 40,${y + 33} Q44,${y + 30} 44,${y + 26}`;
}

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

/** One ripple off the door, for a call arriving. */
function Ring({ f, at }: { f: number; at: number }) {
  return (
    <>
      {[0, 1].map((i) => {
        const t = interpolate(f, [at + i * seconds(0.14), at + seconds(0.9)], [0, 1]);
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
            opacity={0.32 * (1 - t)}
          />
        );
      })}
    </>
  );
}

export function FrontDesk({ f, script }: { f: number; script: FrontDeskScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  /* The sign turns once, and everything after it behaves differently. */
  const turning = interpolate(f, [TURN, TURN + seconds(0.6)], [0, 1]);
  const shut = turning >= 0.5;
  const edge = turning < 0.5 ? turning * 2 : (1 - turning) * 2;
  const swing = Math.sin(f / 26) * 1.6 + Math.sin(Math.PI * turning) * 5;

  /* In hours: the answer goes straight back. */
  const answerShow = Math.min(
    interpolate(f, [ANSWER, ANSWER + seconds(0.3)], [0, 1]),
    1 - interpolate(f, [ANSWER_GONE, ANSWER_GONE + seconds(0.3)], [0, 1]),
  );

  /* After: a note, written a line at a time, then left on the spike. */
  const written = WRITE.filter((at) => f >= at + seconds(0.3)).length;
  const noteIn = interpolate(f, [CALL2 + seconds(0.3), CALL2 + seconds(0.9)], [0, 1]);
  const spiked = out(interpolate(f, [SPIKED, SPIKED + seconds(0.6)], [0, 1]));
  const noteY = 300 + spiked * (DESK - 328);

  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capAt = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);
  const nod = Math.sin(Math.PI * interpolate(f, [SPIKED, SPIKED + seconds(0.5)], [0, 1])) * 2;
  // Looks up at the sign as it turns, down at the note while writing.
  const look = f >= CALL2 ? 4 : f >= TURN ? -8 : -2;

  return (
    <g>
      <text
        x={120}
        y={62}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* The sign, hung from two strings, turning once */}
      <g opacity={gone}>
        <S d={`M${SIGN.x - 26},${WIRE} L${SIGN.x - 22},${SIGN.y - SIGN.h / 2}`} w={1.2} o={0.5} />
        <S d={`M${SIGN.x + 26},${WIRE} L${SIGN.x + 22},${SIGN.y - SIGN.h / 2}`} w={1.2} o={0.5} />

        <g transform={`translate(${SIGN.x} ${SIGN.y}) rotate(${swing})`}>
          <g transform={`scale(${Math.max(0.05, 1 - edge)} 1)`}>
            <path
              d={box(-SIGN.w / 2, -SIGN.h / 2, SIGN.w, SIGN.h, 12)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
            />
            <text x={0} y={5} textAnchor="middle" className={signText} opacity={shut ? 0.55 : 1}>
              {script.sign[shut ? 1 : 0]}
            </text>
          </g>
        </g>
      </g>

      {/* Two calls: one answered, one written down */}
      <g opacity={gone}>
        <Ring f={f} at={CALL1} />
        <Ring f={f} at={CALL2} />
      </g>

      {/* In hours, the answer goes straight back */}
      {answerShow > 0 ? (
        <g opacity={answerShow * gone} transform={`translate(0 ${(1 - answerShow) * 4})`}>
          <path
            d={bubble(Math.min(212, 20 + script.answer.length * 6.2), 232)}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <text x={24} y={249} className={answerText}>
            {script.answer}
          </text>
        </g>
      ) : null}

      {/* After, a note instead — written a line at a time */}
      {noteIn > 0 ? (
        <g
          opacity={noteIn * gone}
          transform={`translate(${SPIKE.x} ${noteY}) rotate(${-4 + spiked * 6})`}
        >
          <path d={box(-38, -30, 76, 61, 9)} fill="none" stroke="currentColor" strokeWidth={2} />
          {script.note.map((line, i) => {
            const at = WRITE[i];
            const on = interpolate(f, [at, at + seconds(0.3)], [0, 1]);
            return (
              <g key={line}>
                <path
                  d={`M-28,${-12 + i * 18} L28,${-12.4 + i * 18}`}
                  stroke="currentColor"
                  strokeWidth={1}
                  opacity={i < written ? 0.28 : 0.14}
                />
                {on > 0 ? (
                  <text
                    x={-28}
                    y={-15 + i * 18}
                    className={noteText}
                    textLength={Math.max(1, on * (line.length * 4.6))}
                    lengthAdjust="spacingAndGlyphs"
                  >
                    {line}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ) : null}

      {/* The desk, and the spike the note is left on */}
      <g opacity={gone}>
        <S d={`M14,${DESK} L226,${DESK}`} w={2.8} />
        <S d={`M18,${DESK + 5} L222,${DESK + 4}`} w={1.2} o={0.4} />
        <S d={`M${SPIKE.x},${DESK} L${SPIKE.x},${DESK - 26}`} w={1.6} o={0.6} />
      </g>

      {/* Aarav, on the desk either way */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        <S d="M28,482 Q54,488 80,482" />
        <S d="M28,482 L26,506" />
        <S d="M80,482 L82,506" />

        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={look} />
      </g>
    </g>
  );
}
