import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_text,
  tableFeatures,
  useTable,
  type CellData,
  type Column,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Lists are filtered on the server (?q=, ?status=) and sorted and paged
// here, so the table registers just those two features.
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
});

type Features = typeof features;
// Column value types vary per column, so the list is typed loosely here.
export type Columns<T extends RowData> = ColumnDef<Features, T, any>[];
export const columnHelper = <T extends RowData>() => createColumnHelper<Features, T>();

const EMPTY: never[] = [];

export function DataTable<T extends RowData & { id: string }>({
  columns,
  data,
  loading,
  empty,
  onRowClick,
}: {
  columns: Columns<T>;
  data: T[] | undefined;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  const table = useTable({
    features,
    columns,
    data: data ?? EMPTY,
    getRowId: (row) => row.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });
  const rows = table.getRowModel().rows;
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="h-10">
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && !data
              ? Array.from({ length: 6 }, (_, i) => (
                  <TableRow key={i}>
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(onRowClick && "cursor-pointer")}
                    onClick={onRowClick && (() => onRowClick(row.original))}
                  >
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="max-w-64 truncate">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
            {!loading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="text-muted-foreground h-32 text-center">
                  {empty ?? "Nothing here yet."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <span>
            {data?.length ?? 0} rows · page {table.state.pagination.pageIndex + 1} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SortHeader<T extends RowData, V extends CellData>({
  column,
  title,
}: {
  column: Column<Features, T, V>;
  title: string;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ChevronsUpDownIcon;
  return (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={column.getToggleSortingHandler()}>
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} />
    </Button>
  );
}
