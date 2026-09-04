import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";

/**
 * Plays right here, on load, muted — the ambient auto-playing preview loop
 * every modern product page opens with, not a static poster waiting for a
 * click.
 */
export function Demo() {
  return (
    <section
      id="demo"
      className="mx-auto w-full max-w-4xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <Reveal>
        <SectionHeading
          eyebrow="See it"
          title="Watch it pick up, mid-sentence, in the wrong language on purpose."
          blurb="One real call, no cuts."
          className="mx-auto text-center"
        />
      </Reveal>

      <Reveal delay={120} className="mt-10 sm:mt-14">
        <div className="overflow-hidden rounded-2xl border border-border shadow-(--shadow-lift)">
          <video
            // controls
            width="100%"
            autoPlay
            muted
            loop
            playsInline
          >
            <source src="/assets/demoVideo.mp4" type="video/mp4" />
          </video>
        </div>
      </Reveal>
    </section>
  );
}
