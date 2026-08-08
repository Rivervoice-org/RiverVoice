"use client";

import { Rover } from "@/motion/bots/rover";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "It works down the list, and it knows when to stop."
 *
 * A campaign drawn as the only thing it really is: a list of people, called one
 * at a time, with what happened written back beside each name. The list is the
 * subject and Rover is the one working it — the opposite arrangement to the
 * knowledge scene, where the shelf sat behind the reader.
 *
 * Two of the five rows are the point. One asks not to be called again and is
 * struck off for good; one is never dialled at all, because it is outside that
 * person's hours. An illustration that only showed four cheerful connections
 * would be selling a robocaller, which is the thing nobody wants to buy.
 */
export type CampaignScript = {
  /** Five, because the list has to look like a list without filling the frame. */
  rows: string[];
  /** Written back beside a row once it is done. */
  outcomes: {
    booked: string;
    noAnswer: string;
    optedOut: string;
    /** Held rather than dialled — the row that is never rung. */
    held: string;
  };
  /** What the third person says, which is what stops it. */
  optOut: string;
  /** The line at the foot, once the list is worked. */
  tally: string;
  captions: [string, string, string, string];
};

export const CAMPAIGN_VIEW = { w: 460, h: 440 };

/* The list. */

const LIST = { x: 34, y: 66, w: 258, h: 268, r: 14 };
const ROWS = [112, 160, 208, 256, 304];
const ROW_H = 34;
/** Where the outcome is written, right-aligned inside the card. */
const CHIP = { right: LIST.x + LIST.w - 16, h: 22 };

const BOT = { x: 372, y: 244, size: 0.84 };
/** What the third person says back, above the head so it reads as incoming. */
const SAID = { x: 300, y: 92, w: 146, h: 34 };
const TALLY = { x: 34, y: 352, w: 258, h: 46 };

/* Beats. One row at a time, and the two that matter get longer. */

const DRAWN = seconds(0.3);
const CALL = [seconds(1.1), seconds(2.5), seconds(3.9), seconds(6.0), seconds(7.2)];
/** How long the line is open before the outcome lands. */
const HOLD = seconds(0.9);
/** The one that asks to stop, which needs a beat to be heard.  */
const HEARD = CALL[2] + seconds(1.0);
const STRUCK = HEARD + seconds(0.5);
/** The fourth is never dialled, so it resolves without a call. */
const TALLIED = seconds(8.6);
const RESET = seconds(10.2);

export const CAMPAIGN_LENGTH = seconds(10.8);
/** The list worked, one struck off, one held, and the tally under it. */
export const CAMPAIGN_STILL = seconds(9.4);

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const out = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

const captionText = "fill-current text-[14px] [font-family:var(--font-sans)]";
const rowText = "fill-current text-[13px] font-medium [font-family:var(--font-sans)]";
const chipText = "fill-current text-[11.5px] [font-family:var(--font-sans)]";
const talkText = "fill-current text-[13px] [font-family:var(--font-sans)]";

const S = ({ d, w = 2, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

/** What happened, written where the eye already is: at the end of the row. */
function Chip({ y, label, t, soft }: { y: number; label: string; t: number; soft?: boolean }) {
  if (t <= 0) return null;
  const w = 22 + label.length * 6.6;
  const x = CHIP.right - w;
  const show = out(t);

  return (
    <g opacity={show} transform={`translate(${(1 - show) * 6} 0)`}>
      <path
        d={box(x, y - CHIP.h / 2, w, CHIP.h, 11)}
        fill="currentColor"
        fillOpacity={soft ? 0 : 0.07}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={soft ? 0.45 : 0.8}
      />
      <text
        x={x + w / 2}
        y={y + 4}
        textAnchor="middle"
        className={chipText}
        opacity={soft ? 0.55 : 0.9}
      >
        {label}
      </text>
    </g>
  );
}

export function Campaign({ f, script }: { f: number; script: CampaignScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const rows = script.rows.slice(0, 5);

  const drawn = out(interpolate(f, [DRAWN, DRAWN + seconds(0.7)], [0, 1]));

  /* Which row the line is open on. The fourth is skipped outright: it is outside
     that person's hours, so there is never a call to be on. */
  const live = CALL.findIndex((at, i) => i !== 3 && f >= at && f < at + HOLD);
  const onCall = live !== -1;

  const struck = out(interpolate(f, [STRUCK, STRUCK + seconds(0.5)], [0, 1]));
  const heard = clamp(
    Math.min(
      interpolate(f, [HEARD - seconds(0.5), HEARD], [0, 1]),
      1 - interpolate(f, [STRUCK + seconds(0.6), STRUCK + seconds(1)], [0, 1]),
    ),
  );
  const tally = out(interpolate(f, [TALLIED, TALLIED + seconds(0.6)], [0, 1]));

  /* Each row's outcome, and when it arrives. The held one has no call before it,
     which is the whole of what that row is saying. */
  const outcome = [
    { at: CALL[0] + HOLD, label: script.outcomes.booked, soft: false },
    { at: CALL[1] + HOLD, label: script.outcomes.noAnswer, soft: true },
    { at: STRUCK, label: script.outcomes.optedOut, soft: false },
    { at: CALL[3], label: script.outcomes.held, soft: true },
    { at: CALL[4] + HOLD, label: script.outcomes.booked, soft: false },
  ];

  // Down the list as it works, and up at the caller when it is being told to stop.
  const look = heard > 0.3 ? -10 : onCall ? (live - 2) * 5 : 0;
  const nod =
    Math.sin(Math.PI * clamp(interpolate(f, [STRUCK, STRUCK + seconds(0.5)], [0, 1]))) * -2;

  const capIndex = f >= CALL[3] ? 3 : f >= HEARD - seconds(0.5) ? 2 : f >= CALL[0] ? 1 : 0;
  const capAt =
    f >= CALL[3]
      ? CALL[3]
      : f >= HEARD - seconds(0.5)
        ? HEARD - seconds(0.5)
        : f >= CALL[0]
          ? CALL[0]
          : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  return (
    <g>
      <text
        x={CAMPAIGN_VIEW.w / 2}
        y={34}
        textAnchor="middle"
        className={captionText}
        opacity={capShow * 0.8}
        transform={`translate(0 ${(1 - capShow) * 3})`}
      >
        {script.captions[capIndex]}
      </text>

      {/* The list itself */}
      <g opacity={gone}>
        <S d={box(LIST.x, LIST.y, LIST.w, LIST.h, LIST.r)} w={2} o={0.5 * drawn} />

        {rows.map((number, i) => {
          const arrive = out(
            interpolate(
              f,
              [DRAWN + i * seconds(0.1), DRAWN + seconds(0.6) + i * seconds(0.1)],
              [0, 1],
            ),
          );
          const done = f >= outcome[i].at;
          // The struck row keeps its number visible: it is a record of a person
          // who asked, not a row that was quietly dropped.
          const dim = i === 2 ? 1 - struck * 0.55 : done ? 0.9 : 0.55;

          return (
            <g key={number} opacity={arrive * gone}>
              {/* The line being worked, lit behind the row */}
              {onCall && live === i ? (
                <rect
                  x={LIST.x + 8}
                  y={ROWS[i] - ROW_H / 2}
                  width={LIST.w - 16}
                  height={ROW_H}
                  rx={9}
                  fill="currentColor"
                  opacity={0.06}
                />
              ) : null}

              <text x={LIST.x + 20} y={ROWS[i] + 5} className={rowText} opacity={dim}>
                {number}
              </text>

              {/* Struck through, not deleted */}
              {i === 2 && struck > 0 ? (
                <S
                  d={`M${LIST.x + 16},${ROWS[i]} h${(number.length * 7.6 + 8) * struck}`}
                  w={1.8}
                  o={0.6}
                />
              ) : null}

              <Chip
                y={ROWS[i]}
                label={outcome[i].label}
                t={interpolate(f, [outcome[i].at, outcome[i].at + seconds(0.4)], [0, 1])}
                soft={outcome[i].soft}
              />

              {i < rows.length - 1 ? (
                <S
                  d={`M${LIST.x + 16},${ROWS[i] + 24} H${LIST.x + LIST.w - 16}`}
                  w={1.4}
                  o={0.16}
                />
              ) : null}
            </g>
          );
        })}
      </g>

      {/* The line open, drawn from the row it is on to the one making the call */}
      {onCall
        ? [0, 1].map((n) => {
            const at = CALL[live] + n * seconds(0.22);
            const t = clamp(interpolate(f, [at, at + seconds(0.6)], [0, 1]));
            if (t <= 0 || t >= 1) return null;
            return (
              <path
                key={n}
                d={`M${BOT.x - 44},${BOT.y - 30} q${-16 - t * 26},${(ROWS[live] - BOT.y + 30) / 2} ${-30 - t * 40},${ROWS[live] - BOT.y + 30}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
                strokeLinecap="round"
                opacity={0.3 * (1 - t) * gone}
              />
            );
          })
        : null}

      {/* What the third person says, which is the only thing that overrides it */}
      {heard > 0 ? (
        <g opacity={heard * gone} transform={`translate(0 ${(1 - heard) * 4})`}>
          <S d={box(SAID.x, SAID.y, SAID.w, SAID.h, 10)} w={1.8} o={0.7} />
          <S d={`M${SAID.x + 30},${SAID.y + SAID.h} l-4,10 l14,-10`} w={1.8} o={0.7} />
          <text
            x={SAID.x + SAID.w / 2}
            y={SAID.y + 22}
            textAnchor="middle"
            className={talkText}
            opacity={0.8}
          >
            {script.optOut}
          </text>
        </g>
      ) : null}

      {/* The one working it */}
      <g opacity={gone}>
        <Rover
          x={BOT.x}
          y={BOT.y + nod}
          size={BOT.size}
          look={look}
          blink={f % 98 < 4 ? 0.1 : 1}
          // Lit only while a line is actually open.
          lit={onCall ? 1 : 0}
          // Pleased when the list is worked, never at the row that opted out.
          smile={heard > 0.2 ? 0 : tally}
        />
      </g>

      {/* What it comes to */}
      {tally > 0 ? (
        <g opacity={tally * gone} transform={`translate(0 ${(1 - tally) * -5})`}>
          <S d={box(TALLY.x, TALLY.y, TALLY.w, TALLY.h, 12)} w={1.8} o={0.6} />
          <text
            x={TALLY.x + TALLY.w / 2}
            y={TALLY.y + 28}
            textAnchor="middle"
            className={talkText}
            opacity={0.85}
          >
            {script.tally}
          </text>
        </g>
      ) : null}
    </g>
  );
}
