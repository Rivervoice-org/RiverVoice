import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/**
 * DTMF tone playback for the dial pad.
 *
 * The playback path here is deliberately the same one that was known to
 * produce sound: create the players up front, and on a press either `play()`
 * a slot that has never played, or `seekTo(0)` first and then `play()`. It
 * does not mute, does not pause, and does not touch the audio session.
 *
 * An earlier revision added a muted "warm-up" pass (play once at mount so the
 * first real press doesn't pay decode + audio-graph startup) plus a deferred
 * rewind after each tone. That is the right shape for the latency problem,
 * but it shipped alongside a `setAudioModeAsync` call and deferred
 * construction, and the keypad went silent. Rather than guess which of the
 * three did it, the risky parts are out; see `dialTonesDiagnostics` below for
 * getting real data before re-adding them.
 *
 * Notably NOT reintroduced: `setAudioModeAsync`. expo-audio's Android
 * `play()` is not gated on audio focus, so it bought nothing, while its
 * Android path runs `audioManager.setSpeakerphoneOn(...)` and reassigns
 * `audioManager.mode` — which would stomp the routing InCallManager sets up
 * for live calls in lib/webrtc/ferry-call.ts.
 */

const SOURCES: Record<string, number> = {
  "1": require("@/assets/sounds/dtmf/1.wav"),
  "2": require("@/assets/sounds/dtmf/2.wav"),
  "3": require("@/assets/sounds/dtmf/3.wav"),
  "4": require("@/assets/sounds/dtmf/4.wav"),
  "5": require("@/assets/sounds/dtmf/5.wav"),
  "6": require("@/assets/sounds/dtmf/6.wav"),
  "7": require("@/assets/sounds/dtmf/7.wav"),
  "8": require("@/assets/sounds/dtmf/8.wav"),
  "9": require("@/assets/sounds/dtmf/9.wav"),
  "0": require("@/assets/sounds/dtmf/0.wav"),
  "*": require("@/assets/sounds/dtmf/star.wav"),
  "#": require("@/assets/sounds/dtmf/pound.wav"),
};

/**
 * Two players per digit: alternating presses of the same key hit a player
 * that has never played yet and can start with no seek at all — only a third
 * press in a row (reusing a slot) needs to rewind first. `currentTime` looks
 * like a synchronous rewind but is getter-only at runtime despite its type;
 * `seekTo()` is the real (async) rewind, so this pool exists to keep it off
 * the common path.
 */
const POOL_SIZE = 2;

/**
 * Navigating off the Call tab and back shouldn't rebuild the players. Hold
 * them through short absences.
 */
const IDLE_TEARDOWN_MS = 30_000;

type Pool = {
  players: AudioPlayer[];
  everPlayed: boolean[];
  next: number;
};

let pools: Record<string, Pool> | null = null;
let refCount = 0;
let teardownTimer: ReturnType<typeof setTimeout> | null = null;

function buildPools(): Record<string, Pool> {
  const built: Record<string, Pool> = {};
  for (const [digit, source] of Object.entries(SOURCES)) {
    built[digit] = {
      players: Array.from({ length: POOL_SIZE }, () =>
        createAudioPlayer(source),
      ),
      everPlayed: Array<boolean>(POOL_SIZE).fill(false),
      next: 0,
    };
  }
  pools = built;
  return built;
}

function destroyPools(): void {
  const built = pools;
  pools = null;
  if (!built) return;
  for (const pool of Object.values(built)) {
    for (const player of pool.players) {
      try {
        player.release();
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Registers a user of the dial tones, creating the players if they aren't up
 * yet. Returns the matching release; call it on unmount.
 *
 * Construction is synchronous. An earlier revision deferred it behind
 * `InteractionManager.runAfterInteractions` to keep the native allocations
 * out of the mount frame, but that callback only runs once every interaction
 * handle in the app has cleared — one stuck handle anywhere and the pool is
 * never built and the keypad is permanently silent, with no error. A few
 * milliseconds at mount is not worth that failure mode.
 */
export function acquireDialTones(): () => void {
  refCount += 1;
  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }
  if (!pools) buildPools();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0 || teardownTimer) return;
    teardownTimer = setTimeout(() => {
      teardownTimer = null;
      if (refCount === 0) destroyPools();
    }, IDLE_TEARDOWN_MS);
  };
}

/**
 * Fires the tone for `digit`. Runs from `onPressIn`, so it stays synchronous
 * and allocation-light — everything it does is on the perceived-latency
 * budget.
 */
export function playDialTone(digit: string): void {
  // Falls back to building on demand rather than staying silent. This should
  // never be the path that builds — `acquireDialTones` runs when the sheet
  // mounts — but a silent dial pad is worse than one late first tone.
  const pool = (pools ?? buildPools())[digit];
  if (!pool) return;

  const index = pool.next;
  pool.next = (pool.next + 1) % POOL_SIZE;
  const player = pool.players[index];
  if (!player) return;

  try {
    if (pool.everPlayed[index]) void player.seekTo(0).catch(() => {});
    pool.everPlayed[index] = true;
    player.play();
  } catch {
    /* Player released mid-press; swallow rather than break the key. */
  }
}

/**
 * Dev-only snapshot of what the native players actually think their state is.
 * Call it from a debug console (or temporarily from a press handler) when
 * tones are inaudible: it distinguishes "pool was never built" from "built
 * but not loaded" from "loaded and playing at volume 0", which is the fork in
 * the road that reading this file cannot settle.
 */
export function dialTonesDiagnostics(): unknown {
  if (!pools) return { pools: null, refCount };
  return {
    refCount,
    digits: Object.entries(pools).map(([digit, pool]) => {
      const player = pool.players[0];
      if (!player) return { digit, player: null };
      try {
        return {
          digit,
          isLoaded: player.isLoaded,
          playing: player.playing,
          muted: player.muted,
          volume: player.volume,
          currentTime: player.currentTime,
          duration: player.duration,
        };
      } catch (error) {
        return { digit, error: String(error) };
      }
    }),
  };
}
