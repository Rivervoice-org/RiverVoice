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
  /**
   * Bottom-anchored by default. These scenes stand on a ground line at the foot
   * of the frame, and the panel they sit in changes height with whatever is in
   * the column beside it — centred, the whole drawing floats in a letterbox band
   * and the character ends up somewhere nobody is looking.
   */
  preserve = "xMidYMax meet",
  className,
  children,
}: {
  length: number;
  still: number;
  viewBox: string;
  preserve?: string;
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
    <svg viewBox={viewBox} preserveAspectRatio={preserve} className={className} aria-hidden>
      {children(reduced ? still : frame)}
    </svg>
  );
}
