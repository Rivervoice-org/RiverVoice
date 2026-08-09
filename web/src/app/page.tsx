import { Boot } from "@/components/marketing/boot";
import { Hero } from "@/components/marketing/hero";
import { InView } from "@/components/marketing/in-view";
import { Jaali } from "@/components/marketing/jaali";
import { Languages } from "@/components/marketing/languages";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteNav } from "@/components/marketing/site-nav";
import { Steps } from "@/components/marketing/steps";

export const metadata = {
  // The one page that should not have the product name appended twice.
  title: { absolute: "Rivervoice · Voice agents that answer the phone" },
  description:
    "Voice agents that pick up on the first ring and answer in 23 Indian languages, switching mid-call.",
};

/** The public front page. Everything under /home sits behind the session gate. */
export default function LandingPage() {
  return (
    // overflow-x-clip, never -hidden: hidden turns this into a scroll
    // container, and position:sticky silently stops working inside one — the
    // nav sat dead at the top for exactly that reason. clip cuts the same
    // overflow without creating a scroll box.
    <div className="relative flex min-h-svh flex-col overflow-x-clip bg-background">
      {/* Page-wide, so the lattice runs the full height rather than starting
          under the nav. Everything after it needs its own stacking context.

          It drifts one pattern cell over forty seconds — under noticing, but it
          is the difference between a page and a screenshot. */}
      <Jaali className="animate-hero-breathe motion-reduce:animate-none" />

      <Boot />

      <SiteNav />

      <main className="relative flex-1">
        {/* The two sections that keep loops running hold still once they are
            off screen — between the marquee, the drift, the mouth flips and the
            phrase cycles there is a lot here that never finishes on its own. */}
        <InView>
          <Hero />
        </InView>

        <InView>
          <Languages />
        </InView>

        <Steps />
      </main>

      <SiteFooter />
    </div>
  );
}
