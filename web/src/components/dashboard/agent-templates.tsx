import { ArrowRight } from "lucide-react";

import { agentTemplates, templateCategories } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function Roster({ items }: { items: typeof agentTemplates }) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-12 text-center text-sm text-muted-foreground">
        Nobody here for that job yet. Write the opening line above instead.
      </p>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((template) => (
        <button
          key={template.name}
          type="button"
          className="surface group flex cursor-pointer items-start gap-4 p-4 text-left transition-shadow hover:shadow-(--shadow-float) focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {/* The mascot is the card — it is how you tell one from another */}
          <Mascot
            seed={template.name}
            size={40}
            className="mt-0.5 transition-transform group-hover:-rotate-6"
          />

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{template.name}</span>
              <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">
              {template.description}
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
  return (
    <section className="animate-rise flex flex-col gap-3 pb-2" style={{ animationDelay: "120ms" }}>
      <Tabs defaultValue="all" className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
          <h2 className="text-sm font-medium">Hire from the roster</h2>
          <span className="text-xs text-muted-foreground">Start from one and change anything</span>
          <TabsList variant="line" className="ml-auto h-8">
            <TabsTrigger value="all">All</TabsTrigger>
            {templateCategories.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="all">
          <Roster items={agentTemplates} />
        </TabsContent>
        {templateCategories.map((category) => (
          <TabsContent key={category} value={category}>
            <Roster items={agentTemplates.filter((t) => t.category === category)} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
