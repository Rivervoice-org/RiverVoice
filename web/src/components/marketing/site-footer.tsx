import Link from "next/link";

import { Reveal } from "@/components/marketing/reveal";
import { Separator } from "@/components/ui/separator";
import { Wordmark } from "@/components/wordmark";

/** Only routes that exist get a link; nothing here is a placeholder. */
const LINKS = [
  { label: "Three steps", href: "#how" },
  { label: "Languages", href: "#languages" },
  { label: "Sign in", href: "/sign-in" },
  { label: "Create an account", href: "/sign-up" },
];

export function SiteFooter() {
  return (
    <footer className="relative mx-auto w-full max-w-6xl px-6 pb-10">
      <Separator />

      <Reveal className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Wordmark />
          <p className="text-sm text-muted-foreground">
            Voice agents that answer the phone, in the language it rang in.
          </p>
        </div>

        <nav>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LINKS.map((link) =>
              link.href.startsWith("#") ? (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      </Reveal>

      <p className="mt-8 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Rivervoice · Terms · Privacy
      </p>
    </footer>
  );
}
