import Link from "next/link";

import { Jaali } from "@/components/marketing/jaali";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/**
 * A 404 on a phone product is a wrong number, and the page says so the way the
 * exchange does. The one moving thing is the zero itself: a rotary dial that
 * winds to the stop and springs back twice — one more try — then gives up and
 * sits still. A full scene was tried here and fought the lockup; a utility
 * page earns exactly one idea.
 */

const rnd = (n: number) => Math.round(n * 100) / 100;

/** The dial, standing in for the zero. Ten finger holes over three quarters of
    the face, the way the real prop is drawn. */
function DialZero() {
  const holes = Array.from({ length: 10 }, (_, i) => {
    const angle = ((-58 - i * 26) * Math.PI) / 180;
    return { x: rnd(Math.cos(angle) * 21), y: rnd(Math.sin(angle) * 21) };
  });

  return (
    <svg viewBox="-34 -34 68 68" className="mx-2 h-[0.7em] w-auto" aria-hidden>
      <circle
        r={31}
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        className="text-foreground"
      />
      <g className="animate-dial-wind motion-reduce:animate-none">
        {holes.map((hole) => (
          <circle
            key={`${hole.x}`}
            cx={hole.x}
            cy={hole.y}
            r={3.4}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            className="text-foreground/70"
          />
        ))}
      </g>
      {/* The finger stop stays put, or there is nothing to wind against */}
      <path
        d="M20,26 L27,19"
        stroke="currentColor"
        strokeWidth={4.5}
        strokeLinecap="round"
        className="text-foreground"
      />
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
      <Jaali />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center px-4 sm:h-20 sm:px-6">
        <Wordmark />
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-20 text-center">
        {/* A flex row, so the numerals can never stack however narrow it gets */}
        <h1
          aria-label="404, page not found"
          className="animate-rise flex items-center text-[104px] leading-none font-semibold tracking-[-0.04em] sm:text-[136px]"
        >
          4<DialZero />4
        </h1>

        <p
          className="animate-rise mt-7 text-[17px] font-medium"
          style={{ animationDelay: "0.08s" }}
        >
          The page you dialled does not exist.
        </p>

        <p
          className="animate-rise mt-2 max-w-md text-[15px] leading-7 text-balance text-muted-foreground"
          style={{ animationDelay: "0.14s" }}
        >
          This page may have been moved, renamed, or never wired up. Nothing here picks up, however
          long it rings.
        </p>

        <div className="animate-rise mt-8" style={{ animationDelay: "0.22s" }}>
          <Button size="lg" className="h-11 px-5 text-[15px]" render={<Link href="/" />}>
            Go home
          </Button>
        </div>
      </main>
    </div>
  );
}
