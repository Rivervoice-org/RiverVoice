import { Mascot } from "@/mascots";
import { Reveal } from "@/components/marketing/reveal";
import { SectionHeading } from "@/components/marketing/section-heading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Three steps, and they are genuinely sequential — you cannot point an agent at
 * a number before you have described it — so the order carries information and
 * earns being numbered.
 *
 * Each step gets the agent it produces, mid-sentence. The mascots are the same
 * ones the dashboard draws from an agent's name, so the character you meet here
 * is the character you get.
 */
const STEPS = [
  {
    seed: "Front desk",
    title: "Describe the job",
    body: "Write what it should handle the way you would tell a new hire. No flowcharts, no intent trees, no sample dialogue.",
    delay: "0s",
  },
  {
    seed: "Order status",
    title: "Point it at a number",
    body: "Bring the line you already advertise, or take a fresh one. It starts picking up on the first ring the same afternoon.",
    delay: "0.9s",
  },
  {
    seed: "Renewals",
    title: "Correct it once",
    body: "Read what it told people. Change an answer you do not like and it holds, from the very next ring onward.",
    delay: "1.8s",
  },
];

/**
 * The line that says these are steps and not three features.
 *
 * It runs in the gap *above* the row, with a mark over each card. Drawn across
 * the row it was invisible: the cards have a solid background, so a line behind
 * them only ever showed through two twelve-pixel gaps, and one drawn over them
 * would cut through the type.
 *
 * Desktop only — below md the cards stack, and a horizontal thread would be
 * drawing a relationship that is no longer on screen. Same technique as the
 * hero's swash, starting after the last card has landed so it joins things that
 * are already there.
 */
function Thread() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 300 8"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-6 hidden h-2 w-full text-amber md:block"
    >
      <g className="thread-draw" stroke="currentColor" fill="none" strokeLinecap="round">
        <path d="M50 4 H250" strokeWidth="1" pathLength={1} strokeDasharray={1} />
      </g>
      {/* A mark over each card, so the line is plainly joining these three */}
      {[50, 150, 250].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={4}
          r={2}
          fill="currentColor"
          className="animate-count-in"
          style={{ animationDelay: `${600 + i * 220}ms` }}
        />
      ))}
    </svg>
  );
}

export function Steps() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <Reveal>
        <SectionHeading
          eyebrow="Three steps"
          title="An agent on the phone by this afternoon."
          blurb="The work is describing what should happen on the call. Everything after that is ours."
          className="mx-auto text-center"
        />
      </Reveal>

      {/* The thread. Three steps that are genuinely sequential should look it,
          so a hairline draws left to right behind the row once — then settles
          back to a quarter opacity and stops being the point. */}
      <div className="relative">
        <Thread />

        <ol className="relative mt-10 grid gap-3 sm:mt-14 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              /* The row deals itself out left to right */
              delay={index * 130}
              className="flex"
            >
              {/* `group` lets the mascot lean when anywhere on the card is hovered */}
              <Card className="group h-full w-full [--card-spacing:--spacing(8)] transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-[3px] hover:border-amber/30 hover:shadow-(--shadow-lift) hover:duration-200 motion-reduce:hover:translate-y-0">
                <CardHeader className="gap-0">
                  {/* Each card's own three sub-beats, offset from its entrance */}
                  <span
                    className="animate-rise block w-fit"
                    style={{ animationDelay: `${index * 130 + 100}ms` }}
                  >
                    <Mascot seed={step.seed} size={56} talking talkDelay={step.delay} />
                  </span>

                  <span
                    className="animate-count-in mt-7 block font-mono text-xs text-muted-foreground tabular-nums"
                    style={{ animationDelay: `${index * 130 + 180}ms` }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span
                    className="animate-rise block"
                    style={{ animationDelay: `${index * 130 + 240}ms` }}
                  >
                    <CardTitle className="mt-2 text-lg tracking-[-0.02em]">{step.title}</CardTitle>
                  </span>
                </CardHeader>

                <CardContent
                  className="animate-rise"
                  style={{ animationDelay: `${index * 130 + 240}ms` }}
                >
                  <CardDescription className="text-[15px] leading-7">{step.body}</CardDescription>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
