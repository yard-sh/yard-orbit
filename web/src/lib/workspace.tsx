import { useQuery } from "@tanstack/react-query";
import { createContext, use, useCallback, useState, type ReactNode } from "react";
import type { Me, WorkspaceSummary } from "@shared/types";
import { api } from "./api";

const STORAGE_KEY = "orbit.workspace";

interface WorkspaceState {
  me: Me;
  workspace: WorkspaceSummary;
  switchWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

export const meQuery = { queryKey: ["me"], queryFn: () => api<Me>("me") };

// Loads who I am, then picks the workspace I last had open (or my own).
// Everything inside renders with a workspace in hand.
export function WorkspaceProvider({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const { data: me } = useQuery(meQuery);
  const [selected, setSelected] = useState(() => readStored());

  const switchWorkspace = useCallback((id: string) => {
    setSelected(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage can be unavailable (private windows); the choice just won't stick.
    }
  }, []);

  if (!me) return fallback;
  const workspace = me.workspaces.find((w) => w.id === selected) ?? me.workspaces[0];
  return <WorkspaceContext value={{ me, workspace, switchWorkspace }}>{children}</WorkspaceContext>;
}

export function useWorkspace(): WorkspaceState {
  const state = use(WorkspaceContext);
  if (!state) throw new Error("useWorkspace outside WorkspaceProvider");
  return state;
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
