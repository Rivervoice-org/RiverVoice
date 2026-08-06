import Link from "next/link";

import { HeroCrowd } from "@/components/marketing/hero-crowd";
import { Swash } from "@/components/marketing/jaali";
import { Button } from "@/components/ui/button";

/**
 * The positioning, stated plainly: a headline, a sentence, and the two things
 * you can do about it. The lattice behind it belongs to the page, not to this
 * section.
 */
export function Hero() {
  return (
    <section className="relative flex w-full flex-col items-center px-4 pt-28 pb-28 text-center sm:pt-36 sm:pb-36">
      <HeroCrowd />

      <div className="relative flex flex-col items-center">
        <h1 className="animate-rise max-w-3xl text-[44px] leading-[1.04] font-semibold tracking-[-0.04em] text-balance sm:text-[64px] lg:text-[74px]">
          Voice agents for
          {/* The inner span hugs the words, so the stroke sits under the
              phrase rather than spanning the whole centred line */}
          <span className="mt-1 block font-serif font-light italic">
            <span className="relative inline-block">
              Indic languages.
              <Swash />
            </span>
          </span>
        </h1>

        <p
          className="animate-rise mt-8 max-w-xl text-base leading-7 text-balance text-muted-foreground sm:text-lg sm:leading-8"
          style={{ animationDelay: "0.08s" }}
        >
          Your callers ring in from Kanpur, Kochi and Coimbatore — half English, half not, changing
          language mid-sentence. Your agent keeps up, in all 23 of them.
        </p>

        <div
          className="animate-rise mt-10 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.16s" }}
        >
          <Button size="lg" className="h-11 px-5 text-[15px]" render={<Link href="/sign-up" />}>
            Build your first agent
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="h-11 px-5 text-[15px]"
            render={<a href="#languages" />}
          >
            Hear the languages
          </Button>
        </div>
      </div>
    </section>
  );
}
