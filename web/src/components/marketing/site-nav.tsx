"use client";

import * as React from "react";
import { Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

/**
 * No bar and no panel — the mark sits straight on the lattice. That also
 * means the header does not travel with the page: a transparent bar pinned
 * to the top drags whatever is scrolling underneath through the type.
 *
 * Past the fold it earns a hairline and a blur. That is a state change rather
 * than an animation: it transitions over 200ms and then holds, so scrolling
 * back and forth never feels like it is playing something at you.
 */
export function SiteNav() {
  const [past, setPast] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 80);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-200",
        past
          ? "border-b border-border bg-background/70 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:h-20 sm:px-6">
        <div className="animate-rise" style={{ animationDelay: "0.05s" }}>
          <Wordmark />
        </div>

        <div className="animate-rise ml-auto" style={{ animationDelay: "0.13s" }}>
          <Button variant="outline" size="sm" className="h-9 px-3.5" render={<a href="#app" />}>
            <Smartphone className="h-4 w-4" aria-hidden />
            Get the app
          </Button>
        </div>
      </nav>
    </header>
  );
}
