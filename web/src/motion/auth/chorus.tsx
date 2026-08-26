"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Calls arriving in many languages, resolving into one steady voice: the
 * scattered greetings are carried *into* the line, not away from it.
 *
 * Everything runs on CSS clocks with seamless loop points. Reduced motion
 * freezes one composed frame rather than looking broken.
 */

const HERO = [
  { hello: "नमस्ते", lang: "Hindi" },
  { hello: "வணக்கம்", lang: "Tamil" },
  { hello: "నమస్కారం", lang: "Telugu" },
  { hello: "ನಮಸ್ಕಾರ", lang: "Kannada" },
  { hello: "Hello", lang: "English" },
];

/* The rest of the chorus, each with its own place and its own way in to the
   line. Delays offset them so only two or three are ever visible at once. */
const SCATTER = [
  { hello: "நமஸ்காரம்", left: "4%", top: "12%", dx: "12px", dy: "34px", delay: "0s" },
  { hello: "నమస్తే", left: "72%", top: "6%", dx: "-12px", dy: "38px", delay: "1.5s" },
  { hello: "ನಮಸ್ತೆ", left: "56%", top: "80%", dx: "-8px", dy: "-36px", delay: "3s" },
  { hello: "नमस्कार", left: "10%", top: "72%", dx: "14px", dy: "-32px", delay: "4.5s" },
  { hello: "Namaste", left: "82%", top: "64%", dx: "-10px", dy: "-30px", delay: "6s" },
];

/* One period of the line, ending on the same tangent it starts on — (30,-14)
   out of the gate and into the close — so the second copy continues it without
   a seam, and the -50% wrap lands on an identical window. The second period is
   written out by hand (every x shifted 440) rather than generated, so a wrong
   regex cannot quietly bend the water. */
const WAVE =
  "M0,30 C30,16 50,22 80,28 C110,34 130,46 165,36 C200,26 215,8 250,16 C285,24 300,38 335,40 C370,42 410,44 440,30";
const WAVE2 =
  "C470,16 490,22 520,28 C550,34 570,46 605,36 C640,26 655,8 690,16 C725,24 740,38 775,40 C810,42 850,44 880,30";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function Chorus() {
  const reduced = React.useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
  const still = reduced;

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

  return (
    <div
      className={cn("relative transition-opacity duration-200", dim ? "opacity-85" : "opacity-100")}
    >
      <div className={cn("grid h-[4.5rem]", !still && "animate-chorus-enter")}>
        {(still ? HERO.slice(0, 1) : HERO).map((entry, i) => (
          <div
            key={entry.lang}
            className={cn(
              "col-start-1 row-start-1 flex items-baseline gap-3",
              !still && "animate-chorus-hero opacity-0",
            )}
            style={still ? undefined : { animationDelay: `${i * 2.6}s` }}
          >
            <span className="text-[44px] leading-none font-medium tracking-[-0.03em]">
              {entry.hello}
            </span>
            <span className="text-xs text-muted-foreground">{entry.lang}</span>
          </div>
        ))}
      </div>

      <div
        className={cn("relative mt-8 h-52", !still && "animate-chorus-enter")}
        style={still ? undefined : { animationDelay: "140ms" }}
      >
        <div
          aria-hidden
          className={cn(
            "absolute top-1/2 left-1/2 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full",
            !still && "animate-chorus-glow",
          )}
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--color-amber) 11%, transparent), transparent 72%)",
            opacity: still ? 0.6 : undefined,
          }}
        />

        {(still ? [0] : [0, 1, 2]).map((i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "absolute top-1/2 left-1/2 size-60 -translate-x-1/2 -translate-y-1/2 rounded-full border",
              !still && "animate-chorus-ring",
            )}
            style={{
              borderColor: "color-mix(in oklch, var(--color-amber) 38%, transparent)",
              ...(still
                ? { transform: "translate(-50%, -50%) scale(0.5)", opacity: 0.14 }
                : { animationDelay: `${i * 1.3}s` }),
            }}
          />
        ))}

        {/* Two lines at different speeds, so the water never reads as one
            repeating texture. */}
        <div className="absolute inset-x-0 top-1/2 h-[60px] -translate-y-1/2 overflow-hidden">
          <svg
            viewBox="0 0 880 60"
            preserveAspectRatio="none"
            className={cn("absolute h-full w-[200%]", !still && "animate-chorus-wave")}
            aria-hidden
          >
            <path
              d={`${WAVE} ${WAVE2}`}
              fill="none"
              stroke="var(--color-amber)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
          <svg
            viewBox="0 0 880 60"
            preserveAspectRatio="none"
            className={cn(
              "absolute top-[10px] h-full w-[200%]",
              !still && "animate-chorus-wave-slow",
            )}
            aria-hidden
          >
            <path
              d={`${WAVE} ${WAVE2}`}
              fill="none"
              stroke="var(--color-amber)"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.22"
            />
          </svg>
        </div>

        {SCATTER.map((word) => (
          <span
            key={word.hello}
            aria-hidden
            className={cn(
              "absolute text-[13px] whitespace-nowrap text-foreground/70",
              !still && "animate-chorus-drift opacity-0",
            )}
            style={{
              left: word.left,
              top: word.top,
              ...(still
                ? { opacity: 0.9 }
                : ({
                    animationDelay: word.delay,
                    "--chorus-dx": word.dx,
                    "--chorus-dy": word.dy,
                  } as React.CSSProperties)),
            }}
          >
            {word.hello}
          </span>
        ))}
      </div>
    </div>
  );
}
