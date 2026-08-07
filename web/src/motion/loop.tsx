"use client";

import * as React from "react";

import { FPS } from "@/motion/timeline";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * A scene on repeat, with no controls. The Player is for something you watch;
 * this is for something that plays beside what you are reading.
 *
 * Reduced motion holds a frame where the drawing has settled, so the panel
 * still says what it means without moving. The server assumes reduced, so the
 * first paint is the settled frame rather than an empty sheet.
 */
export function Loop({
  length,
  still,
  viewBox,
  className,
  children,
}: {
  length: number;
  still: number;
  viewBox: string;
  className?: string;
  children: (frame: number) => React.ReactNode;
}) {
  const reduced = React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );

  const [frame, setFrame] = React.useState(still);

  React.useEffect(() => {
    if (reduced) return;

    let raf = 0;
    const started = performance.now();

    const step = (now: number) => {
      setFrame((((now - started) / 1000) * FPS) % length);
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced, length]);

  return (
    <svg viewBox={viewBox} className={className} aria-hidden>
      {children(reduced ? still : frame)}
    </svg>
  );
}
