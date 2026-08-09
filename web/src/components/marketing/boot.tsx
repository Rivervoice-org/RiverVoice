"use client";

import * as React from "react";

import { Splash } from "@/components/dashboard/splash";

/**
 * The landing page's boot screen, once per session.
 *
 * The dashboard's splash plays on every paint, which is right there — you have
 * signed in and you are waiting for something. On a marketing page a lockup
 * that replays on every visit within a session stops being an arrival and
 * becomes a toll gate, so this remembers and never charges twice.
 *
 * Read through useSyncExternalStore rather than an effect: the server cannot
 * know, so it answers "already booted" and renders nothing, and React swaps to
 * the real answer after hydration without a mismatch or a setState in an
 * effect. Subscribing is a no-op because the answer cannot change while the
 * page is open — it is written once, for the next visit.
 *
 * Nothing unmounts it. The splash animates itself to visibility:hidden, so it
 * stops covering the page on its own; tearing it out on a timer would only risk
 * cutting the fade short.
 */
const KEY = "rv.booted";

const subscribe = () => () => {};

function readBooted() {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    // Private modes can refuse storage. A boot screen is not worth an error.
    return false;
  }
}

export function Boot() {
  const booted = React.useSyncExternalStore(subscribe, readBooted, () => true);

  React.useEffect(() => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // As above — if it cannot be remembered, it simply plays again.
    }
  }, []);

  return booted ? null : <Splash />;
}
