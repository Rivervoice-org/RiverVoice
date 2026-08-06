import { ArrowUp, Phone } from "lucide-react";

import { Input } from "@/components/ui/input";

/** "Create an agent" holds still; only the job it is given changes. */
const JOBS = [
  "to call and follow up on overdue payments",
  "for a hospital that books appointments in Kannada",
  "that qualifies leads before sales calls back",
  "to answer the front desk after hours",
  "that reads back where an order has got to",
];

export function AgentComposer() {
  return (
    <section className="animate-rise flex flex-col items-center px-4 py-10 sm:py-14">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground">New agent</p>
      <h2 className="mt-2 text-center font-serif text-3xl leading-tight font-light tracking-tight sm:text-4xl">
        What should this agent do?
      </h2>

      <form className="panel mt-7 flex w-full max-w-2xl items-center gap-3 rounded-full py-2 pr-2 pl-4">
        <Phone className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />

        <div className="relative min-w-0 flex-1">
          {/* A single space keeps :placeholder-shown true while the field is
              empty, which is what hides the animated line once you type. */}
          <Input
            type="text"
            aria-label="Describe the agent"
            placeholder=" "
            className="peer h-9 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-sm dark:bg-transparent"
          />

          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center overflow-hidden text-sm text-muted-foreground peer-[:not(:placeholder-shown)]:hidden"
          >
            <span className="shrink-0 whitespace-nowrap">Create an agent&nbsp;</span>

            {/* The jobs share one grid cell so the line never reflows */}
            <span className="grid min-w-0">
              {JOBS.map((job, i) => (
                <span
                  key={job}
                  className={
                    // Hidden by default so the lines never stack: the animation
                    // is the only thing that reveals one. If motion is off, the
                    // first job stays put and the rest never show.
                    "animate-word-cycle col-start-1 row-start-1 truncate opacity-0" +
                    (i === 0 ? " motion-reduce:opacity-100" : "")
                  }
                  style={{ animationDelay: `${i * 3}s` }}
                >
                  {job}
                </span>
              ))}
            </span>
          </span>
        </div>

        <button
          type="submit"
          aria-label="Draft this agent"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-foreground/25 text-background transition-colors hover:bg-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowUp className="size-4" strokeWidth={2} />
        </button>
      </form>
    </section>
  );
}
