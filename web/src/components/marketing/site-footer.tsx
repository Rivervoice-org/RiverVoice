import { Reveal } from "@/components/marketing/reveal";
import { Separator } from "@/components/ui/separator";
import { Wordmark } from "@/components/wordmark";

/** In-page anchors only — this page has no wiring into the app behind sign-in. */
const LINKS = [{ label: "Get the app", href: "#app" }];

export function SiteFooter() {
  return (
    <footer className="relative mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
      <Separator />

      <Reveal className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
          <Wordmark standUp />
          <p className="text-sm text-muted-foreground">
            Voice translation agents that answer the phone, in the language it rang in.
          </p>
        </div>

        <nav>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Reveal>

      <p className="mt-8 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} Rivervoice · Terms · Privacy
      </p>
    </footer>
  );
}
