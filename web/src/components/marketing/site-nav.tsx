import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

const LINKS = [
  { href: "#how", label: "Three steps" },
  { href: "#languages", label: "Languages" },
];

/**
 * No bar and no panel — the mark and the links sit straight on the lattice.
 * That also means the header does not travel with the page: a transparent bar
 * pinned to the top drags whatever is scrolling underneath through the type.
 */
export function SiteNav() {
  return (
    <header className="relative z-50">
      <nav className="mx-auto flex h-20 w-full max-w-6xl items-center px-6">
        <Wordmark />

        <div className="ml-auto flex items-center gap-6">
          <ul className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Button
                  variant="ghost"
                  size="lg"
                  className="text-muted-foreground hover:bg-transparent hover:text-foreground"
                  render={<a href={link.href} />}
                >
                  {link.label}
                </Button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="lg"
              className="hidden text-muted-foreground hover:bg-transparent hover:text-foreground sm:inline-flex"
              render={<Link href="/sign-in" />}
            >
              Sign in
            </Button>

            <Button size="lg" render={<Link href="/sign-up" />}>
              Start building
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}
