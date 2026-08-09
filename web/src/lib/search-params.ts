/** Reading the url as page state: the same two chores on every listing page. */

/** Next hands a record with repeats as arrays; the first one is the answer. */
export function toSearchParams(record: Record<string, string | string[] | undefined>) {
  return new URLSearchParams(
    Object.entries(record).flatMap(([key, value]) =>
      value === undefined
        ? []
        : [[key, Array.isArray(value) ? value[0] : value] as [string, string]],
    ),
  );
}

/** A hand-typed url is not worth an error page, so anything unreadable falls back. */
export function readPositive(raw: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) return fallback;
  return Math.min(value, max);
}
