"use client";

import * as React from "react";

import { Wordmark } from "@/components/wordmark";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how", label: "Three steps" },
  { href: "#languages", label: "Languages" },
];

/**
 * No bar and no panel — the mark and the links sit straight on the lattice.
 * That also means the header does not travel with the page: a transparent bar
 * pinned to the top drags whatever is scrolling underneath through the type.
 *
 * Past the fold it earns a hairline and a blur. That is a state change rather
 * than an animation: it transitions over 200ms and then holds, so scrolling
 * back and forth never feels like it is playing something at you.
 *
 * The row deals itself out left to right on load, 40ms apart, with the one
 * button that matters landing last.
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

        <div className="ml-auto flex items-center gap-3 sm:gap-6">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link, i) => (
              <li
                key={link.href}
                className="animate-rise"
                style={{ animationDelay: `${0.13 + i * 0.04}s` }}
              >
                <a
                  href={link.href}
                  className="group relative inline-flex h-9 items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {link.label}
                  {/* Grows from the middle, so it opens rather than sweeps */}
                  <span
                    aria-hidden
                    className="absolute inset-x-3 bottom-1.5 h-px origin-center scale-x-0 bg-amber transition-transform duration-150 ease-out group-hover:scale-x-100"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  );
}
