import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { CreateAgentScreen } from "@/components/marketing/create-agent-screen";
import { PointNumberScreen } from "@/components/marketing/point-number-screen";

/**
 * One row per step of setting an agent up, each pairing what you'd tell
 * someone against the real screen that step happens on — not a diagram of
 * it, the actual UI, replaying the motion that step is made of.
 */
export function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="Pick a language, a tone, a voice."
          blurb="Tell it who it's speaking for: the languages, how formal it sounds, who it sounds like. It starts answering from the next ring."
          className="mx-auto text-center"
        />
      </Reveal>

      <div className="mt-16 grid items-center gap-10 sm:mt-20 md:grid-cols-2 md:gap-16">
        <Reveal className="order-2 md:order-1">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">01</span>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">
            Create an agent
          </h3>
          <p className="mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">
            Write what it should handle the way you would tell a new hire. No flowcharts, no intent
            trees, no sample dialogue — a name, a language pair, a tone, and a voice.
          </p>
        </Reveal>

        <Reveal delay={120} className="order-1 md:order-2">
          <CreateAgentScreen />
        </Reveal>
      </div>

      <div className="mt-16 grid items-center gap-10 sm:mt-20 md:grid-cols-2 md:gap-16">
        <Reveal>
          <PointNumberScreen />
        </Reveal>

        <Reveal delay={120}>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">02</span>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">
            Point it at a number
          </h3>
          <p className="mt-3 max-w-md text-[15px] leading-7 text-muted-foreground">
            Swipe on any number to call it, then choose which agent should answer. It's already on
            the line, translating live, before the first ring ends.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
