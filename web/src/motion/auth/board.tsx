"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The switchboard, filling in — and the greeting above it, on the same clock.
 *
 * Whoever is on this page already has an account, so the panel is not a pitch;
 * it is the line still being answered. Five calls land, one every 400ms, and
 * each landing swaps the greeting to the language that call came in on. One
 * event, two consequences — the two used to run on separate clocks and read as
 * two things competing.
 *
 * It stops. A loop with no resting state is the thing that makes an auth page
 * feel restless, so this ends as a legible list and stays there.
 *
 * Rows are HTML rather than svg text: Indic conjuncts shape and hint properly,
 * and font fallback works.
 */

const CALLS = [
  { hello: "नमस्ते", lang: "Hindi", out: "Booked · 2:30 Tue", secs: 72 },
  { hello: "வணக்கம்", lang: "Tamil", out: "Message taken", secs: 38 },
  { hello: "ನಮಸ್ಕಾರ", lang: "Kannada", out: "Renewed · 12 months", secs: 104 },
  { hello: "నమస్కారం", lang: "Telugu", out: "Promised · Friday", secs: 126 },
  { hello: "Hello", lang: "English", out: "Booked · 11:30 Thu", secs: 63 },
];

const STEP = 400;

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Counts up and settles, so the duration reads as measured rather than typed. */
function useCountUp(to: number, run: boolean) {
  const [n, setN] = React.useState(to);

  React.useEffect(() => {
    if (!run) return;

    let raf = 0;
    const started = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - started) / 450);
      setN(Math.round(to * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, run]);

  return run ? n : to;
}

function Row({
  call,
  fresh,
  still,
}: {
  call: (typeof CALLS)[number];
  fresh: boolean;
  still: boolean;
}) {
  const secs = useCountUp(call.secs, !still);

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border/50 px-3.5 py-2.5",
        // The newest keeps a tint for a beat, so the eye knows what just landed.
        fresh ? "bg-foreground/[0.04]" : "bg-transparent",
        "transition-colors duration-700",
        !still && "animate-land",
      )}
      style={{ willChange: still ? undefined : "transform, opacity" }}
    >
      <svg viewBox="0 0 16 16" aria-hidden className="size-4 shrink-0 text-foreground/70">
        <path
          d="M3.5 8.5 L6.5 11.5 L12.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          className={still ? undefined : "animate-check"}
          strokeDashoffset={still ? 0 : undefined}
        />
      </svg>

      <span className="w-[5.5rem] shrink-0 truncate text-[15px]">{call.hello}</span>

      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{call.out}</span>

      <span className="shrink-0 font-mono text-[12px] text-muted-foreground tabular-nums">
        {clock(secs)}
      </span>
    </li>
  );
}

export function Board() {
  const reduced = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );

  // Reduced motion, and the server, get the settled state outright.
  const [landed, setLanded] = React.useState(0);
  const still = reduced;
  const shown = still ? CALLS.length : landed;

  React.useEffect(() => {
    if (reduced || landed >= CALLS.length) return;

    // Nothing advances while the tab is in the background.
    const tick = () => {
      if (document.visibilityState === "visible") setLanded((n) => Math.min(CALLS.length, n + 1));
    };

    const id = window.setTimeout(tick, landed === 0 ? 250 : STEP);
    return () => window.clearTimeout(id);
  }, [reduced, landed]);

  // While they are typing, this side is not the task.
  const [dim, setDim] = React.useState(false);

  React.useEffect(() => {
    const check = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
      setDim(Boolean(el?.matches?.("input, textarea, select")));
    };

    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    return () => {
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  const current = CALLS[Math.max(0, shown - 1)];

  return (
    <div
      className={cn("relative transition-opacity duration-200", dim ? "opacity-85" : "opacity-100")}
    >
      {/* The greeting is the hero, and it changes because a call landed */}
      <div className="grid h-[4.5rem]">
        <div key={current.hello} className="col-start-1 row-start-1 flex items-baseline gap-3">
          <span className="animate-land text-[44px] leading-none font-medium tracking-[-0.03em]">
            {current.hello}
          </span>
          {/* The label follows the word rather than moving with it */}
          <span
            className="animate-land text-xs text-muted-foreground"
            style={{ animationDelay: "80ms" }}
          >
            {current.lang}
          </span>
        </div>

        {/* One ring, once, as the first call comes in */}
        {!still && shown === 1 ? (
          <span
            aria-hidden
            className="animate-ring pointer-events-none col-start-1 row-start-1 -ml-3 size-16 self-center rounded-full border border-foreground/40"
          />
        ) : null}
      </div>

      {/* Masked rather than per-row fades, so the middle stays fully legible */}
      <ul
        className="mt-8 flex flex-col gap-2"
        style={{
          maskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 78%, transparent 100%)",
        }}
      >
        {CALLS.slice(0, shown).map((call, i) => (
          <Row key={call.lang} call={call} fresh={i === shown - 1 && !still} still={still} />
        ))}
      </ul>
    </div>
  );
}
