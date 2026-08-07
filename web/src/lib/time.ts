const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 days ago", from an ISO timestamp. */
export function timeAgo(iso: string) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  let value = seconds;

  for (const [unit, span] of STEPS) {
    if (Math.abs(value) < span) return relative.format(Math.round(value), unit);
    value /= span;
  }

  return relative.format(Math.round(value), "year");
}
