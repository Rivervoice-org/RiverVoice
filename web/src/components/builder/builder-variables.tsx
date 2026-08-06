"use client";

import * as React from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { VariableDialog } from "@/components/builder/variable-dialog";
import {
  inputVariables,
  outputVariables,
  type InputVariable,
  type OutputVariable,
} from "@/components/dashboard/data";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Editing =
  { kind: "input"; variable: InputVariable } | { kind: "output"; variable: OutputVariable };

/**
 * One dialog for the whole table, opened either by clicking a row or by the
 * row menu. Rendering a dialog inside the menu would unmount it the moment the
 * menu closes, which is why the trigger only sets state.
 */
const EditContext = React.createContext<(editing: Editing) => void>(() => {});

function RowActions({ onEdit }: { onEdit: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Variable options"
            className="shrink-0 cursor-pointer text-muted-foreground"
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-36 p-1">
        <DropdownMenuItem className="cursor-pointer px-2 py-1.5 text-[13px]" onClick={onEdit}>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" className="cursor-pointer px-2 py-1.5 text-[13px]">
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function InputActions({ variable }: { variable: InputVariable }) {
  const edit = React.useContext(EditContext);
  return <RowActions onEdit={() => edit({ kind: "input", variable })} />;
}

function OutputActions({ variable }: { variable: OutputVariable }) {
  const edit = React.useContext(EditContext);
  return <RowActions onEdit={() => edit({ kind: "output", variable })} />;
}

const inputColumns: ColumnDef<InputVariable, unknown>[] = [
  { accessorKey: "name", header: "Variable name" },
  {
    accessorKey: "fallback",
    header: "Default value",
    meta: { className: "text-muted-foreground" },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 56,
    meta: { className: "text-right" },
    cell: ({ row }) => <InputActions variable={row.original} />,
  },
];

const outputColumns: ColumnDef<OutputVariable, unknown>[] = [
  { accessorKey: "name", header: "Variable name", size: 200 },
  {
    accessorKey: "type",
    header: "Data type",
    size: 120,
    meta: { className: "text-muted-foreground" },
  },
  {
    accessorKey: "prompt",
    header: "Extraction prompt",
    meta: { className: "text-muted-foreground whitespace-normal" },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 56,
    meta: { className: "text-right align-top" },
    cell: ({ row }) => <OutputActions variable={row.original} />,
  },
];

export function BuilderVariables() {
  const [kind, setKind] = React.useState<"input" | "output">("input");
  const [editing, setEditing] = React.useState<Editing | null>(null);

  const segments = (
    <TabsList className="h-9 w-fit shrink-0 rounded-lg p-1">
      <TabsTrigger value="input" className="flex-none cursor-pointer rounded-md px-4 text-[13px]">
        Input variables
      </TabsTrigger>
      <TabsTrigger value="output" className="flex-none cursor-pointer rounded-md px-4 text-[13px]">
        Output variables
      </TabsTrigger>
    </TabsList>
  );

  const addButton = (
    <VariableDialog
      kind={kind}
      mode="create"
      trigger={
        <Button size="lg" className="cursor-pointer px-3">
          <Plus data-icon="inline-start" />
          Add
        </Button>
      }
    />
  );

  return (
    <EditContext.Provider value={setEditing}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6 lg:px-10">
        {/* Keeps the tables readable when the side panel is closed */}
        <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4">
          <Tabs
            value={kind}
            onValueChange={(value) => setKind(value as "input" | "output")}
            className="contents"
          >
            {kind === "output" ? (
              <DataTable
                columns={outputColumns}
                data={outputVariables}
                searchPlaceholder="Search"
                toolbar={segments}
                actions={addButton}
                empty="No output variables yet."
                onRowClick={(variable) => setEditing({ kind: "output", variable })}
              />
            ) : (
              <DataTable
                columns={inputColumns}
                data={inputVariables}
                searchPlaceholder="Search"
                toolbar={segments}
                actions={addButton}
                empty="No input variables yet."
                onRowClick={(variable) => setEditing({ kind: "input", variable })}
              />
            )}
          </Tabs>

          {kind === "output" ? (
            <div className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">When does a call count as a win?</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Score every call on one output variable — call_summary, for instance.
                </p>
              </div>
              <Button variant="outline" size="lg" className="cursor-pointer">
                Set call goal
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Keyed so each variable opens with its own values loaded */}
      {editing ? (
        <VariableDialog
          key={`${editing.kind}-${editing.variable.name}`}
          kind={editing.kind}
          mode="edit"
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          name={editing.variable.name}
          fallback={editing.kind === "input" ? editing.variable.fallback : undefined}
          inContext={editing.kind === "input" ? editing.variable.inContext : undefined}
          type={editing.kind === "output" ? editing.variable.type : undefined}
          prompt={editing.kind === "output" ? editing.variable.prompt : undefined}
        />
      ) : null}
    </EditContext.Provider>
  );
}
