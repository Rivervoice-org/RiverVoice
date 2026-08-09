"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Holds its subtree still while it is off-screen.
 *
 * Unlike Reveal, this keeps watching: a loop that has scrolled away should stop
 * and start again when it comes back, and the marquee, the drift, the mouth
 * flips and the phrase cycles all run at once. Paused rather than unmounted, so
 * nothing has to rebuild when it returns.
 *
 * Reduced motion never marks anything idle — there is nothing running to pause,
 * and the attribute would only make the flag harder to read in the DOM.
 */
export function InView({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  const ref = useRef<HTMLElement>(null);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(([entry]) => setIdle(!entry.isIntersecting), {
      // A margin either way, so it is already running by the time it is seen.
      rootMargin: "120px 0px",
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLElement>}
      data-idle={idle ? "true" : undefined}
      className={className}
    >
      {children}
    </Tag>
  );
}
