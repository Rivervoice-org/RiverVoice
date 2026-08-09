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
import { useDebouncedCallback } from "@/hooks/use-debounced-callback";
import { useNavigationContext } from "@/hooks/use-navigation-context";
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
    // "29 seconds ago" on the server is "31 seconds ago" once the browser
    // hydrates. The clock moving is not a mismatch worth regenerating over.
    cell: ({ row }) => (
      <time dateTime={row.original.editedAt} suppressHydrationWarning>
        {timeAgo(row.original.editedAt)}
      </time>
    ),
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

/** As it arrives off the url, which is where the board keeps its state. */
type BoardProps = {
  agents: AgentSummary[];
  total: number;
  page: number;
  size: number;
  search: string;
  failed?: boolean;
};

/** The agents you already have, read as lines on a switchboard. */
export function AgentBoard({ agents, total, page, size, search, failed }: BoardProps) {
  const router = useRouter();
  const { searchParams, navigate, isNavigating } = useNavigationContext();
  const cloneAgent = useCloneAgent();
  const deleteAgent = useDeleteAgent();

  // Defaults stay out of the url, so /agents is clean until someone acts.
  const set = React.useCallback(
    (key: string, value: string | number, fallback: string | number) => {
      if (String(value) === String(fallback)) searchParams.delete(key);
      else searchParams.set(key, String(value));
    },
    [searchParams],
  );

  const goToPage = ({ pageIndex, pageSize }: { pageIndex: number; pageSize: number }) => {
    set("size", pageSize, 10);
    set("page", pageSize === size ? pageIndex + 1 : 1, 1);
    navigate({ searchParams });
  };

  // replace rather than push, or the back button walks you through your own
  // keystrokes.
  const runSearch = useDebouncedCallback((value: string) => {
    set("q", value.trim(), "");
    searchParams.delete("page");
    navigate({ searchParams, replace: true });
  }, 300);

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
          initialSorting={[{ id: "editedAt", desc: true }]}
          toolbar={<h2 className="text-sm font-medium">On the board</h2>}
          rowCount={total}
          pagination={{ pageIndex: page - 1, pageSize: size }}
          onPaginationChange={goToPage}
          searchQuery={search}
          onSearch={runSearch}
          isPending={isNavigating}
          // Four states: nothing reachable, nothing matching, a page past the
          // end, and an actually empty board. Only the last one is an invitation
          // to create something.
          empty={
            failed
              ? "Could not reach the server. Refresh to try again."
              : search
                ? `No agent matches “${search}”.`
                : total > 0
                  ? "Nothing on this page."
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
