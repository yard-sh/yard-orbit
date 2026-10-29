import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import { openUpgrade } from "@/lib/upgrade";
import { router } from "@/router";
import "./index.css";

// An invite link is …/app/?invite=<token>. Yard signs the person in on the
// way here, keeping the query; the join screen is a hash route, so move
// the token there and drop the query.
const invite = new URLSearchParams(location.search).get("invite");
if (invite) history.replaceState(null, "", `${location.pathname}#/invite/${encodeURIComponent(invite)}`);

// One place decides what an API failure looks like: a lapsed session
// reloads (Yard signs the person back in), a plan limit opens the upgrade
// dialog, anything else is a toast.
function onError(error: Error) {
  if (!(error instanceof ApiError)) return toast.error("Something went wrong");
  if (error.code === "signed_out") return location.reload();
  if (error.code === "plan_limit") return openUpgrade(error.limit);
  if (error.status !== 404) toast.error(error.message.charAt(0).toUpperCase() + error.message.slice(1));
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="orbit.theme"
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
