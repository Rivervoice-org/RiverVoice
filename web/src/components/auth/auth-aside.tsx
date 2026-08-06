/**
 * No transcript, no chat — one statement, with the greeting under it cycling
 * through the languages an agent answers in. Six lines need a tighter hold
 * than the shared phrase keyframe gives, so this uses its own.
 */
const GREETINGS = [
  { hello: "नमस्ते", lang: "Hindi" },
  { hello: "ನಮಸ್ಕಾರ", lang: "Kannada" },
  { hello: "నమస్కారం", lang: "Telugu" },
  { hello: "নমস্কার", lang: "Bengali" },
  { hello: "வணக்கம்", lang: "Tamil" },
  { hello: "નમસ્તે", lang: "Gujarati" },
];

export function AuthAside() {
  const step = 2.6;
  const cycle = GREETINGS.length * step;

  return (
    <aside className="relative hidden overflow-hidden rounded-2xl bg-muted/50 lg:flex lg:flex-col lg:justify-end lg:p-12">
      {/* A light thrown from the top corner, so the panel is not a flat slab */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 50% at 72% 0%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        }}
      />

      <div className="relative">
        {/* The greeting changes; the sentence around it does not */}
        <div className="grid h-[4.5rem]">
          {GREETINGS.map((greeting, index) => (
            <div
              key={greeting.lang}
              className="animate-greeting col-start-1 row-start-1 flex items-baseline gap-3 opacity-0"
              style={{ animationDuration: `${cycle}s`, animationDelay: `${index * step}s` }}
            >
              <span className="text-[44px] leading-none font-medium tracking-[-0.03em]">
                {greeting.hello}
              </span>
              <span className="text-xs text-muted-foreground">{greeting.lang}</span>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-md text-[26px] leading-snug font-semibold tracking-[-0.02em]">
          Your agent answers in whichever language the phone rings in.
        </p>

        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
          23 languages, switched mid-call, on a line that picks up in one ring.
        </p>
      </div>
    </aside>
  );
}
