import { useEffect } from "react";
import { acquireDialTones, playDialTone } from "@/lib/dial-tones";

/**
 * Keeps the shared DTMF players alive for as long as the calling component
 * is mounted, and hands back the (module-level, permanently stable) play
 * function.
 *
 * Mount this on the screen that *owns* the dial pad, not on the sheet
 * itself: acquiring is what triggers loading and warm-up, and that work has
 * to be finished before the sheet opens for the first press to sound
 * instant. The returned function is a module export rather than a
 * `useCallback`, so memoized keypad subtrees never re-render because of it.
 */
export function useDialTones(): (digit: string) => void {
  useEffect(() => acquireDialTones(), []);
  return playDialTone;
}
