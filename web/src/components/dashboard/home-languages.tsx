import { topLanguages } from "@/components/dashboard/data";

/** The whole point of the product, front and center: what got translated this week. */
export function HomeLanguages() {
  const max = Math.max(...topLanguages.map((l) => l.calls));

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Languages this week</h2>
      </div>

      <div className="flex flex-col gap-2.5 rounded-xl border border-border p-5">
        {topLanguages.map((language) => (
          <div key={language.pair} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm">{language.pair}</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-foreground"
                style={{ width: `${(language.calls / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
              {language.calls}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
