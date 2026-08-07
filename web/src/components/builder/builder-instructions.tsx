import { Languages, Sparkles } from "lucide-react";

import type { Agent } from "@/components/dashboard/data";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="w-fit border-b border-border pb-1 text-[13px] font-medium text-muted-foreground">
      {children}
    </h2>
  );
}

export function BuilderInstructions({ agent }: { agent: Agent }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
        {/* Greeting */}
        <section className="flex flex-col gap-3">
          <SectionLabel>Greeting</SectionLabel>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
            <Input
              defaultValue={`Hi, I am ${agent.voice} calling from Rivervoice. How can I help you today?`}
              aria-label="Greeting"
              placeholder="The first thing the caller hears"
              className="h-9 w-full min-w-0 flex-1 border-0 bg-transparent px-0 text-base shadow-none placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent"
            />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 cursor-pointer rounded-full text-muted-foreground"
            >
              <Languages data-icon="inline-start" />
              Translations
            </Button>
          </div>
        </section>

        {/* Prompt */}
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <SectionLabel>Instructions</SectionLabel>

          <Textarea
            aria-label="Agent instructions"
            placeholder="Write the agent prompt. Type / for commands, @ to mention variables or tools."
            className="min-h-64 w-full flex-1 resize-none border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent"
          />
        </section>
      </div>

      {/* One action, centred, out of the way of the writing */}
      <div className="flex shrink-0 justify-center px-4 pb-6 sm:px-6">
        <Button
          variant="outline"
          size="lg"
          className="cursor-pointer rounded-full px-4 shadow-(--shadow-float)"
        >
          <Sparkles data-icon="inline-start" />
          Review agent
        </Button>
      </div>
    </div>
  );
}
