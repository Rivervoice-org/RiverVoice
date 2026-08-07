"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Mascot } from "@/mascots";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { useAgents } from "@/lib/agents/queries";
import type { AgentSummary } from "@/lib/agents/types";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

const columns: ColumnDef<AgentSummary, unknown>[] = [
  {
    accessorKey: "name",
    header: "Agent",
    cell: ({ row }) => {
      const agent = row.original;
      return (
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          {/* Lit only while the agent is answering */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
              agent.status === "live" ? "bg-river" : "bg-transparent group-hover:bg-border",
            )}
          />
          <Mascot seed={agent.mascot ?? agent.name} size={30} />
          <span className="min-w-0">
            <span className="block truncate leading-5 font-medium">{agent.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{agent.purpose}</span>
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "editedBy",
    header: "Edited by",
    size: 200,
    meta: { className: "hidden sm:table-cell text-xs text-muted-foreground truncate" },
  },
  {
    accessorKey: "editedAt",
    header: "Last modified",
    size: 104,
    cell: ({ row }) => timeAgo(row.original.editedAt),
    meta: { className: "text-xs text-muted-foreground truncate" },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 44,
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Options for ${row.original.name}`}
        className="cursor-pointer text-muted-foreground transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <MoreHorizontal />
      </Button>
    ),
    meta: { className: "text-right" },
  },
];

/** The agents you already have, read as lines on a switchboard. */
export function AgentBoard() {
  const router = useRouter();
  const agents = useAgents();

  return (
    <section
      className="animate-rise mx-auto mt-8 w-full max-w-4xl min-w-0"
      style={{ animationDelay: "80ms" }}
    >
      <DataTable
        columns={columns}
        data={agents.data ?? []}
        searchPlaceholder="Find an agent"
        pageSize={10}
        initialSorting={[{ id: "editedAt", desc: true }]}
        toolbar={<h2 className="text-sm font-medium">On the board</h2>}
        empty={
          agents.isPending
            ? "Loading…"
            : (agents.error?.message ?? "No agents yet. Describe one above to get started.")
        }
        onRowClick={(agent) => router.push(`/build-agent/${agent.id}`)}
      />
    </section>
  );
}
