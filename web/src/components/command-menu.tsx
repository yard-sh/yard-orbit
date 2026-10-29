import {
  BuildingIcon,
  CheckSquareIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  PlusIcon,
  SettingsIcon,
  UserIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useActions } from "@/components/app-actions";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { formatMoney, fullName } from "@/lib/format";
import { useCompanies, useContacts, useDeals } from "@/lib/queries";

const PAGES = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/contacts", label: "Contacts", icon: UserIcon },
  { to: "/companies", label: "Companies", icon: BuildingIcon },
  { to: "/deals", label: "Deals", icon: HandshakeIcon },
  { to: "/tasks", label: "Tasks", icon: CheckSquareIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search Orbit" description="Jump to a page or record">
      {open && <Results close={() => onOpenChange(false)} />}
    </CommandDialog>
  );
}

// Searches the cached lists in the browser: instant, and the same rows the
// pages show. Mounted only while the menu is open.
function Results({ close }: { close: () => void }) {
  const navigate = useNavigate();
  const { create } = useActions();
  const contacts = useContacts().data ?? [];
  const companies = useCompanies().data ?? [];
  const deals = useDeals().data ?? [];
  const go = (to: string) => {
    navigate(to);
    close();
  };
  const make = (kind: "contact" | "company" | "deal" | "task") => {
    close();
    create({ kind });
  };

  return (
    <>
      <CommandInput placeholder="Search people, companies, deals…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Go to">
          {PAGES.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => go(to)}>
              <Icon />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Create">
          {(["contact", "company", "deal", "task"] as const).map((kind) => (
            <CommandItem key={kind} onSelect={() => make(kind)}>
              <PlusIcon />
              New {kind}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        {contacts.length > 0 && (
          <CommandGroup heading="Contacts">
            {contacts.map((c) => (
              <CommandItem
                key={c.id}
                value={`contact ${fullName(c)} ${c.email ?? ""} ${c.id}`}
                onSelect={() => go(`/contacts/${c.id}`)}
              >
                <UserIcon />
                {fullName(c)}
                {c.company_name && <span className="text-muted-foreground">{c.company_name}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {companies.length > 0 && (
          <CommandGroup heading="Companies">
            {companies.map((c) => (
              <CommandItem
                key={c.id}
                value={`company ${c.name} ${c.domain ?? ""} ${c.id}`}
                onSelect={() => go(`/companies/${c.id}`)}
              >
                <BuildingIcon />
                {c.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {deals.length > 0 && (
          <CommandGroup heading="Deals">
            {deals.map((d) => (
              <CommandItem
                key={d.id}
                value={`deal ${d.title} ${d.company_name ?? ""} ${d.id}`}
                onSelect={() => go(`/deals/${d.id}`)}
              >
                <HandshakeIcon />
                {d.title}
                <span className="text-muted-foreground ml-auto tabular-nums">{formatMoney(d.value)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </>
  );
}
