import { Hero } from "@/components/marketing/hero";
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
    <div className="relative flex min-h-svh flex-col overflow-x-hidden bg-background">
      {/* Page-wide, so the lattice runs the full height rather than starting
          under the nav. Everything after it needs its own stacking context. */}
      <Jaali />

      <SiteNav />

      <main className="relative flex-1">
        <Hero />
        <Languages />
        <Steps />
      </main>

      <SiteFooter />
    </div>
  );
}
