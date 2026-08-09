"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Runs the callback once the calls stop for `delay` ms: a search field has to
 * answer every keystroke, the server does not.
 *
 * Same shape as use-debounce's hook of this name, so swapping to the package is
 * an import change.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Through a ref, so the returned identity stays stable across renders.
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => () => clearTimeout(timer.current), []);

  return useCallback(
    (...args: Args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
