"use client";

import { Plus, Upload } from "lucide-react";

import { Loop } from "@/motion/loop";
import {
  LIBRARY_LENGTH,
  LIBRARY_STILL,
  LIBRARY_VIEW,
  Library,
  type LibraryScript,
} from "@/motion/sections/library";
import { Button } from "@/components/ui/button";

/**
 * What a knowledge base is, before there is one.
 *
 * "Answers only from your sources" is a promise nobody can check by reading it,
 * so the scene beside the copy shows it kept — and then shows it kept when the
 * answer is not on the shelf, which is the half that matters.
 *
 * Only languages whose script we can set correctly get a book, which is the
 * same rule the landing page's greeting rail is held to.
 */
const SCRIPT: Omit<LibraryScript, "reader"> = {
  shelf: ["हिन्दी", "বাংলা", "தமிழ்", "ಕನ್ನಡ", "తెలుగు", "ગુજરાતી"],
  known: {
    ask: "வணக்கம், வாபஸ்?",
    line: "திரும்பப் பெறுதல் · 7 நாள்",
    answer: "ஏழு நாட்களுக்குள்.",
  },
  missing: {
    spine: "ଓଡ଼ିଆ",
    ask: "ନମସ୍କାର, ୱାରେଣ୍ଟି?",
    line: "ୱାରେଣ୍ଟି · ୧ ବର୍ଷ",
    answer: "ଏକ ବର୍ଷର ୱାରେଣ୍ଟି ଅଛି।",
    declined: "ଏହା ମୋ ପାଖରେ ନାହିଁ।",
  },
  captions: [
    "One book per language you answer in.",
    "Asked in Tamil, read off the Tamil page.",
    "Nothing on the shelf for Odia.",
    "Add the book, and it can.",
  ],
};

export function KnowledgeEmpty({ reader }: { reader: string }) {
  return (
    <section className="animate-rise mx-auto grid w-full max-w-4xl min-w-0 overflow-hidden rounded-2xl border border-border md:grid-cols-[1.1fr_1fr]">
      {/* Below md there is no room beside the copy, so the copy carries it
          alone — the same call the template dialog makes. */}
      <div className="relative hidden border-r border-border bg-muted/30 md:block">
        <Loop
          length={LIBRARY_LENGTH}
          still={LIBRARY_STILL}
          viewBox={`0 0 ${LIBRARY_VIEW.w} ${LIBRARY_VIEW.h}`}
          className="absolute inset-0 size-full text-foreground/75"
        >
          {(f) => <Library f={f} script={{ ...SCRIPT, reader }} />}
        </Loop>
      </div>

      <div className="flex flex-col items-start p-6 sm:p-8">
        <h2 className="font-serif text-2xl leading-tight font-light tracking-tight sm:text-3xl">
          Give it something to read.
        </h2>

        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Attach your policies, price lists and FAQs, in every language you answer in. Your agents
          read from them mid-call — and when a caller asks something none of them cover, they say so
          rather than inventing it.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" className="cursor-pointer rounded-full px-4">
            <Plus data-icon="inline-start" />
            Add a source
          </Button>
          <Button variant="outline" size="lg" className="cursor-pointer rounded-full px-4">
            <Upload data-icon="inline-start" className="text-muted-foreground" />
            Upload files
          </Button>
        </div>

        <p className="mt-6 text-[13px] text-muted-foreground">
          Sources are shared across every agent in the workspace.
        </p>
      </div>
    </section>
  );
}
