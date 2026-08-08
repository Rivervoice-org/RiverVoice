"use client";

import { useTheme } from "next-themes";
import { useCallback } from "react";
import { flushSync } from "react-dom";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

const DURATION = 480;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Swaps the theme behind a circular wipe that opens from wherever the control
 * was clicked, so the new palette reads as pouring out of the switch rather
 * than the whole page blinking.
 *
 * Falls back to an instant swap where View Transitions are missing (Firefox)
 * or the reader has asked for less motion.
 */
export function useThemeTransition() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const changeTheme = useCallback(
    (next: string, origin?: { x: number; y: number }) => {
      if (next === theme) return;

      const doc = document as ViewTransitionDocument;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!doc.startViewTransition || reduced) {
        setTheme(next);
        return;
      }

      const x = origin?.x ?? window.innerWidth / 2;
      const y = origin?.y ?? window.innerHeight / 2;
      // Reach the corner furthest from the click, so the wipe clears the viewport.
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      const root = document.documentElement;
      // Scopes the pseudo-element rules in globals.css to this transition only.
      root.dataset.themeTransition = "";

      const transition = doc.startViewTransition(() => {
        // next-themes writes the class in an effect; flushSync forces that to
        // land inside the callback, which is the only window the snapshot sees.
        flushSync(() => setTheme(next));
      });

      transition.ready.then(() => {
        root.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: DURATION,
            easing: EASING,
            pseudoElement: "::view-transition-new(root)",
          },
        );
      });

      transition.finished.finally(() => {
        delete root.dataset.themeTransition;
      });
    },
    [theme, setTheme],
  );

  return { theme, resolvedTheme, changeTheme };
}

/** Centre of the element that was activated — works for clicks and keyboard alike. */
export function originOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}
