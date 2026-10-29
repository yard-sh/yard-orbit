import { createHashRouter, Outlet } from "react-router";
import { AppLayout } from "@/components/layout";
import { OrbitMark } from "@/components/logo";
import { WorkspaceProvider } from "@/lib/workspace";
import { CompanyPage } from "@/pages/companies/detail";
import { CompaniesPage } from "@/pages/companies/list";
import { ContactPage } from "@/pages/contacts/detail";
import { ContactsPage } from "@/pages/contacts/list";
import { DashboardPage } from "@/pages/dashboard";
import { DealPage } from "@/pages/deals/detail";
import { DealsPage } from "@/pages/deals/list";
import { InvitePage } from "@/pages/invite";
import { NotFound } from "@/pages/not-found";
import { SettingsPage } from "@/pages/settings";
import { TasksPage } from "@/pages/tasks";

// Hash routes (#/contacts/…): the app lives at /<slug>/app/ under any
// mount or sandbox, and the service only ever sees that one path.
export const router = createHashRouter([
  {
    element: (
      <WorkspaceProvider fallback={<Splash />}>
        <Outlet />
      </WorkspaceProvider>
    ),
    children: [
      { path: "invite/:token", element: <InvitePage /> },
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: "contacts", element: <ContactsPage /> },
          { path: "contacts/:id", element: <ContactPage /> },
          { path: "companies", element: <CompaniesPage /> },
          { path: "companies/:id", element: <CompanyPage /> },
          { path: "deals", element: <DealsPage /> },
          { path: "deals/:id", element: <DealPage /> },
          { path: "tasks", element: <TasksPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

function Splash() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <OrbitMark className="text-muted-foreground size-8 animate-pulse" />
    </div>
  );
}
