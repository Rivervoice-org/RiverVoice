import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The page's one loud element: a rail of greetings that never stops moving,
 * the way the calls do not. Two rows travel in opposite directions so the band
 * reads as current rather than as a list that happens to slide.
 *
 * Five languages, no more — every one of them a language the pipeline actually
 * speaks, not a name lifted from a longer list to look impressive.
 */
const ROW_ONE = [
  { hello: "नमस्ते", lang: "Hindi", code: "hi" },
  { hello: "வணக்கம்", lang: "Tamil", code: "ta" },
  { hello: "నమస్కారం", lang: "Telugu", code: "te" },
];

const ROW_TWO = [
  { hello: "ನಮಸ್ಕಾರ", lang: "Kannada", code: "kn" },
  { hello: "Hello", lang: "English", code: "en" },
];

type Greeting = { hello: string; lang: string; code: string; rtl?: boolean };

function GreetingCard({ greeting }: { greeting: Greeting }) {
  return (
    <Card className="group/card relative shrink-0 flex-row items-baseline gap-3 px-6 py-4 transition-[box-shadow,border-color,opacity] duration-300 hover:border-amber/60 hover:shadow-(--shadow-float) group-hover/rail:opacity-40 hover:!opacity-100">
      {/* The card answers back once when you stop on it */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-amber opacity-0 group-hover/card:animate-ring motion-reduce:hidden"
      />
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

/** Repeated until the half-track is comfortably wider than any viewport — five
    languages alone leave a gap the marquee's -50% loop exposes as blank page. */
function fillRow(items: Greeting[]): Greeting[] {
  const copies = Math.ceil(8 / items.length);
  return Array.from({ length: copies }, () => items).flat();
}

/** The track holds the list twice and travels half its width, so there is no seam. */
function Rail({ items, reverse }: { items: Greeting[]; reverse?: boolean }) {
  const filled = fillRow(items);
  return (
    <div
      className="group/rail overflow-hidden py-2"
      style={{
        maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
      }}
    >
      {/* Two nested animations, because one element cannot hold two transforms:
          the outer eases the rail up to speed once, the inner runs the loop. */}
      <div className="animate-marquee-settle motion-reduce:animate-none">
        {/* The rail holds still while you are reading it */}
        <div
          className={cn(
            "animate-marquee flex w-max gap-3 group-hover/rail:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
          )}
        >
          {filled.map((greeting, i) => (
            <GreetingCard key={`${greeting.lang}-${i}`} greeting={greeting} />
          ))}

          {/* The second pass is scenery, not content */}
          {filled.map((greeting, i) => (
            <div key={`${greeting.lang}-${i}-repeat`} aria-hidden>
              <GreetingCard greeting={greeting} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Languages() {
  return (
    <section id="languages" className="scroll-mt-20 py-20 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="5 languages"
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
    </section>
  );
}
