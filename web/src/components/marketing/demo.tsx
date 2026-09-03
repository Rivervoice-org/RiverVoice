import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";

const YOUTUBE_ID = "Ce0ZnaL_vvU";
const YOUTUBE_SRC =
  `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}` +
  `?autoplay=1&mute=1&loop=1&playlist=${YOUTUBE_ID}&controls=1&modestbranding=1&rel=0`;

/**
 * Plays right here, on load, muted — the ambient auto-playing preview loop
 * every modern product page opens with, not a static poster waiting for a
 * click. A real YouTube embed, not a link out to another tab: unlike a
 * GitHub README or a Claude Artifact, this is our own page with no CSP
 * fence around it, so the iframe just works.
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
          <iframe
            className="aspect-video w-full"
            src={YOUTUBE_SRC}
            title="Rivervoice demo — a live translated call, start to finish"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </Reveal>
    </section>
  );
}
