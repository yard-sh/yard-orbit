import { SearchIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { CONTACT_STATUSES } from "@shared/constants";
import type { Contact } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { StatusBadge } from "@/components/badges";
import { columnHelper, DataTable, SortHeader } from "@/components/data-table";
import { Page, PageHeader } from "@/components/page";
import { Person, PersonAvatar } from "@/components/person";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelative, fullName } from "@/lib/format";
import { useContacts } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";

const col = columnHelper<Contact>();
const columns = col.columns([
  col.accessor((c) => fullName(c), {
    id: "name",
    header: ({ column }) => <SortHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <PersonAvatar name={fullName(row.original)} className="size-8" />
        <div className="min-w-0">
          <div className="truncate font-medium">{fullName(row.original)}</div>
          <div className="text-muted-foreground truncate text-xs">{row.original.email}</div>
        </div>
      </div>
    ),
  }),
  col.accessor("company_name", {
    header: ({ column }) => <SortHeader column={column} title="Company" />,
    cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  col.accessor("title", { header: "Title", cell: ({ getValue }) => getValue() ?? "" }),
  col.accessor("status", { header: "Status", cell: ({ getValue }) => <StatusBadge status={getValue()} /> }),
  col.accessor("owner_name", { header: "Owner", cell: ({ getValue }) => <Person name={getValue()} /> }),
  col.accessor("updated_at", {
    header: ({ column }) => <SortHeader column={column} title="Updated" />,
    cell: ({ getValue }) => <span className="text-muted-foreground">{formatRelative(getValue())}</span>,
  }),
]);

const ALL = "all";

export function ContactsPage() {
  const navigate = useNavigate();
  const { create } = useActions();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const q = useDebounced(search);
  const { data, isPending } = useContacts({ q, status: status === ALL ? null : status });

  return (
    <Page>
      <PageHeader
        title="Contacts"
        description="Everyone you sell to and work with."
        actions={
          <Button onClick={() => create({ kind: "contact" })}>
            <UserPlusIcon />
            New contact
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or company"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {CONTACT_STATUSES.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={isPending}
        empty={q || status !== ALL ? "No contacts match." : "No contacts yet. Add your first one."}
        onRowClick={(c) => navigate(`/contacts/${c.id}`)}
      />
    </Page>
  );
}
