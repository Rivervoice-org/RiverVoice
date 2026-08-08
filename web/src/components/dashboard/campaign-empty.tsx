"use client";

import { Plus } from "lucide-react";

import { Loop } from "@/motion/loop";
import {
  CAMPAIGN_LENGTH,
  CAMPAIGN_STILL,
  CAMPAIGN_VIEW,
  Campaign,
  type CampaignScript,
} from "@/motion/sections/campaign";
import { Button } from "@/components/ui/button";

/**
 * What an outbound campaign is, before there is one.
 *
 * The worry a first-time buyer arrives with is not "will it dial" — it is "will
 * this embarrass me". So the scene spends two of its five rows on restraint: one
 * caller asks not to be rung again and is struck off, and one is never dialled
 * because it is outside their hours. The copy beside it says the same thing in
 * the same order.
 */
const SCRIPT: CampaignScript = {
  rows: [
    "+91 98450 22118",
    "+91 99012 47730",
    "+91 90080 15562",
    "+91 96320 88401",
    "+91 94487 30219",
  ],
  outcomes: {
    booked: "Booked",
    noAnswer: "No answer",
    optedOut: "Removed",
    held: "Held · after 9pm",
  },
  optOut: "मुझे दोबारा मत बुलाना।",
  tally: "4 dialled · 2 booked · 1 removed",
  captions: [
    "Your list, called one at a time.",
    "What happened, written back beside each.",
    "Asked to stop — struck off for good.",
    "And nobody rung outside their hours.",
  ],
};

export function CampaignEmpty() {
  return (
    <section className="animate-rise mx-auto grid w-full max-w-4xl min-w-0 overflow-hidden rounded-2xl border border-border md:grid-cols-[1.1fr_1fr]">
      {/* Below md there is no room beside the copy, so the copy carries it
          alone — the same call the knowledge base and template dialog make. */}
      <div className="relative hidden border-r border-border bg-muted/30 md:block">
        <Loop
          length={CAMPAIGN_LENGTH}
          still={CAMPAIGN_STILL}
          viewBox={`0 0 ${CAMPAIGN_VIEW.w} ${CAMPAIGN_VIEW.h}`}
          className="absolute inset-0 size-full text-foreground/75"
        >
          {(f) => <Campaign f={f} script={SCRIPT} />}
        </Loop>
      </div>

      <div className="flex flex-col items-start p-6 sm:p-8">
        <h2 className="font-serif text-2xl leading-tight font-light tracking-tight sm:text-3xl">
          Call the list for you.
        </h2>

        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Upload a list and pick the agent to run it. It works down the numbers one at a time and
          writes back what happened on each — booked, no answer, call again later.
        </p>

        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
          Anyone who asks not to be called again is struck off for good, and nobody is dialled
          outside the hours you set.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" className="cursor-pointer rounded-full px-4">
            <Plus data-icon="inline-start" />
            New campaign
          </Button>
        </div>

        <p className="mt-6 text-[13px] text-muted-foreground">
          Campaigns bill the same minutes as inbound calls.
        </p>
      </div>
    </section>
  );
}
