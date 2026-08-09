"use client";

import { usePathname } from "next/navigation";

import { Board } from "@/motion/auth/board";
import { Chorus } from "@/motion/auth/chorus";

/**
 * Two panels for two readers: sign-in is someone who already owns agents, so
 * the board shows their line still being answered; sign-up is someone meeting
 * the product for the first time.
 *
 * Chosen by pathname because the aside lives in the shared layout, which is
 * also what keeps it from remounting when someone hops between the forms.
 */
const PANELS = {
  signUp: {
    scene: <Chorus />,
    warm: true,
    title: "Fluent in all of India.",
    sub: "Your agent answers every caller in their own language — 23 of them, switched mid-sentence.",
  },
  signIn: {
    scene: <Board />,
    warm: false,
    title: "Your agent answers in whichever language the phone rings in.",
    sub: "23 languages, switched mid-call, on a line that picks up in one ring.",
  },
};

export function AuthAside() {
  const pathname = usePathname();
  const panel = pathname?.startsWith("/sign-up") ? PANELS.signUp : PANELS.signIn;

  return (
    <aside className="relative hidden overflow-hidden rounded-2xl bg-muted/50 lg:flex lg:flex-col lg:justify-center lg:p-12">
      {/* A light thrown from the top corner, so the panel is not a flat slab */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(75% 50% at 72% 0%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%)",
        }}
      />

      {/* The sign-up panel runs warm — a brown-amber undertone under the amber
          accents, rather than grey-black under grey. */}
      {panel.warm ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "color-mix(in oklch, var(--color-amber) 3%, transparent)" }}
        />
      ) : null}

      <div className="relative">
        {panel.scene}

        <p className="mt-10 max-w-md text-[26px] leading-snug font-semibold tracking-[-0.02em]">
          {panel.title}
        </p>

        <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">{panel.sub}</p>
      </div>
    </aside>
  );
}
