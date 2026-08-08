"use client";

import { interpolate, seconds } from "@/motion/timeline";
import { Kaki } from "@/motion/agent-templates/bots";
import { Caption, Card, Ink, Tick, VIEW, text } from "@/motion/agent-templates/stage";

/**
 * "मेरा ऑर्डर कहाँ है?" — looked up, not guessed at.
 *
 * The only scene here that travels, so it is staged on a diagonal rather than
 * in columns. Kaki carries the parcel up the route and lands on the stop the
 * tracking actually reports — never the door, however much the caller would
 * prefer it — and then says the day it arrives.
 */
export type ParcelScript = {
  /** Four stops, in order. */
  stops: string[];
  /** When it lands. */
  tag: string;
  captions: [string, string, string];
};

export const PARCEL_VIEW = VIEW;

const AT: [number, number][] = [
  [56, 420],
  [102, 344],
  [154, 262],
  [206, 168],
];
const ROUTE = "M56,420 C74,392 84,370 102,344 C124,312 136,290 154,262 C176,228 192,198 206,168";
/** Where the tracking stands — out for delivery, not at the door. */
const REACHED = 2;

const ETA = { x: 36, y: 452, w: 188, h: 66 };

const LOOK = seconds(1.8);
const FLY = seconds(2.3);
const SAY = seconds(4.8);
const TICK = seconds(5.8);
const RESET = seconds(7.6);

export const PARCEL_LENGTH = seconds(8.4);
/** Found, landed, and the day said out loud. */
export const PARCEL_STILL = seconds(6.8);

export function Parcel({ f, script }: { f: number; script: ParcelScript }) {
  const gone = 1 - interpolate(f, [RESET, RESET + seconds(0.6)], [0, 1]);
  const stops = script.stops.slice(0, 4);

  const drawn = interpolate(f, [seconds(0.2), seconds(1.3)], [0, 1]);
  // One leg at a time, and it stops where the tracking does.
  const flown = interpolate(f, [FLY, FLY + seconds(2.0)], [0, REACHED]);
  const leg = Math.min(REACHED - 1, Math.floor(flown));
  const within = flown - leg;

  const from = AT[leg];
  const to = AT[leg + 1];
  const x = from[0] + (to[0] - from[0]) * within;
  const y = from[1] + (to[1] - from[1]) * within;
  const flying = f >= FLY && flown < REACHED - 0.001;

  const eta = interpolate(f, [SAY, SAY + seconds(0.6)], [0, 1]);
  const tick = interpolate(f, [TICK, TICK + seconds(0.45)], [0, 1]);

  return (
    <g>
      <Caption f={f} at={[0, LOOK, SAY]} lines={script.captions} fade={gone} />

      {/* The route, as the courier has it */}
      <g opacity={gone}>
        <Ink d={ROUTE} t={drawn} w={2} o={0.26} />

        {AT.map(([sx, sy], i) => {
          const reached = flown >= i - 0.02;
          const arrive = interpolate(f, [seconds(0.4 + i * 0.15), seconds(0.9 + i * 0.15)], [0, 1]);

          return (
            <g key={stops[i]} opacity={arrive}>
              <circle
                cx={sx}
                cy={sy}
                r={4.6}
                fill="currentColor"
                fillOpacity={reached ? 0.9 : 0}
                stroke="currentColor"
                strokeWidth={1.9}
                opacity={reached ? 0.95 : 0.38}
              />
              {/* Labelled below the line, so the flight path stays clear */}
              <text
                x={sx - 12}
                y={sy + 18}
                textAnchor="end"
                className={text.small}
                opacity={reached ? 0.88 : 0.34}
              >
                {stops[i]}
              </text>
            </g>
          );
        })}
      </g>

      {/* Kaki, carrying it up the route */}
      {f >= FLY ? (
        <g opacity={gone} transform={`translate(${x} ${y - 30})`}>
          <Kaki
            x={0}
            y={0}
            // Bulkier than the rest of the cast, so it is sized down to sit on
            // the route without its beak or tail leaving the panel.
            size={0.8}
            tilt={flying ? -22 : 0}
            flap={flying ? (Math.sin(f * 0.9) + 1) / 2 : 0.32}
            blink={f % 86 < 4 ? 0.1 : 1}
            talk={f >= SAY && f < SAY + seconds(1) ? Math.abs(Math.sin(f * 0.5)) * 0.7 : 0}
            smile={interpolate(f, [SAY, SAY + seconds(0.6)], [0, 1])}
          />
          {/* The parcel, slung under it */}
          <g transform="translate(-4 34)">
            <Ink d="M-10,-8 h20 v16 h-20 Z" w={2.1} />
            <Ink d="M-10,-2 h20" w={1.4} o={0.5} />
            <Ink d="M0,-8 v16" w={1.4} o={0.5} />
          </g>
        </g>
      ) : null}

      {/* The day it lands, said plainly */}
      <g opacity={gone}>
        <Card {...ETA} t={eta}>
          <text x={ETA.x + 18} y={ETA.y + 27} className={text.small} opacity={0.6}>
            {stops[REACHED]}
          </text>
          <text x={ETA.x + 18} y={ETA.y + 50} className={text.strong}>
            {script.tag}
          </text>
          <Tick x={ETA.x + ETA.w - 36} y={ETA.y + 32} t={tick} />
        </Card>
      </g>
    </g>
  );
}
