"use client";

import { Face } from "@/motion/agent-templates/face";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "ஒவ்வொன்றாக" — a ledger, ruled off a line at a time.
 *
 * The page hangs open with what is owed on it. A call lands, one entry gets a
 * line drawn through it, and the balance underneath rewrites downward. Three
 * times, unhurried, and the page is clear.
 *
 * Nobody is pursued here. The only thing that moves is the ledger, and the
 * agent stays where she is — which is the difference between a reminder and a
 * chase, and the rule this template is written under.
 */
export type KhataScript = {
  /** What is owed, one line each: when, and how much. */
  entries: [string, string, string];
  /** The running balance, from the opening figure down to nothing. */
  balance: [string, string, string, string];
  /** Stamped across the page once it is clear. */
  cleared: string;
  captions: [string, string, string];
};

export const KHATA_VIEW = { w: 240, h: 560 };

const PAGE = { x: 42, y: 108, w: 158, h: 244 };
const ROWS = [PAGE.y + 62, PAGE.y + 108, PAGE.y + 154];
const RULE = PAGE.y + 186;
const BALANCE_Y = PAGE.y + 218;

const FACE = { x: 54, y: 452, r: 28 };
const DESK = 486;

/* Beats: three calls, and nothing in between them but waiting. */

const CALLS = [seconds(1.2), seconds(3.2), seconds(5.2)];
const STRIKE = seconds(0.45);
const CLEARED = seconds(6.6);
const CAP2 = seconds(1.2);
const CAP3 = seconds(6.6);
const RESET = seconds(8.0);

export const KHATA_LENGTH = seconds(8.6);
/** Every line ruled off and the page stamped. */
export const KHATA_STILL = seconds(7.4);

const out = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

const captionText = "fill-current text-[11px] [font-family:var(--font-sans)]";
const entryText = "fill-current text-[10px] [font-family:var(--font-sans)]";
const balanceText = "fill-current text-[15px] font-medium [font-family:var(--font-sans)]";
const stampText =
  "fill-current text-[11px] font-medium tracking-[0.08em] [font-family:var(--font-sans)]";

const S = ({ d, w = 2.6, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

export function Khata({ f, script }: { f: number; script: KhataScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  /* The page arrives, then only its contents change. */
  const arriving = out(interpolate(f, [seconds(0.3), seconds(0.9)], [0, 1]));
  const pageY = -30 + arriving * (PAGE.y + 30);
  const settle = Math.sin(f / 34) * 0.5;

  /* One entry ruled off per call, and the balance follows it down. */
  const settled = CALLS.filter((at) => f >= at + STRIKE).length;
  const lastAt = CALLS[settled - 1];
  const pop =
    lastAt !== undefined && f - lastAt - STRIKE < seconds(0.14)
      ? Math.sin(Math.PI * ((f - lastAt - STRIKE) / seconds(0.14))) * 0.07
      : 0;

  const stamped = out(interpolate(f, [CLEARED, CLEARED + seconds(0.5)], [0, 1]));

  const capIndex = f >= CAP3 ? 2 : f >= CAP2 ? 1 : 0;
  const capAt = f >= CAP3 ? CAP3 : f >= CAP2 ? CAP2 : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const arrive = interpolate(f, [0, seconds(0.5)], [0, 1]);
  const nod = Math.sin(Math.PI * interpolate(f, [CLEARED, CLEARED + seconds(0.5)], [0, 1])) * 2;

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

      {/* The khata */}
      <g
        opacity={arriving * gone}
        transform={`translate(0 ${pageY - PAGE.y}) rotate(${settle} 120 ${PAGE.y})`}
      >
        <path
          d={box(PAGE.x, PAGE.y, PAGE.w, PAGE.h, 10)}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        />
        {/* A binding down the near edge, so it reads as a book not a card */}
        <S
          d={`M${PAGE.x + 13},${PAGE.y + 10} L${PAGE.x + 13},${PAGE.y + PAGE.h - 10}`}
          w={1.1}
          o={0.35}
        />

        {script.entries.map((entry, i) => {
          const at = CALLS[i];
          const struck = interpolate(f, [at, at + STRIKE], [0, 1]);
          const done = f >= at + STRIKE;

          return (
            <g key={entry} opacity={done ? 0.45 : 0.9}>
              <text x={PAGE.x + 26} y={ROWS[i]} className={entryText}>
                {entry}
              </text>
              {/* Ruled off by hand, left to right */}
              {struck > 0 ? (
                <path
                  d={`M${PAGE.x + 22},${ROWS[i] - 4} L${PAGE.x + PAGE.w - 22},${ROWS[i] - 5}`}
                  stroke="currentColor"
                  strokeWidth={1.6}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeDashoffset={1 - struck}
                />
              ) : null}
            </g>
          );
        })}

        <S d={`M${PAGE.x + 22},${RULE} L${PAGE.x + PAGE.w - 22},${RULE}`} w={1.2} o={0.4} />

        {/* What is left, rewritten as each line goes */}
        <g transform={`translate(${PAGE.x + PAGE.w - 26} ${BALANCE_Y}) scale(${1 + pop})`}>
          <text x={0} y={0} textAnchor="end" className={balanceText}>
            {script.balance[Math.min(settled, script.balance.length - 1)]}
          </text>
        </g>

        {/* Stamped across it, tilted, once there is nothing left */}
        {stamped > 0 ? (
          <g
            opacity={stamped}
            transform={`translate(${PAGE.x + 34} ${PAGE.y + PAGE.h - 44}) rotate(-8) scale(${0.92 + stamped * 0.08})`}
          >
            <path
              d={box(0, 0, 92, 30, 8)}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              opacity={0.75}
            />
            <text x={46} y={20} textAnchor="middle" className={stampText} opacity={0.8}>
              {script.cleared}
            </text>
          </g>
        ) : null}
      </g>

      {/* A call landing, once per entry — and nothing in between */}
      {CALLS.map((at) =>
        [0, 1].map((i) => {
          const t = interpolate(
            f,
            [at - seconds(0.5) + i * seconds(0.14), at + seconds(0.4)],
            [0, 1],
          );
          if (t <= 0 || t >= 1) return null;
          return (
            <circle
              key={`${at}-${i}`}
              cx={FACE.x + FACE.r - 2}
              cy={FACE.y - 10}
              r={8 + t * 36}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              opacity={0.3 * (1 - t) * gone}
            />
          );
        }),
      )}

      {/* Priya, who does not move from her desk */}
      <g opacity={arrive * gone} transform={`translate(0 ${(1 - arrive) * 4 + nod})`}>
        <S d={`M14,${DESK} L226,${DESK}`} w={2.8} o={0.8} />
        <S d={`M18,${DESK + 5} L222,${DESK + 4}`} w={1.2} o={0.35} />

        <S d="M28,482 Q54,488 80,482" />
        <S d="M28,482 L26,486" />
        <S d="M80,482 L82,486" />

        <Face x={FACE.x} y={FACE.y} r={FACE.r} look={-3 + settled} />
      </g>
    </g>
  );
}
