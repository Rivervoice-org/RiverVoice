// In-memory only — this only needs to survive the single navigation from
// Welcome's sign-in to Home landing, not a full app relaunch.
let justSignedIn = false;

export function markJustSignedIn() {
  justSignedIn = true;
}

/** Reads and clears the flag — true only for the first read after a sign-in. */
export function consumeJustSignedIn(): boolean {
  const value = justSignedIn;
  justSignedIn = false;
  return value;
}
