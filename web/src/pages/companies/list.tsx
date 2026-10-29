import { BuildingIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import type { Company } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { CompanyMark } from "@/components/company-mark";
import { columnHelper, DataTable, SortHeader } from "@/components/data-table";
import { Page, PageHeader } from "@/components/page";
import { Person } from "@/components/person";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import { useCompanies } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";

const col = columnHelper<Company>();
const columns = col.columns([
  col.accessor("name", {
    header: ({ column }) => <SortHeader column={column} title="Company" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <CompanyMark name={row.original.name} />
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.domain}</div>
        </div>
      </div>
    ),
  }),
  col.accessor("industry", { header: "Industry", cell: ({ getValue }) => getValue() ?? "" }),
  col.accessor("size", { header: "Employees", cell: ({ getValue }) => getValue() ?? "" }),
  col.accessor("contact_count", {
    header: ({ column }) => <SortHeader column={column} title="People" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
  }),
  col.accessor("open_deal_value", {
    header: ({ column }) => <SortHeader column={column} title="Open pipeline" />,
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() ? formatMoney(getValue()) : "—"}</span>,
  }),
  col.accessor("owner_name", { header: "Owner", cell: ({ getValue }) => <Person name={getValue()} /> }),
]);

export function CompaniesPage() {
  const navigate = useNavigate();
  const { create } = useActions();
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const { data, isPending } = useCompanies({ q });

  return (
    <Page>
      <PageHeader
        title="Companies"
        description="The organizations behind your contacts and deals."
        actions={
          <Button onClick={() => create({ kind: "company" })}>
            <BuildingIcon />
            New company
          </Button>
        }
      />
      <div className="relative w-full sm:w-72">
        <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or website"
          className="pl-8"
        />
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={isPending}
        empty={q ? "No companies match." : "No companies yet."}
        onRowClick={(c) => navigate(`/companies/${c.id}`)}
      />
    </Page>
  );
}
