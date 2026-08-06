"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Sparkles,
} from "lucide-react";

import type { Agent } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function BuilderTopbar({
  agent,
  assistantOpen,
  onToggleAssistant,
}: {
  agent: Agent;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(agent.name);
  const live = agent.status === "live";
  const version = live ? "v3" : "v1";
  const state = live ? "Live" : "Draft";

  // Newest first. Only the top one is editable; the rest are committed.
  const versions = live
    ? [
        { label: "v3", state: "Live", when: agent.edited, current: true },
        { label: "v2", state: "Committed", when: "1 week ago", current: false },
        { label: "v1", state: "Committed", when: "3 weeks ago", current: false },
      ]
    : [{ label: "v1", state: "Draft", when: agent.edited, current: true }];

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Back to agents"
        className="cursor-pointer text-muted-foreground"
        render={<Link href="/agents" />}
      >
        <ChevronLeft />
      </Button>

      <Mascot seed={agent.name} size={26} />

      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") setEditing(false);
          }}
          aria-label="Agent name"
          className="h-7 w-44 rounded-md border border-foreground/30 bg-transparent px-1.5 text-sm font-medium outline-none"
        />
      ) : (
        <span className="truncate text-sm font-medium">{name}</span>
      )}

      <span aria-hidden className="text-muted-foreground/50">
        /
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-border px-2.5 text-[13px] transition-colors hover:bg-accent aria-expanded:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
          }
        >
          <span
            aria-hidden
            className={cn("size-1.5 rounded-full", live ? "bg-river" : "bg-amber")}
          />
          <span className="font-mono tabular-nums">{version}</span>
          <span className="text-muted-foreground">{state}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72 p-1">
          <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground">Versions</p>

          {versions.map((entry) => (
            <DropdownMenuItem key={entry.label} className="cursor-pointer gap-2.5 px-2 py-2">
              <span
                aria-hidden
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  entry.state === "Live"
                    ? "bg-river"
                    : entry.state === "Draft"
                      ? "bg-amber"
                      : "bg-border",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-1.5">
                  <span className="font-mono text-[13px] tabular-nums">{entry.label}</span>
                  <span className="text-xs text-muted-foreground">{entry.state}</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {agent.owner} · {entry.when}
                </span>
              </span>
              {entry.current ? <Check className="size-3.5 shrink-0 text-muted-foreground" /> : null}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />

          <DropdownMenuItem className="cursor-pointer gap-2.5 px-2 py-2">
            <Plus className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px]">Commit agent</span>
              <span className="block text-[11px] text-muted-foreground">
                Freeze this draft as {live ? "v4" : "v2"}
              </span>
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-1.5">
        {assistantOpen ? null : (
          <Button
            variant="outline"
            size="lg"
            className="cursor-pointer rounded-full px-4"
            onClick={onToggleAssistant}
          >
            <Sparkles data-icon="inline-start" className="text-muted-foreground" />
            Improve with Rivervoice
          </Button>
        )}

        <Button size="lg" className="cursor-pointer rounded-full px-4">
          <Phone data-icon="inline-start" />
          Test agent
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="More options"
                className="cursor-pointer rounded-full text-muted-foreground"
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52 p-1">
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]"
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Edit name
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]"
              onClick={() => navigator.clipboard?.writeText(agent.id)}
            >
              <Copy className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Copy agent ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
