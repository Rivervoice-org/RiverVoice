"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";

import { Mascot } from "@/mascots";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TemplateDialog } from "@/components/dashboard/template-dialog";
import { useAgentTemplates } from "@/lib/agents/queries";
import type { AgentTemplate } from "@/lib/agents/types";

function Roster({
  items,
  empty,
  onPick,
}: {
  items: AgentTemplate[];
  empty: string;
  onPick: (template: AgentTemplate) => void;
}) {
  if (items.length === 0) {
    return <p className="px-3 py-12 text-center text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((template) => (
        <button
          key={template.id}
          type="button"
          onClick={() => onPick(template)}
          className="surface group flex cursor-pointer items-start gap-4 p-4 text-left transition-shadow hover:shadow-(--shadow-float) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* The mascot is the card — it is how you tell one from another */}
          <Mascot
            seed={template.mascot ?? template.name}
            size={40}
            className="mt-0.5 transition-transform group-hover:-rotate-6"
          />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{template.name}</span>
              <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              {template.purpose}
            </span>
            <span className="mt-2.5 block text-[11px] text-muted-foreground/80">
              {template.category}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Ready-made agents, waiting to be put on a line. */
export function AgentTemplates() {
  const templates = useAgentTemplates();
  // Held here rather than per card, or closing the dialog would unmount it.
  const [picked, setPicked] = React.useState<AgentTemplate | null>(null);
  const items = templates.data ?? [];

  // From the rows, so seeding a new category does not need a deploy.
  const categories = [...new Set(items.map((item) => item.category))].filter(Boolean);

  const empty = templates.isPending
    ? "Reading the roster…"
    : (templates.error?.message ??
      "Nobody here for that job yet. Write the opening line above instead.");

  return (
    <section
      className="animate-rise mx-auto mt-8 flex w-full max-w-4xl min-w-0 flex-col gap-3 pb-2"
      style={{ animationDelay: "120ms" }}
    >
      <Tabs defaultValue="all" className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          <h2 className="text-sm font-medium">Hire from the roster</h2>
          <span className="text-xs text-muted-foreground">Start from one and change anything</span>
          <div className="-mx-1 w-full overflow-x-auto px-1 lg:ml-auto lg:w-auto">
            <TabsList variant="line" className="h-8">
              <TabsTrigger value="all">All</TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger key={category} value={category}>
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent value="all">
          <Roster items={items} empty={empty} onPick={setPicked} />
        </TabsContent>
        {categories.map((category) => (
          <TabsContent key={category} value={category}>
            <Roster
              items={items.filter((item) => item.category === category)}
              empty={empty}
              onPick={setPicked}
            />
          </TabsContent>
        ))}
      </Tabs>

      <TemplateDialog
        template={picked}
        open={picked !== null}
        onOpenChange={(next) => {
          if (!next) setPicked(null);
        }}
      />
    </section>
  );
}
