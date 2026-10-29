import { PlusIcon, SearchIcon } from "lucide-react";
import { Outlet, useLocation } from "react-router";
import { AppActions, useActions } from "@/components/app-actions";
import { AppSidebar } from "@/components/app-sidebar";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useWorkspace } from "@/lib/workspace";

const SECTIONS: Record<string, string> = {
  "": "Dashboard",
  contacts: "Contacts",
  companies: "Companies",
  deals: "Deals",
  tasks: "Tasks",
  settings: "Settings",
};

export function AppLayout() {
  return (
    <SidebarProvider>
      <AppActions>
        <AppSidebar />
        <SidebarInset>
          <Header />
          <Outlet />
        </SidebarInset>
        <UpgradeDialog />
      </AppActions>
    </SidebarProvider>
  );
}

function Header() {
  const { workspace } = useWorkspace();
  const { pathname } = useLocation();
  const { create, openSearch } = useActions();
  const section = SECTIONS[pathname.split("/")[1]] ?? "";

  return (
    <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:rounded-t-xl">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
      <nav className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden truncate sm:inline">{workspace.name}</span>
        <span className="hidden sm:inline">/</span>
        <span className="text-foreground font-medium">{section}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground w-9 px-0 sm:w-56 sm:justify-start sm:px-3"
          onClick={openSearch}
        >
          <SearchIcon />
          <span className="hidden sm:inline">Search…</span>
          <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <PlusIcon />
              <span className="hidden sm:inline">New</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(["contact", "company", "deal", "task"] as const).map((kind) => (
              <DropdownMenuItem key={kind} className="capitalize" onClick={() => create({ kind })}>
                {kind}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
