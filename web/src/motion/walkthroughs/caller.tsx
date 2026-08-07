"use client";

import { ease, interpolate, seconds } from "@/motion/timeline";

/**
 * Collections, drawn as the work rather than the transaction.
 *
 * A row of dockets hangs over a desk, one per instalment still owed. Phones
 * ring; the agent rolls between them, takes each call, and the cord comes alive
 * into voice as it talks. A docket that gets paid flips and drops off the wire.
 * A call nobody picks up goes back on the wire further along, for later.
 *
 * Ring, talk, collect, next. The point is that it never stops and never gets
 * flustered, so the loop has no beginning and the agent never hurries.
 */
export type CallerScript = {
  /** One per instalment still owed. */
  tags: string[];
  /** What a docket says once it is settled. */
  paid: string;
};

export const CALLER_VIEW = { w: 240, h: 560 };

const WIRE = 104;
const TAG_TOP = WIRE + 8;
const DESK = 430;
const HIP = DESK - 8;

const PHONE_L = 56;
const PHONE_R = 178;
const SEAT_L = 92;
const SEAT_R = 148;

const TAG_X = [30, 70, 110, 150, 190];

/* Beats: three calls, and a fourth already ringing as it loops. */

const CALLS = [
  {
    ring: seconds(0.7),
    pick: seconds(1.5),
    talk: seconds(2.3),
    end: seconds(5.0),
    at: PHONE_L,
    seat: SEAT_L,
    answered: true,
    tag: 4,
  },
  {
    ring: seconds(6.0),
    pick: seconds(6.8),
    talk: seconds(7.4),
    end: seconds(9.4),
    at: PHONE_R,
    seat: SEAT_R,
    answered: false,
    tag: 2,
  },
  {
    ring: seconds(10.4),
    pick: seconds(11.2),
    talk: seconds(12.0),
    end: seconds(14.8),
    at: PHONE_L,
    seat: SEAT_L,
    answered: true,
    tag: 3,
  },
];

const AGAIN = seconds(16.2);
const FADE = seconds(17.6);

export const CALLER_LENGTH = seconds(19);
/** Mid-call, cord alive, one docket already gone. */
export const CALLER_STILL = seconds(12.8);

const tagText =
  "fill-current text-[8px] font-medium tracking-[0.02em] [font-family:var(--font-sans)]";

const S = ({ d, w = 2.5, o = 1 }: { d: string; w?: number; o?: number }) => (
  <path d={d} fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" opacity={o} />
);

const pulse = (f: number, at: number, length: number) => {
  const t = (f - at) / length;
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
};

function Docket({
  f,
  x,
  label,
  paid,
  flip,
  drop,
  sliding,
}: {
  f: number;
  x: number;
  label: string;
  paid: string;
  flip: number;
  drop: number;
  sliding: number;
}) {
  if (drop >= 1) return null;

  // Hangs from the wire, so it swings from the top rather than the middle.
  const swing = Math.sin(f / 28 + x / 30) * 2.4 + sliding * 9;
  const fall = ease(drop);
  const y = TAG_TOP + fall * 260;
  const turn = flip < 0.5 ? flip * 2 : (1 - flip) * 2;
  const showPaid = flip >= 0.5;

  return (
    <g opacity={1 - fall * 0.9} transform={`translate(${x} ${y}) rotate(${swing + fall * 34})`}>
      {/* The hook over the wire */}
      <S d="M0,-8 C-3,-8 -3,-3 0,-3" w={1.6} o={0.7} />
      <g transform={`scale(${Math.max(0.06, 1 - turn)} 1)`}>
        <path
          d="M-15,-2 L15,-2.6 L15.4,26 L-14.6,26.6 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
        />
        {showPaid ? (
          <>
            <path
              d="M-7,11 l4.5,5 l10,-11"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <text x={0} y={23} textAnchor="middle" className={tagText} opacity={0.7}>
              {paid}
            </text>
          </>
        ) : (
          <text x={0} y={16} textAnchor="middle" className={tagText}>
            {label}
          </text>
        )}
      </g>
    </g>
  );
}

/**
 * The cord: slack when idle, alive with voice while a call is up, and limp
 * when nobody picks up. The one line that carries the whole idea.
 */
function Cord({ f, from, voice }: { f: number; from: number; voice: number }) {
  const wobble = Math.sin(f / 18);
  const amp = 8 + voice * 20;

  // Leaves the handset, sags, then climbs away off the right edge.
  const d = [
    `M${from},${DESK - 54}`,
    `C${from + 18},${DESK - 30 + wobble * 4} ${from + 34},${DESK - 8} ${from + 52},${DESK - 26}`,
    `C${from + 70},${DESK - 44 - amp * 0.4} ${from + 78},${DESK - 96 + wobble * amp * 0.3} ${from + 96},${DESK - 118}`,
    `C${from + 116},${DESK - 142} 240,${DESK - 120 - amp * 0.5} 268,${DESK - 156}`,
  ].join(" ");

  return (
    <>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.8} opacity={0.5 + voice * 0.3} />
      {/* Voice riding the cord, only while somebody is talking */}
      {voice > 0.05
        ? [0, 1, 2].map((i) => {
            const t = (f / 26 + i * 0.33) % 1;
            const px = from + 40 + t * 130;
            const py = DESK - 30 - t * 96 + Math.sin(t * 9) * 5;
            return (
              <path
                key={i}
                d={`M0,${-5 - i} Q${4 + i},0 0,${5 + i}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                opacity={voice * (1 - t) * 0.75}
                transform={`translate(${px} ${py})`}
              />
            );
          })
        : null}
    </>
  );
}

/** Old handset: a cradle with a receiver across it. */
function Telephone({
  f,
  x,
  ringing,
  lifted,
}: {
  f: number;
  x: number;
  ringing: number;
  lifted: number;
}) {
  const shake = ringing > 0 ? Math.sin(f * 1.7) * 1.8 : 0;

  return (
    <g transform={`translate(${x + shake} ${DESK})`}>
      <S d="M-15,0 C-15,-9 -10,-13 0,-13 C10,-13 15,-9 15,0 Z" w={2.5} />
      <S d="M-11,-13 L-9,-18 L9,-18 L11,-13" w={2.1} o={0.8} />
      {lifted < 0.5 ? (
        <S
          d="M-13,-18 C-13,-24 -7,-26 0,-26 C7,-26 13,-24 13,-18 C9,-20 -9,-20 -13,-18 Z"
          w={2.4}
        />
      ) : null}
      {ringing > 0 ? (
        <g opacity={0.4 + Math.sin(f * 1.5) * 0.35}>
          <S d="M-19,-22 q-7,-6 -6,-14" w={1.5} />
          <S d="M19,-22 q7,-6 6,-14" w={1.5} />
        </g>
      ) : null}
    </g>
  );
}

/** The agent: a person, in a chair with wheels, calm about all of it. */
function Agent({
  f,
  x,
  onCall,
  reaching,
}: {
  f: number;
  x: number;
  onCall: number;
  reaching: number;
}) {
  const breathe = Math.sin(f / 26) * 0.7;
  const blink = f % seconds(4.9) < 4 ? 0.15 : 1;
  const armAngle = -78 * onCall + 26 * reaching;

  return (
    <g transform={`translate(${x} ${HIP})`}>
      {/* Chair: a post, a base, and wheels */}
      <S d="M0,4 L0,26" w={2.4} />
      <S d="M-13,28 L13,28" w={2.4} />
      <circle cx={-13} cy={31} r={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={13} cy={31} r={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <S d="M14,4 C18,4 19,-8 18,-18" w={2.2} o={0.8} />

      {/* Legs under the desk, feet just showing */}
      <S d="M-6,2 C-12,4 -16,6 -20,6" w={2.5} />
      <S d="M-4,6 C-10,9 -14,11 -18,11" w={2.5} o={0.8} />

      {/* Coat: one closed sweep, seated */}
      <S
        d="M-9,4 C-12,-10 -10,-24 -1,-25 C8,-26 12,-17 11,-4 C10.6,-0.5 10,1.6 9,4 C3,5.4 -4,5.4 -9,4 Z"
        w={2.8}
      />
      <S d="M-6.5,-2 C-7.5,-12 -6.5,-19 -2.5,-22" w={1.2} o={0.45} />

      <g transform={`translate(0 ${-34 + breathe})`}>
        <S
          d="M-8,-1 C-8,-8 -4,-11.5 1,-11.5 C6,-11.5 9,-8 9,-1 C9,5.5 5,8.5 0.5,8.5 C-4,8.5 -8,5.5 -8,-1 Z"
          w={2.6}
        />
        <S
          d="M-8.5,-2 C-9.5,-11 -4,-15 1,-14.8 C7,-14.6 10,-11 9.5,-2 C7.5,-6.5 3,-8.5 -1,-8 C-4.5,-7.6 -7,-5.5 -8.5,-2 Z"
          w={2.4}
        />
        <g transform={`scale(1 ${blink})`}>
          <circle cx={-3} cy={-0.5} r={1.4} fill="currentColor" />
          <circle cx={4} cy={-0.5} r={1.4} fill="currentColor" />
        </g>
        <S d={onCall > 0.4 ? "M-2,4 Q1,6.4 4,4" : "M-2,4.4 H4"} w={1.6} o={0.8} />
      </g>

      {/* The arm that answers and reaches */}
      <g transform={`translate(7 -20) rotate(${armAngle})`}>
        <S d="M0,0 C6,1.5 11,3.5 15,5" w={2.5} />
        {onCall > 0.4 ? <S d="M13,0 C17,0 18,4 17,8 C15,10 12,9 12,6" w={2.2} /> : null}
      </g>
      <S d="M-8,-18 C-12,-13 -13.5,-8 -13,-2" w={2.4} />
    </g>
  );
}

export function Caller({ f, script }: { f: number; script: CallerScript }) {
  const tags = script.tags.slice(0, 5);

  // Which call, if any, is up right now.
  const live = CALLS.find((call) => f >= call.ring && f < call.end + seconds(0.9));
  const next = CALLS.find((call) => f < call.ring);

  const ringing = live && f < live.pick ? 1 : 0;
  const onCall = live
    ? ease(interpolate(f, [live.pick, live.pick + seconds(0.4)], [0, 1])) *
      (1 - ease(interpolate(f, [live.end, live.end + seconds(0.4)], [0, 1])))
    : 0;

  // Talking only when somebody actually picked up on the other end.
  const voice = live?.answered
    ? ease(interpolate(f, [live.talk, live.talk + seconds(0.5)], [0, 1])) *
      (1 - ease(interpolate(f, [live.end - seconds(0.4), live.end], [0, 1])))
    : 0;

  // Rolls to whichever phone is ringing, and stays until the next one goes.
  const seat = live ? live.seat : next ? next.seat : SEAT_L;
  const prev = CALLS.filter((call) => f >= call.ring).at(-1);
  const from = prev ? prev.seat : SEAT_L;
  const roll = live ? ease(interpolate(f, [live.ring, live.pick], [0, 1])) : 1;
  const x = from + (seat - from) * roll;

  const reaching = live ? pulse(f, live.ring, live.pick - live.ring) : 0;
  const settle = 1 - ease(interpolate(f, [FADE, FADE + seconds(0.7)], [0, 1]));

  return (
    <g opacity={settle}>
      {/* The wire the dockets hang from */}
      <S d={`M8,${WIRE} C70,${WIRE - 3} 160,${WIRE + 3} 232,${WIRE}`} w={1.6} o={0.5} />

      {tags.map((label, i) => {
        const call = CALLS.find((c) => c.tag === i);
        const settled = call?.answered
          ? ease(interpolate(f, [call.end - seconds(0.9), call.end - seconds(0.3)], [0, 1]))
          : 0;
        const dropped = call?.answered
          ? ease(interpolate(f, [call.end, call.end + seconds(1.1)], [0, 1]))
          : 0;

        // A call nobody answered puts the docket further down the line.
        const moving =
          call && !call.answered
            ? ease(interpolate(f, [call.end, call.end + seconds(0.9)], [0, 1]))
            : 0;

        return (
          <Docket
            key={i}
            f={f}
            x={TAG_X[i] + moving * (TAG_X[TAG_X.length - 1] + 16 - TAG_X[i])}
            label={label}
            paid={script.paid}
            flip={settled}
            drop={dropped}
            sliding={moving > 0 && moving < 1 ? 1 : 0}
          />
        );
      })}

      {/* Desk */}
      <S d={`M6,${DESK} L234,${DESK}`} w={2.8} />
      <S d={`M10,${DESK + 5} L228,${DESK + 4}`} w={1.2} o={0.4} />
      <S d={`M28,${DESK + 6} L32,${DESK + 66}`} w={2.4} />
      <S d={`M212,${DESK + 6} L208,${DESK + 66}`} w={2.4} />

      <Cord f={f} from={x + 12} voice={voice} />

      <Telephone
        f={f}
        x={PHONE_L}
        ringing={live?.at === PHONE_L ? ringing : 0}
        lifted={live?.at === PHONE_L ? onCall : 0}
      />
      <Telephone
        f={f}
        x={PHONE_R}
        ringing={live?.at === PHONE_R ? ringing : 0}
        lifted={live?.at === PHONE_R ? onCall : 0}
      />

      <Agent f={f} x={x} onCall={onCall} reaching={reaching} />

      {/* And another one already going, so the loop has no seam */}
      {f >= AGAIN ? (
        <g opacity={0.4 + Math.sin(f * 1.5) * 0.35}>
          <S d={`M${PHONE_R - 19},${DESK - 22} q-7,-6 -6,-14`} w={1.5} />
          <S d={`M${PHONE_R + 19},${DESK - 22} q7,-6 6,-14`} w={1.5} />
        </g>
      ) : null}
    </g>
  );
}
