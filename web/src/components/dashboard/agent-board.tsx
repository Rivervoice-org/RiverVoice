"use client";

import { MoreHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { agents, type Agent } from "@/components/dashboard/data";
import { Mascot } from "@/components/dashboard/mascot";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";

const columns: ColumnDef<Agent, unknown>[] = [
  {
    accessorKey: "name",
    header: "Agent",
    cell: ({ row }) => {
      const agent = row.original;
      return (
        <div className="flex min-w-0 items-center gap-4">
          {/* Lit only while the agent is answering */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
              agent.status === "live" ? "bg-river" : "bg-transparent group-hover:bg-border",
            )}
          />
          <Mascot seed={agent.name} size={30} />
          <span className="min-w-0">
            <span className="block truncate leading-5 font-medium">{agent.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{agent.purpose}</span>
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "owner",
    header: "Edited by",
    size: 200,
    meta: { className: "hidden sm:table-cell text-xs text-muted-foreground truncate" },
  },
  {
    accessorKey: "edited",
    header: "Last modified",
    size: 130,
    meta: { className: "text-xs text-muted-foreground" },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 48,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${row.original.name}`}
        className="cursor-pointer text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <MoreHorizontal />
      </Button>
    ),
    meta: { className: "text-right" },
  },
];

/** The agents you already have, read as lines on a switchboard. */
export function AgentBoard() {
  const live = agents.filter((agent) => agent.status === "live").length;

  return (
    <section className="animate-rise" style={{ animationDelay: "80ms" }}>
      <DataTable
        columns={columns}
        data={agents}
        searchPlaceholder="Find an agent"
        initialSorting={[{ id: "edited", desc: false }]}
        toolbar={
          <>
            <h2 className="text-sm font-medium">On the board</h2>
            <span className="text-xs text-muted-foreground">
              {live} of {agents.length} answering
            </span>
          </>
        }
        empty="No agents yet. Describe one above to get started."
        onRowClick={() => {}}
      />
    </section>
  );
}
