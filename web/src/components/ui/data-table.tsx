"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Per-column layout, so callers style cells where they define them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Applied to both the header cell and every body cell in the column. */
    className?: string;
  }
}

const PAGE_SIZES = [5, 10, 25, 50];

export type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Renders a search field in the toolbar when set. */
  searchPlaceholder?: string;
  /** Extra controls, shown at the start of the toolbar. */
  toolbar?: React.ReactNode;
  /** Controls shown at the end of the toolbar, after the search field. */
  actions?: React.ReactNode;
  /** Shown in place of rows when there is nothing to list. */
  empty?: string;
  initialSorting?: SortingState;
  /** Turns on paging at this size. Omit to show everything. */
  pageSize?: number;
  onRowClick?: (row: TData) => void;
  rowClassName?: (row: TData) => string;
  className?: string;
};

/**
 * One table for the whole app: sorting, filtering, and optional paging on top
 * of TanStack Table, dressed in the app's own type and spacing. Callers supply
 * columns and data; everything else is handled here.
 */
export function DataTable<TData>({
  columns,
  data,
  searchPlaceholder,
  toolbar,
  actions,
  empty = "Nothing here yet.",
  initialSorting = [],
  pageSize,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [size, setSize] = React.useState(pageSize ?? 10);
  const [globalFilter, setGlobalFilter] = React.useState("");

  // TanStack Table hands back functions that read mutable internal state, so the
  // compiler bails on this component rather than memoize them and serve stale
  // rows. Nothing derived from `table` leaves this file — it is all consumed by
  // the JSX below — so opting out here costs us nothing beyond this render.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize, pageIndex: 0 } },
        }
      : {}),
  });

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const showToolbar = Boolean(searchPlaceholder || toolbar || actions);

  return (
    <div className={cn("flex min-w-0 flex-col gap-3", className)}>
      {showToolbar ? (
        <div className="flex flex-wrap items-center gap-3 px-1">
          {toolbar}
          {searchPlaceholder ? (
            <div className="relative ml-auto w-full max-w-56">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={globalFilter}
                onChange={(event) => setGlobalFilter(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="rounded-full pr-3 pl-8.5"
              />
            </div>
          ) : null}
          {actions}
        </div>
      ) : null}

      <div className="surface overflow-hidden">
        <Table className="table-fixed">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();

                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() ? `${header.getSize()}px` : undefined }}
                      className={cn(
                        "px-3 text-[11px] font-normal text-muted-foreground first:pl-5 last:pr-3",
                        header.column.columnDef.meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {/* Only the column actually being sorted shows a marker */}
                          {sorted ? (
                            <ChevronDown
                              className={cn(
                                "size-3 transition-transform",
                                sorted === "asc" && "rotate-180",
                              )}
                            />
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="px-5 py-14 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn("group relative cursor-pointer", rowClassName?.(row.original))}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-3 first:pl-5 last:pr-3",
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageSize ? (
        <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
          <span>Rows</span>
          <Select
            value={String(size)}
            onValueChange={(next) => {
              const parsed = Number(next);
              setSize(parsed);
              table.setPageSize(parsed);
              table.setPageIndex(0);
            }}
          >
            <SelectTrigger size="sm" className="h-7 w-16 rounded-full px-2.5 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((option) => (
                <SelectItem key={option} value={String(option)} className="font-mono text-xs">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="font-mono tabular-nums">
            {total === 0 ? 0 : pageIndex * size + 1}–{pageIndex * size + rows.length} of {total}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
            </Button>
            <span className="px-1 font-mono tabular-nums">
              {pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
