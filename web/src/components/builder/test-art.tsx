"use client";

import { bubble } from "@/motion/shapes";

/**
 * The idle mark for each way of testing. One per tab, and deliberately three
 * different silhouettes and three different tints — the panel body is otherwise
 * empty before a test starts, so this is what tells you which mode you are in
 * from across the room.
 */

/** Live audio, so it moves. Uneven durations, or seven bars pump in unison. */
export function VoiceArt() {
  const bars = [24, 44, 62, 36, 56, 28, 42];

  return (
    <div className="flex h-20 items-end justify-center gap-2 text-river" aria-hidden>
      {bars.map((height, i) => (
        <span
          key={height}
          className="animate-bar w-2.5 rounded-full bg-current motion-reduce:animate-none"
          style={{
            height,
            animationDelay: `${i * 0.13}s`,
            animationDuration: `${1 + (i % 3) * 0.19}s`,
          }}
        />
      ))}
    </div>
  );
}

/** A handset going out, with the rings the call makes on its way. */
export function PhoneArt() {
  return (
    <div
      className="relative flex size-20 items-center justify-center text-foreground/75"
      aria-hidden
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          className="animate-halo absolute size-11 rounded-full border border-current motion-reduce:hidden"
          style={{ animationDelay: `${i * 1.2}s` }}
        />
      ))}

      <svg
        viewBox="0 0 48 48"
        className="relative size-12"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13,9 h7 l3,8 l-4,3 c2,5 5,8 10,10 l3,-4 l8,3 v7 c0,2 -2,4 -5,4 C22,39 10,27 9,14 C9,11 11,9 13,9 Z" />
        {/* Outbound, so the arrow leaves rather than arrives */}
        <path d="M33,15 L42,6 M42,6 h-7 M42,6 v7" strokeWidth={2.1} />
      </svg>
    </div>
  );
}

/** Two bubbles, one each way — the same shape the transcript will use. */
export function ChatArt() {
  return (
    <div className="flex h-20 items-center justify-center text-amber" aria-hidden>
      <svg
        viewBox="0 0 76 56"
        className="h-16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={bubble(6, 4, 44, 24, "left")} opacity={0.45} />
        <path d={bubble(26, 30, 44, 22, "right")} />
      </svg>
    </div>
  );
}
