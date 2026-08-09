"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { Mascot } from "@/mascots";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCloneAgent, useDeleteAgent } from "@/lib/agents/queries";
import type { AgentSummary } from "@/lib/agents/types";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * How the row menu reaches the board. The columns are built once at module
 * scope, and a dialog rendered inside the menu would unmount the moment the menu
 * closed — so the menu only sets state and the board owns the one dialog.
 */
const RowMenu = React.createContext<{
  clone: (agent: AgentSummary) => void;
  askDelete: (agent: AgentSummary) => void;
  /** The id being cloned, so only that row's item says so. */
  cloning: string | null;
}>({ clone: () => {}, askDelete: () => {}, cloning: null });

function RowActions({ agent }: { agent: AgentSummary }) {
  const { clone, askDelete, cloning } = React.useContext(RowMenu);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Options for ${agent.name}`}
            // The row itself opens the builder, so the menu must not open it too.
            onClick={(event) => event.stopPropagation()}
            className="cursor-pointer text-muted-foreground transition-opacity focus-visible:opacity-100 aria-expanded:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-44 p-1"
        onClick={(event) => event.stopPropagation()}
      >
        {/* No confirm: a clone adds a row and changes nothing, and the copy is
            named rather than colliding, so there is nothing to warn about. */}
        <DropdownMenuItem
          disabled={cloning === agent.id}
          onClick={() => clone(agent)}
          className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]"
        >
          <Copy className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {cloning === agent.id ? "Cloning…" : "Clone agent"}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => askDelete(agent)}
          className="cursor-pointer gap-2.5 px-2 py-2 text-[13px]"
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
          Delete agent
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
    cell: ({ row }) => <RowActions agent={row.original} />,
    meta: { className: "text-right" },
  },
];

/** The agents you already have, read as lines on a switchboard. */
export function AgentBoard({ agents, failed }: { agents: AgentSummary[]; failed?: boolean }) {
  const router = useRouter();
  const cloneAgent = useCloneAgent();
  const deleteAgent = useDeleteAgent();

  // Asked rather than done: an agent answers a phone, and there is no undo.
  const [pending, setPending] = React.useState<AgentSummary | null>(null);

  const menu = React.useMemo(
    () => ({
      clone: (agent: AgentSummary) => cloneAgent.mutate(agent.id),
      askDelete: setPending,
      cloning: cloneAgent.isPending ? (cloneAgent.variables ?? null) : null,
    }),
    [cloneAgent],
  );

  return (
    <section
      className="animate-rise mx-auto mt-8 w-full max-w-4xl min-w-0"
      style={{ animationDelay: "80ms" }}
    >
      <RowMenu.Provider value={menu}>
        <DataTable
          columns={columns}
          data={agents}
          searchPlaceholder="Find an agent"
          pageSize={10}
          initialSorting={[{ id: "editedAt", desc: true }]}
          toolbar={<h2 className="text-sm font-medium">On the board</h2>}
          // An empty board and an unreachable one look identical otherwise, and
          // telling someone they have no agents when they do is the worse lie.
          empty={
            failed
              ? "Could not reach the server. Refresh to try again."
              : "No agents yet. Describe one above to get started."
          }
          onRowClick={(agent) => router.push(`/build-agent/${agent.id}`)}
        />
      </RowMenu.Provider>

      <Dialog
        open={pending !== null}
        onOpenChange={(open: boolean) => {
          // Not while it is running, or the row would go without an answer.
          if (!open && !deleteAgent.isPending) {
            setPending(null);
            deleteAgent.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {pending?.name}?</DialogTitle>
            <DialogDescription>
              Its versions, settings and tools go with it. Any number pointed at this agent stops
              being answered. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Shown here rather than on the board, because the row it belongs to
              is the one about to disappear. */}
          {deleteAgent.error ? (
            <p role="alert" className="text-[13px] text-destructive">
              {deleteAgent.error.message}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleteAgent.isPending}
              onClick={() => setPending(null)}
              className="cursor-pointer"
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={deleteAgent.isPending}
              onClick={() => {
                if (!pending) return;
                deleteAgent.mutate(pending.id, { onSuccess: () => setPending(null) });
              }}
              className="cursor-pointer"
            >
              {deleteAgent.isPending ? "Deleting…" : "Delete agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
