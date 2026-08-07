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

      <ol className="mt-10 grid gap-3 sm:mt-14 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal
            key={step.title}
            as="li"
            /* The row deals itself out left to right */
            delay={index * 110}
            className="flex"
          >
            {/* `group` lets the mascot lean when anywhere on the card is hovered */}
            <Card className="group h-full w-full [--card-spacing:--spacing(8)] transition-shadow duration-300 hover:shadow-(--shadow-lift)">
              <CardHeader className="gap-0">
                <Mascot seed={step.seed} size={56} talking talkDelay={step.delay} />

                <span className="mt-7 font-mono text-xs text-muted-foreground tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <CardTitle className="mt-2 text-lg tracking-[-0.02em]">{step.title}</CardTitle>
              </CardHeader>

              <CardContent>
                <CardDescription className="text-[15px] leading-7">{step.body}</CardDescription>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
