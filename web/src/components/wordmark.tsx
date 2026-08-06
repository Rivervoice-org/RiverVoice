import Link from "next/link";
import { Waves } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The lockup, in one place so the nav, the footer and the auth pages cannot
 * drift apart. The mark is a solid tile rather than an outline — at 24px an
 * outlined box reads as an empty container and the waves inside disappear.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Rivervoice, home"
      className={cn("group inline-flex w-fit items-center gap-2", className)}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-200 ease-[cubic-bezier(0.34,1.4,0.5,1)] group-hover:-rotate-6">
        <Waves className="size-4.5" strokeWidth={2.25} />
      </span>

      <span className="text-[19px] font-semibold tracking-[-0.02em]">Rivervoice</span>
    </Link>
  );
}
