"use client";

import { Rover } from "@/motion/bots/rover";
import { Dialer } from "@/motion/props/dialer";
import { box } from "@/motion/shapes";
import { interpolate, seconds } from "@/motion/timeline";

/**
 * "It works down the list, and it knows when to stop."
 *
 * Three numbers and one phone. A campaign is easy to draw as rows filling in,
 * and that drawing lies a little: it makes the calling look like a spreadsheet
 * updating. A dial that winds to the stop and springs back, once per digit,
 * makes it plain that somebody is being rung.
 *
 * Two of the three calls are the point. One asks not to be rung again, and the
 * receiver goes down mid-call; one is never dialled at all, because it is
 * outside that person's hours — no spin, no lift, nothing. An illustration that
 * only showed three cheerful connections would be selling a robocaller.
 */
export type CampaignScript = {
  /** Three, because each one has to be watched being dialled. */
  numbers: [string, string, string];
  outcomes: { booked: string; optedOut: string; held: string };
  /** Written on the third slip, which is why it is never rung. */
  holdReason: string;
  /** What the second person says, which is what stops it. */
  optOut: string;
  tally: string;
  captions: [string, string, string, string];
};

export const CAMPAIGN_VIEW = { w: 460, h: 440 };

/* Who is where matters more than it looks. Rover holds the list, so the slip is
   on its side; the far end of the line is beyond the phone, so the answer comes
   in from the other side of the frame. The reverse arrangement is what made this
   read as a call being taken rather than one being made. */
/** Tall enough for a second line, since the held one carries a reason as well
    as a number — the two used to be written over each other. */
const SLIP = { x: 232, y: 62, w: 190, h: 62 };
const SAID = { x: 30, y: 62, w: 180, h: 44 };
/* The phone stands at Rover's elbow rather than across the frame. A receiver
   flown that far turned the cord into a washing line and laid the handset over
   the body like a plank; from here it only has to come up to the head. */
const PHONE = { x: 192, y: 302, size: 0.8 };
const BOT = { x: 348, y: 258, size: 1 };
const GROUND = 340;
/* The held pose, worked out from where Rover stands — and it is the pose every
   drawing of a phone call uses: the handset near-vertical BESIDE the head, cups
   pointing at it, earpiece at eye height, mouthpiece down by the chest, hand
   round the middle. It hugs the body's near edge and never crosses the face —
   Rover's face is its eyes, so anything laid across it lands on a lens.
   Rotated -88 so the cups, which hang down at rest, turn to face the head. */
const CARRY = { dx: 147, dy: -38, angle: -88 };
const CHIP = { x: 192, y: 382 };
const TALLY = { x: 84, y: 398, w: 292, h: 34 };

/* Beats. One call at a time, and the two that matter get longer. */

const CALLS = [
  { slip: seconds(0.4), dial: seconds(1.1), ring: seconds(2.2), done: seconds(3.0) },
  { slip: seconds(3.9), dial: seconds(4.5), ring: seconds(5.6), done: seconds(7.2) },
  // Never dialled, so it has neither a dial nor a ring.
  { slip: seconds(8.0), dial: 0, ring: 0, done: seconds(8.9) },
];

/** The second caller asks, and the receiver goes down before the outcome. */
const HEARD = seconds(6.3);
const DOWN = seconds(6.9);

const TALLIED = seconds(9.8);
const RESET = seconds(11.6);

export const CAMPAIGN_LENGTH = seconds(12.2);
/** Two dialled, one struck off, one held, and the tally under it. */
export const CAMPAIGN_STILL = seconds(10.8);

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const out = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

/** Wound to the stop and let go, once per digit — never a steady rotation. */
function dialSpin(f: number, from: number, to: number, digits = 3) {
  if (from === 0 || f < from || f >= to) return 0;
  const per = (to - from) / digits;
  const t = ((f - from) % per) / per;
  return t < 0.62 ? (t / 0.62) * 250 : (1 - (t - 0.62) / 0.38) * 250;
}

const captionText = "fill-current text-[14px] [font-family:var(--font-sans)]";
const slipText = "fill-current text-[14px] font-medium [font-family:var(--font-sans)]";
const noteText = "fill-current text-[11.5px] [font-family:var(--font-sans)]";
const talkText = "fill-current text-[13px] [font-family:var(--font-sans)]";

const S = ({ d, w = 2, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

export function Campaign({ f, script }: { f: number; script: CampaignScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);

  /* Which number is on the spike. Each slip stays until the next arrives, so
     there is always exactly one, and the third simply never leaves. */
  let index = 0;
  for (let i = 0; i < CALLS.length; i += 1) if (f >= CALLS[i].slip) index = i;
  const call = CALLS[index];
  const held = index === 2;

  const slip = out(interpolate(f, [call.slip, call.slip + seconds(0.4)], [0, 1]));
  const struck = out(interpolate(f, [DOWN, DOWN + seconds(0.5)], [0, 1]));

  // The dial winds only while it is being dialled; nothing turns for the third.
  const spin = dialSpin(f, call.dial, call.ring);

  /* Off the cradle from the first digit, down again when the call ends — and
     for the second, down early, on the word rather than after it. */
  const lifted = held
    ? 0
    : out(interpolate(f, [call.dial - seconds(0.3), call.dial], [0, 1])) *
      (1 -
        out(
          interpolate(
            f,
            [index === 1 ? DOWN : call.done, (index === 1 ? DOWN : call.done) + seconds(0.4)],
            [0, 1],
          ),
        ));

  const ring = call.ring
    ? clamp(
        Math.min(
          interpolate(f, [call.ring, call.ring + seconds(0.2)], [0, 1]),
          1 - interpolate(f, [call.ring + seconds(0.8), call.ring + seconds(1.1)], [0, 1]),
        ),
      )
    : 0;

  const heard = clamp(
    Math.min(
      interpolate(f, [HEARD, HEARD + seconds(0.3)], [0, 1]),
      1 - interpolate(f, [DOWN + seconds(0.5), DOWN + seconds(0.9)], [0, 1]),
    ),
  );

  const outcome = held
    ? { label: script.outcomes.held, at: call.done, soft: true }
    : index === 1
      ? { label: script.outcomes.optedOut, at: call.done, soft: false }
      : { label: script.outcomes.booked, at: call.done, soft: false };

  const chip = out(interpolate(f, [outcome.at, outcome.at + seconds(0.45)], [0, 1]));
  const tally = out(interpolate(f, [TALLIED, TALLIED + seconds(0.6)], [0, 1]));

  // A touch toward the handset while on a call — the tilt does the listening —
  // and up at the caller when it is being told to stop.
  const look = heard > 0.3 ? -12 : lifted > 0.3 ? -5 : held ? -8 : 0;
  const nod = Math.sin(Math.PI * clamp(interpolate(f, [DOWN, DOWN + seconds(0.5)], [0, 1]))) * -2;

  const capIndex = f >= CALLS[2].slip ? 3 : f >= HEARD ? 2 : f >= CALLS[0].dial ? 1 : 0;
  const capAt =
    f >= CALLS[2].slip
      ? CALLS[2].slip
      : f >= HEARD
        ? HEARD
        : f >= CALLS[0].dial
          ? CALLS[0].dial
          : 0;
  const capShow = Math.min(interpolate(f, [capAt, capAt + seconds(0.3)], [0, 1]), gone);

  const chipWidth = 26 + outcome.label.length * 7;

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

      {/* The number being rung, on its own slip */}
      <g opacity={slip * gone} transform={`translate(0 ${(1 - slip) * -6})`}>
        <S d={box(SLIP.x, SLIP.y, SLIP.w, SLIP.h, 10)} w={1.9} o={0.65} />
        <text x={SLIP.x + 18} y={SLIP.y + 28} className={slipText} opacity={1 - struck * 0.5}>
          {script.numbers[index]}
        </text>

        {/* Struck, not thrown away: a record of somebody who asked */}
        {index === 1 && struck > 0 ? (
          <S
            d={`M${SLIP.x + 14},${SLIP.y + 23} h${(script.numbers[1].length * 8 + 8) * struck}`}
            w={1.8}
            o={0.7}
          />
        ) : null}

        {/* Why the third is never rung — under the number rather than beside it,
            which is where the two used to overlap. */}
        {held ? (
          <text x={SLIP.x + 18} y={SLIP.y + 48} className={noteText} opacity={0.6}>
            {script.holdReason}
          </text>
        ) : null}
      </g>

      {/* What the second person says, which is the only thing that overrides it */}
      {heard > 0 ? (
        <g opacity={heard * gone} transform={`translate(0 ${(1 - heard) * 4})`}>
          <S d={box(SAID.x, SAID.y, SAID.w, SAID.h, 10)} w={1.8} o={0.7} />
          <S d={`M${SAID.x + 34},${SAID.y + SAID.h} l-4,11 l15,-11`} w={1.8} o={0.7} />
          <text
            x={SAID.x + SAID.w / 2}
            y={SAID.y + 27}
            textAnchor="middle"
            className={talkText}
            opacity={0.82}
          >
            {script.optOut}
          </text>
        </g>
      ) : null}

      {/* What they are both standing on */}
      <S d={`M52,${GROUND} H408`} w={2.2} o={0.4 * gone} />

      <g opacity={gone}>
        <Rover
          x={BOT.x}
          y={BOT.y + nod}
          size={BOT.size}
          look={look}
          // Cocked into the earpiece while the call is on, which is the half of
          // the pose the handset cannot do by itself.
          tilt={-lifted * 7}
          blink={f % 98 < 4 ? 0.1 : 1}
          // The hand closes round the handle for as long as the receiver is up —
          // the point is where the handset's middle lands, in Rover's own units.
          reach={lifted > 0.3 ? { x: -38, y: -10 } : undefined}
          lit={lifted}
          // Pleased when the list is done, never at the one that asked to stop.
          smile={heard > 0.2 ? 0 : tally}
        />

        {/* Drawn after Rover, because the receiver ends up against its head and
            has to pass in front of it. The base is nowhere near, so nothing else
            in the phone cares about the order. */}
        <Dialer
          x={PHONE.x}
          y={PHONE.y}
          size={PHONE.size}
          spin={spin}
          lifted={lifted}
          carry={CARRY}
          ring={ring}
        />
      </g>

      {/* What happened, under the phone that did it */}
      {chip > 0 ? (
        <g opacity={chip * gone} transform={`translate(0 ${(1 - chip) * -4})`}>
          <path
            d={box(CHIP.x - chipWidth / 2, CHIP.y - 13, chipWidth, 26, 13)}
            fill="currentColor"
            fillOpacity={outcome.soft ? 0 : 0.07}
            stroke="currentColor"
            strokeWidth={1.6}
            opacity={outcome.soft ? 0.45 : 0.8}
          />
          <text
            x={CHIP.x}
            y={CHIP.y + 5}
            textAnchor="middle"
            className={talkText}
            opacity={outcome.soft ? 0.6 : 0.9}
          >
            {outcome.label}
          </text>
        </g>
      ) : null}

      {/* What it comes to */}
      {tally > 0 ? (
        <g opacity={tally * gone} transform={`translate(0 ${(1 - tally) * -5})`}>
          <S d={box(TALLY.x, TALLY.y, TALLY.w, TALLY.h, 11)} w={1.8} o={0.55} />
          <text
            x={TALLY.x + TALLY.w / 2}
            y={TALLY.y + 22}
            textAnchor="middle"
            className={talkText}
            opacity={0.8}
          >
            {script.tally}
          </text>
        </g>
      ) : null}
    </g>
  );
}
