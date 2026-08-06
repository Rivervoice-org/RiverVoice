import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The page's one loud element: a rail of greetings that never stops moving,
 * the way the calls do not. Two rows travel in opposite directions so the band
 * reads as current rather than as a list that happens to slide.
 *
 * Only languages whose greeting we can set correctly get a card; the rest are
 * named underneath, which is honest and keeps the rail free of transliterated
 * guesswork.
 */
const ROW_ONE = [
  { hello: "नमस्ते", lang: "Hindi", code: "hi" },
  { hello: "নমস্কার", lang: "Bengali", code: "bn" },
  { hello: "నమస్కారం", lang: "Telugu", code: "te" },
  { hello: "नमस्कार", lang: "Marathi", code: "mr" },
  { hello: "வணக்கம்", lang: "Tamil", code: "ta" },
  { hello: "નમસ્તે", lang: "Gujarati", code: "gu" },
];

const ROW_TWO = [
  { hello: "ನಮಸ್ಕಾರ", lang: "Kannada", code: "kn" },
  { hello: "ନମସ୍କାର", lang: "Odia", code: "or" },
  { hello: "നമസ്കാരം", lang: "Malayalam", code: "ml" },
  { hello: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", lang: "Punjabi", code: "pa" },
  { hello: "السلام علیکم", lang: "Urdu", code: "ur", rtl: true },
  { hello: "Hello", lang: "English", code: "en" },
];

const ALSO =
  "Assamese · Maithili · Santali · Kashmiri · Nepali · Konkani · Sindhi · Dogri · Manipuri · Bodo · Sanskrit";

type Greeting = { hello: string; lang: string; code: string; rtl?: boolean };

function GreetingCard({ greeting }: { greeting: Greeting }) {
  return (
    <Card className="shrink-0 flex-row items-baseline gap-3 px-6 py-4 transition-shadow duration-300 hover:shadow-(--shadow-float)">
      <span
        lang={greeting.code}
        dir={greeting.rtl ? "rtl" : undefined}
        className="text-[26px] leading-none font-medium tracking-[-0.02em] whitespace-nowrap sm:text-[30px]"
      >
        {greeting.hello}
      </span>

      <span className="text-xs whitespace-nowrap text-muted-foreground">{greeting.lang}</span>
    </Card>
  );
}

/** The track holds the list twice and travels half its width, so there is no seam. */
function Rail({ items, reverse }: { items: Greeting[]; reverse?: boolean }) {
  return (
    <div
      className="group overflow-hidden py-2"
      style={{
        maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
      }}
    >
      {/* The rail holds still while you are reading it */}
      <div
        className={cn(
          "animate-marquee flex w-max gap-3 group-hover:[animation-play-state:paused]",
          reverse && "[animation-direction:reverse]",
        )}
      >
        {items.map((greeting) => (
          <GreetingCard key={greeting.lang} greeting={greeting} />
        ))}

        {/* The second pass is scenery, not content */}
        {items.map((greeting) => (
          <div key={`${greeting.lang}-repeat`} aria-hidden>
            <GreetingCard greeting={greeting} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Languages() {
  return (
    <section id="languages" className="scroll-mt-20 py-20 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="23 languages"
          title="Your caller should not have to switch for you."
          blurb="Most lines make the caller meet the software halfway. This one starts in whichever language the call opens in, and follows if it changes halfway through a sentence."
          className="mx-auto px-4 text-center"
        />
      </Reveal>

      {/* The two rails arrive one after the other, as a pair */}
      <div className="mt-14 flex flex-col gap-3">
        <Reveal>
          <Rail items={ROW_ONE} />
        </Reveal>

        <Reveal delay={140}>
          <Rail items={ROW_TWO} reverse />
        </Reveal>
      </div>

      <Reveal className="mx-auto mt-12 max-w-2xl px-4 text-center text-sm leading-7 text-muted-foreground">
        <span className="text-foreground">Also answers in</span> {ALSO}
      </Reveal>
    </section>
  );
}
