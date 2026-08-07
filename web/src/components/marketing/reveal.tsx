"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Lifts its children into place the first time they scroll into frame, then
 * stops watching.
 *
 * This is the one piece of the page that needs JavaScript. The CSS-only version
 * (animation-timeline: view()) only runs in Chromium, and everywhere else it
 * fell back to animating on load — which is not what "on scroll" means.
 *
 * Anyone who has asked for less motion is shown the finished state immediately
 * rather than being animated at more slowly.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
}: {
  children: React.ReactNode;
  /** Milliseconds behind the rest of its group, for staggering a row. */
  delay?: number;
  as?: "div" | "li";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion is handled by the motion-reduce classes below, so there is
    // nothing to observe and no state to set.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // Waits until the block is properly in frame, not clipping the bottom edge
      { rootMargin: "0px 0px -12% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement & HTMLLIElement>}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        "motion-reduce:translate-y-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
