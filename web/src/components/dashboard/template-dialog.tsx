"use client";

import { Phone, Sparkles } from "lucide-react";

import { Loop } from "@/motion/loop";
import {
  FISHER_LENGTH,
  FISHER_STILL,
  FISHER_VIEW,
  Fisher,
  type FisherScript,
} from "@/motion/walkthroughs/fisher";
import { Mascot } from "@/mascots";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAgent } from "@/lib/agents/queries";
import type { AgentTemplate } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

/**
 * Fishing for the right time is the appointment story, not every story — a
 * front desk is not choosing between slots, and collections is not either. The
 * rest of the roster gets its own scene when there is one worth drawing.
 */
const SCENES: Record<string, FisherScript> = {
  "Appointment management": { reject: "10:30", accept: "2:00" },
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

  const script = SCENES[template?.name ?? ""];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <div className={cn("grid min-h-0", script && "md:grid-cols-[1fr_1.35fr]")}>
          {/* Finding a time that suits, drawn as what it feels like. */}
          {script ? (
            <div className="relative hidden overflow-hidden border-r border-border bg-muted/30 md:block">
              <Loop
                length={FISHER_LENGTH}
                still={FISHER_STILL}
                viewBox={`0 0 ${FISHER_VIEW.w} ${FISHER_VIEW.h}`}
                className="absolute inset-0 size-full text-foreground/75"
              >
                {(f) => <Fisher f={f} script={script} />}
              </Loop>

              <span className="absolute top-6 left-6 z-10 text-[13px] font-medium">
                Finding the time
              </span>
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
