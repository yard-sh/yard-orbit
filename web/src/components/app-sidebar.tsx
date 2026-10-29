import {
  BuildingIcon,
  CheckIcon,
  CheckSquareIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  HandshakeIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SparklesIcon,
  SunIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink, useLocation, useNavigate } from "react-router";
import { OrbitMark } from "@/components/logo";
import { PersonAvatar } from "@/components/person";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { LOGOUT_URL, PRICING_URL } from "@/lib/api";
import { startOfToday } from "@/lib/format";
import { useTasks } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/contacts", label: "Contacts", icon: UsersIcon },
  { to: "/companies", label: "Companies", icon: BuildingIcon },
  { to: "/deals", label: "Deals", icon: HandshakeIcon },
  { to: "/tasks", label: "Tasks", icon: CheckSquareIcon },
];

export function AppSidebar() {
  const { workspace } = useWorkspace();
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <WorkspaceSwitcher />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {workspace.is_owner && workspace.plan === "free" && <UpgradeCard />}
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavItem({ to, label, icon: Icon }: (typeof NAV)[number]) {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();
  const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={label}>
        <NavLink to={to} onClick={() => setOpenMobile(false)}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      </SidebarMenuButton>
      {to === "/tasks" && <DueBadge />}
    </SidebarMenuItem>
  );
}

// My open tasks due today or earlier.
function DueBadge() {
  const { me } = useWorkspace();
  const { data } = useTasks({ assignee_id: me.user.id });
  const tomorrow = startOfToday() + 86_400_000;
  const due = data?.filter((t) => t.due_at != null && t.due_at < tomorrow).length ?? 0;
  return due > 0 ? <SidebarMenuBadge>{due}</SidebarMenuBadge> : null;
}

function WorkspaceSwitcher() {
  const { me, workspace, switchWorkspace } = useWorkspace();
  const navigate = useNavigate();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <OrbitMark className="size-4.5" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{workspace.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  Orbit {workspace.plan === "pro" ? "Pro" : "Free"}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-60" align="start">
            <DropdownMenuLabel className="text-muted-foreground text-xs">Workspaces</DropdownMenuLabel>
            {me.workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={() => {
                  switchWorkspace(w.id);
                  navigate("/");
                }}
              >
                <span className="truncate">{w.name}</span>
                <Badge variant="secondary" className="ml-auto capitalize">
                  {w.role}
                </Badge>
                <CheckIcon className={w.id === workspace.id ? "opacity-100" : "opacity-0"} />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings?tab=members")}>
              <UserPlusIcon />
              Invite people
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UpgradeCard() {
  return (
    <Card className="gap-3 py-4 shadow-none group-data-[collapsible=icon]:hidden">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <SparklesIcon className="size-4" />
          Upgrade to Pro
        </CardTitle>
        <CardDescription className="text-xs">
          Invite your team and remove every limit. Try it free for 14 days.
        </CardDescription>
      </CardHeader>
      <div className="px-4">
        <Button size="sm" className="w-full" asChild>
          <a href={PRICING_URL}>See plans</a>
        </Button>
      </div>
    </Card>
  );
}

function UserMenu() {
  const { me } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <PersonAvatar name={me.user.name} className="size-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{me.user.name}</span>
                <span className="text-muted-foreground truncate text-xs">{me.user.email}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56" side="top" align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <SettingsIcon />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings?tab=plan")}>
                <CreditCardIcon />
                Plan and usage
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <SunIcon />
                  Theme
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                    <DropdownMenuRadioItem value="light">
                      <SunIcon />
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <MoonIcon />
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <MonitorIcon />
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href={LOGOUT_URL}>
                <LogOutIcon />
                Log out
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
