"use client";

import * as React from "react";
import { Plus, Search } from "lucide-react";

import { systemTools } from "@/components/dashboard/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** A page of a spec, half filled in — what a tool is before you write it. */
function EmptyMark() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden className="size-28 text-border">
      <path
        d="M24 12h48l24 24v72a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z"
        fill="currentColor"
        opacity="0.25"
      />
      <path d="M72 12l24 24H76a4 4 0 0 1-4-4V12Z" fill="currentColor" opacity="0.45" />
      <g fill="currentColor">
        <circle cx="38" cy="52" r="6" opacity="0.8" />
        <rect x="50" y="48" width="44" height="8" rx="4" opacity="0.5" />
        <circle cx="38" cy="72" r="6" opacity="0.55" />
        <rect x="50" y="68" width="28" height="8" rx="4" opacity="0.35" />
        <circle cx="38" cy="92" r="6" opacity="0.35" />
        <rect x="50" y="88" width="36" height="8" rx="4" opacity="0.25" />
      </g>
    </svg>
  );
}

function CustomTools() {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <EmptyMark />

      <h3 className="mt-6 font-serif text-2xl leading-tight font-light tracking-tight">
        Let your agent take action
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        Give it something to call — look up an order, check a booking, verify who is on the line —
        and it can use the answer mid-conversation.
      </p>

      <Button size="lg" className="mt-6 rounded-full px-4">
        <Plus data-icon="inline-start" />
        Add tool
      </Button>
    </div>
  );
}

function SystemTools() {
  return (
    <div className="surface divide-y divide-border overflow-hidden">
      {systemTools.map((tool) => (
        <div key={tool.name} className="flex items-center gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{tool.name}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{tool.purpose}</p>
          </div>
          {tool.required ? (
            <span className="shrink-0 text-xs text-muted-foreground">Always on</span>
          ) : (
            <Switch defaultChecked={tool.on} className="shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export function BuilderTools() {
  const [kind, setKind] = React.useState<"custom" | "system">("custom");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4">
        <Tabs
          value={kind}
          onValueChange={(value) => setKind(value as "custom" | "system")}
          className="flex w-full min-w-0 flex-col gap-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <TabsList className="h-9 w-fit shrink-0 rounded-lg p-1">
              <TabsIndicator />
              <TabsTrigger value="custom" className="flex-none rounded-md px-4 text-[13px]">
                Custom tools
              </TabsTrigger>
              <TabsTrigger value="system" className="flex-none rounded-md px-4 text-[13px]">
                System tools
              </TabsTrigger>
            </TabsList>

            <div className="relative ml-auto w-full max-w-60">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search"
                aria-label="Search tools"
                className="h-9 rounded-lg pr-3 pl-8.5"
              />
            </div>

            <Button size="lg" className="px-3">
              <Plus data-icon="inline-start" />
              Add tool
            </Button>
          </div>
        </Tabs>

        {kind === "custom" ? <CustomTools /> : <SystemTools />}
      </div>
    </div>
  );
}
