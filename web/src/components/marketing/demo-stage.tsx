"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Wraps a looping UI-replica demo so it only starts once it's actually on
 * screen — every `demo-*` animation inside a `.demo-screen` starts paused,
 * frozen on its own 0% frame (each one's empty/unpicked state), and only
 * runs once this stamps `data-playing` on, via IntersectionObserver. Shared
 * by every step's screen replica so none of them starts mid-story for
 * whoever scrolls to it after the page has been open a while.
 */
export function DemoStage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), {
      rootMargin: "0px 0px -10% 0px",
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} data-playing={playing || undefined} className={cn("demo-screen", className)}>
      {children}
    </div>
  );
}
