import { KanbanIcon, ListIcon, PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Deal } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { StageBadge } from "@/components/badges";
import { columnHelper, DataTable, SortHeader } from "@/components/data-table";
import { Page, PageHeader } from "@/components/page";
import { Person } from "@/components/person";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDate, formatMoney } from "@/lib/format";
import { useDeals } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";
import { useWorkspace } from "@/lib/workspace";
import { DealBoard } from "./board";

const col = columnHelper<Deal>();
const columns = col.columns([
  col.accessor("title", {
    header: ({ column }) => <SortHeader column={column} title="Deal" />,
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{row.original.title}</div>
        <div className="text-muted-foreground truncate text-xs">{row.original.company_name}</div>
      </div>
    ),
  }),
  col.accessor("value", {
    header: ({ column }) => <SortHeader column={column} title="Value" />,
    cell: ({ getValue }) => <span className="tabular-nums">{formatMoney(getValue())}</span>,
  }),
  col.accessor("stage", { header: "Stage", cell: ({ getValue }) => <StageBadge stage={getValue()} /> }),
  col.accessor("contact_name", { header: "Contact", cell: ({ getValue }) => getValue() ?? "" }),
  col.accessor("owner_name", { header: "Owner", cell: ({ getValue }) => <Person name={getValue()} /> }),
  col.accessor((d) => d.closed_at ?? d.expected_close_at ?? 0, {
    id: "close",
    header: ({ column }) => <SortHeader column={column} title="Close date" />,
    cell: ({ row }) => formatDate(row.original.closed_at ?? row.original.expected_close_at),
  }),
]);

const EVERYONE = "everyone";

export function DealsPage() {
  const navigate = useNavigate();
  const { me } = useWorkspace();
  const { create } = useActions();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "board";
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState(EVERYONE);
  const q = useDebounced(search);
  const { data, isPending } = useDeals({ q, owner_id: owner === EVERYONE ? null : owner });

  return (
    <Page className="min-w-0">
      <PageHeader
        title="Deals"
        description="Drag deals across stages as they progress."
        actions={
          <Button onClick={() => create({ kind: "deal" })}>
            <PlusIcon />
            New deal
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals"
            className="pl-8"
          />
        </div>
        <Select value={owner} onValueChange={setOwner}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EVERYONE}>Everyone</SelectItem>
            <SelectItem value={me.user.id}>My deals</SelectItem>
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(v) => v && setParams(v === "list" ? { view: "list" } : {}, { replace: true })}
          className="ml-auto"
        >
          <ToggleGroupItem value="board" aria-label="Board">
            <KanbanIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List">
            <ListIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === "list" ? (
        <DataTable columns={columns} data={data} loading={isPending} onRowClick={(d) => navigate(`/deals/${d.id}`)} />
      ) : data ? (
        <DealBoard deals={data} />
      ) : (
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0" />
          ))}
        </div>
      )}
    </Page>
  );
}
