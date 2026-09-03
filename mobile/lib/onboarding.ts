import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "rivervoice:onboarding-seen";

// null = not yet loaded from storage. Read once at module init rather than
// per-hook-call so every consumer (just the protected layout, today) shares
// one in-memory answer instead of racing its own AsyncStorage read.
let seen: boolean | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

AsyncStorage.getItem(KEY)
  .then((value) => {
    seen = value === "true";
    emit();
  })
  .catch(() => {
    // Storage unavailable — don't block sign-in on it, just skip the tour.
    seen = true;
    emit();
  });

/** Marks the tour seen immediately in memory; persists in the background. */
export function markOnboardingSeen() {
  seen = true;
  emit();
  void AsyncStorage.setItem(KEY, "true").catch(() => {
    // Best-effort; worst case the tour shows again next launch.
  });
}

/** `null` while the initial AsyncStorage read is in flight. */
export function useOnboardingSeen(): boolean | null {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => seen,
  );
}
