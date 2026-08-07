"use client";

import * as React from "react";

const key = (agentId: string) => `rv:agent-version:${agentId}`;

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Another tab switching version counts too.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Which version of an agent you were last looking at. A browser preference, not
 * domain data, so it lives in localStorage rather than costing a column and a
 * write on every switch.
 *
 * `ready` is false while the server snapshot is in play. The fetch waits for it
 * rather than loading the newest version and then correcting itself.
 */
export function useRememberedVersion(agentId: string) {
  const stored = React.useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key(agentId)) ?? "",
    () => null,
  );

  const remember = React.useCallback(
    (next: number | undefined) => {
      if (next) window.localStorage.setItem(key(agentId), String(next));
      else window.localStorage.removeItem(key(agentId));
      for (const listener of listeners) listener();
    },
    [agentId],
  );

  const version = Number(stored);

  return { version: version > 0 ? version : undefined, remember, ready: stored !== null };
}
