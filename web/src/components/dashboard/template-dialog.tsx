"use client";

import * as React from "react";
import { Phone, Sparkles } from "lucide-react";

import { Loop } from "@/motion/loop";
import {
  FRONTDESK_LENGTH,
  FRONTDESK_STILL,
  FRONTDESK_VIEW,
  FrontDesk,
} from "@/motion/agent-templates/frontdesk";
import { SLOTS_LENGTH, SLOTS_STILL, SLOTS_VIEW, Slots } from "@/motion/agent-templates/slots";
import { KHATA_LENGTH, KHATA_STILL, KHATA_VIEW, Khata } from "@/motion/agent-templates/khata";
import { KITE_LENGTH, KITE_STILL, KITE_VIEW, Kite } from "@/motion/agent-templates/kite";
import { PARCEL_LENGTH, PARCEL_STILL, PARCEL_VIEW, Parcel } from "@/motion/agent-templates/parcel";
import { THREAD_LENGTH, THREAD_STILL, THREAD_VIEW, Thread } from "@/motion/agent-templates/thread";
import { Mascot } from "@/mascots";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgent } from "@/lib/agents/queries";
import type { AgentTemplate } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

/**
 * A scene per template, where there is a story worth drawing. Nothing generic:
 * fishing for a slot is the appointment story and a crossing is the collections
 * story, and neither would survive being used for the other.
 */
type Scene = {
  length: number;
  still: number;
  view: { w: number; h: number };
  label: string;
  render: (f: number) => React.ReactNode;
};

const SCENES: Record<string, Scene> = {
  "Appointment management": {
    length: SLOTS_LENGTH,
    still: SLOTS_STILL,
    view: SLOTS_VIEW,
    label: "",
    render: (f) => (
      <Slots
        f={f}
        script={{
          slots: [
            { at: "10:00", free: false },
            { at: "11:30", free: true },
            { at: "2:00", free: true },
            { at: "3:30", free: false },
          ],
          chosen: 2,
          slip: ["మంగళవారం · 2:00", "ప్రియా శర్మ"],
          captions: ["ఎప్పుడు కావాలి?", "రెండు ఖాళీలు ఉన్నాయి", "మంగళవారం 2 గంటలకు, ఖాయం"],
        }}
      />
    ),
  },
  "Sales discovery": {
    length: KITE_LENGTH,
    still: KITE_STILL,
    view: KITE_VIEW,
    label: "",
    render: (f) => (
      <Kite
        f={f}
        script={{
          questions: [
            "What are you trying to fix?",
            "When do you need it live?",
            "Who else signs off?",
          ],
          tag: "Tue, 4–6pm",
          captions: [
            "Three questions.",
            "Each answer, a little higher.",
            "Sales calls back Tuesday.",
          ],
        }}
      />
    ),
  },
  "Front desk": {
    length: FRONTDESK_LENGTH,
    still: FRONTDESK_STILL,
    view: FRONTDESK_VIEW,
    label: "",
    render: (f) => (
      <FrontDesk
        f={f}
        script={{
          sign: ["खुला", "बंद"],
          answer: "छह बजे तक खुला है, एमजी रोड पर।",
          note: ["प्रिया", "98450 22118", "मंगलवार चाहिए"],
          captions: ["Open till six.", "After six, it takes a message.", "Waiting in the morning."],
        }}
      />
    ),
  },
  "Renewal nudge": {
    length: THREAD_LENGTH,
    still: THREAD_STILL,
    view: THREAD_VIEW,
    label: "",
    render: (f) => (
      <Thread
        f={f}
        script={{
          ends: "30 नवंबर तक",
          ask: "क्या इसे बढ़ा दूँ?",
          extended: "अब 30 नवंबर 2027",
          captions: ["This one lapses this month.", "Asked once.", "Carried on a year."],
        }}
      />
    ),
  },
  "Order status": {
    length: PARCEL_LENGTH,
    still: PARCEL_STILL,
    view: PARCEL_VIEW,
    label: "",
    render: (f) => (
      <Parcel
        f={f}
        script={{
          stops: ["Packed", "Left the hub", "Out for delivery", "At your door"],
          tag: "मंगलवार को",
          captions: ["मेरा ऑर्डर कहाँ है?", "अभी देखता हूँ।", "मंगलवार को पहुँचेगा।"],
        }}
      />
    ),
  },
  "EMI collection": {
    length: KHATA_LENGTH,
    still: KHATA_STILL,
    view: KHATA_VIEW,
    label: "",
    render: (f) => (
      <Khata
        f={f}
        script={{
          entries: ["ஜூலை · ₹800", "ஆகஸ்ட் · ₹800", "செப்டம்பர் · ₹800"],
          balance: ["₹2,400", "₹1,600", "₹800", "₹0"],
          cleared: "முடிந்தது",
          captions: ["₹2,400 பாக்கி", "ஒவ்வொன்றாக", "முடிந்தது"],
        }}
      />
    ),
  },
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-[13px]">{value}</span>
    </div>
  );
}

export function TemplateDialog({
  template,
  open,
  onOpenChange,
}: {
  template: AgentTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Templates are agents, so the same endpoint carries their settings and tools.
  const detail = useAgent(template?.id ?? "", undefined, Boolean(template) && open);
  const agent = detail.data;
  const face = template?.mascot ?? template?.name ?? "";

  const scene = SCENES[template?.name ?? ""];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The single row is clamped rather than left on auto: an auto row sizes to
          the tallest column — the About text — and overflows the max height
          instead of scrolling, which took the foot of the panel beside it. */}
      <DialogContent className="max-h-[86vh] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <div className={cn("grid min-h-0", scene && "md:grid-cols-[1fr_1.35fr]")}>
          {/* Finding a time that suits, drawn as what it feels like. */}
          {scene ? (
            <div className="relative hidden overflow-hidden border-r border-border bg-muted/30 md:block md:min-h-[30rem]">
              <Loop
                length={scene.length}
                still={scene.still}
                viewBox={`0 0 ${scene.view.w} ${scene.view.h}`}
                // Sized by height with the width following the viewBox, so the scene
                // always fits its panel exactly — stretching it to the box and
                // relying on preserveAspectRatio was letting the foot of the
                // drawing, where the agent stands, fall outside.
                className="absolute inset-y-0 left-1/2 h-full w-auto -translate-x-1/2 text-foreground/75"
              >
                {scene.render}
              </Loop>

              {scene.label ? (
                <span className="absolute top-6 left-6 z-10 text-[13px] font-medium">
                  {scene.label}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-col overflow-y-auto p-6">
            <Mascot seed={face} size={44} />

            <DialogTitle className="mt-4 text-lg font-medium">{template?.name}</DialogTitle>
            <DialogDescription className="mt-1 text-[13px]">
              {template?.category} · from the Rivervoice roster
            </DialogDescription>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button size="lg" className="cursor-pointer rounded-full px-4">
                Use this template
              </Button>
              {/* With the other actions, always: the panel beside it is hidden
                  below md, so anything living there goes missing with it. */}
              <Button
                variant="outline"
                size="lg"
                disabled
                className="rounded-full px-4 disabled:opacity-100"
              >
                <Phone data-icon="inline-start" className="text-muted-foreground" />
                <span className="text-muted-foreground">Call agent</span>
              </Button>
              <Button variant="secondary" size="lg" className="cursor-pointer rounded-full px-4">
                <Sparkles data-icon="inline-start" className="text-muted-foreground" />
                Customise with Rivervoice
              </Button>
            </div>

            <Tabs defaultValue="about" className="mt-6 flex min-h-0 flex-col gap-3">
              <TabsList variant="line" className="h-8">
                <TabsTrigger value="about">About</TabsTrigger>
                <TabsTrigger value="settings">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="about" className="space-y-4">
                <p className="text-[13px] leading-6 text-muted-foreground">{template?.purpose}</p>

                {agent ? (
                  <>
                    <div>
                      <h3 className="text-[13px] font-medium">Opens with</h3>
                      <p className="mt-1 text-[13px] leading-6 text-muted-foreground">
                        {agent.greeting}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-[13px] font-medium">How it behaves</h3>
                      <p className="mt-1 text-[13px] leading-6 whitespace-pre-line text-muted-foreground">
                        {agent.instructions}
                      </p>
                    </div>
                  </>
                ) : null}
              </TabsContent>

              <TabsContent value="settings">
                {agent ? (
                  <div className="flex flex-col">
                    <Row label="Voice" value={`${agent.voice} · ${agent.ttsProvider}`} />
                    <Row label="Model" value={agent.llmModel} />
                    <Row label="Speaks" value={agent.languages.join(", ")} />
                    <Row label="Opens in" value={agent.startingLanguage} />
                    <Row label="Listens with" value={agent.sttModel} />
                    <Row
                      label="Tools"
                      value={agent.tools.length ? `${agent.tools.length}` : "None"}
                    />
                  </div>
                ) : (
                  <p className="py-6 text-center text-[13px] text-muted-foreground">
                    {detail.error?.message ?? "Reading the configuration…"}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
