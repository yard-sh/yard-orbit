import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Activity,
  Company,
  CompanyDetail,
  Contact,
  ContactDetail,
  Dashboard,
  Deal,
  DealDetail,
  Member,
  Task,
  Workspace,
} from "@shared/types";
import { api } from "./api";
import { useWorkspace } from "./workspace";

// Every query lives under ["ws", <workspace id>, …], so switching
// workspaces never shows another workspace's cache, and any write can
// refresh everything in its workspace with one invalidation. CRM records
// are interlinked (a deal move changes the dashboard, the company's open
// value and a contact's timeline), so refreshing the lot is both simplest
// and correct.

type Params = Record<string, string | null | undefined>;

function useWsQuery<T>(path: string, params: Params = {}, enabled = true) {
  const { workspace } = useWorkspace();
  const search = new URLSearchParams(
    Object.entries(params).filter((entry): entry is [string, string] => !!entry[1]),
  ).toString();
  const url = `workspaces/${workspace.id}${path && "/" + path}${search && "?" + search}`;
  const queryKey = ["ws", workspace.id, ...path.split("/"), search];
  return useQuery({
    queryKey,
    queryFn: () => api<T>(url),
    // While a search or filter changes, keep showing the list being
    // filtered. Never carry rows across workspaces or between records.
    placeholderData: (previous, query) => (query && sameList(query.queryKey, queryKey) ? previous : undefined),
    enabled,
  });
}

// Same workspace and path, differing only in the search string.
function sameList(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.slice(0, -1).every((part, i) => part === b[i]);
}

export function useWsMutation<V, R = unknown>(request: (base: string, vars: V) => Promise<R>) {
  const { workspace } = useWorkspace();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => request(`workspaces/${workspace.id}`, vars),
    onSuccess: () => client.invalidateQueries({ queryKey: ["ws", workspace.id] }),
  });
}

export const useWorkspaceDetail = () => useWsQuery<Workspace>("");
export const useMembers = () => useWsQuery<Member[]>("members");
export const useDashboard = () => useWsQuery<Dashboard>("dashboard");

export const useContacts = (params?: Params) => useWsQuery<Contact[]>("contacts", params);
export const useContact = (id: string) => useWsQuery<ContactDetail>(`contacts/${id}`);
export const useCompanies = (params?: Params) => useWsQuery<Company[]>("companies", params);
export const useCompany = (id: string) => useWsQuery<CompanyDetail>(`companies/${id}`);
export const useDeals = (params?: Params) => useWsQuery<Deal[]>("deals", params);
export const useDeal = (id: string) => useWsQuery<DealDetail>(`deals/${id}`);
export const useTasks = (params?: Params) => useWsQuery<Task[]>("tasks", params);

export type Subject = { contact_id: string } | { company_id: string } | { deal_id: string };
export const useActivities = (subject: Subject) => useWsQuery<Activity[]>("activities", subject);

export type Resource = "contacts" | "companies" | "deals" | "tasks" | "activities";

// POST without an id, PATCH with one.
export function useSave<Input, Result = unknown>(resource: Resource) {
  return useWsMutation<{ id?: string; input: Input }, Result>((base, { id, input }) =>
    api<Result>(id ? `${base}/${resource}/${id}` : `${base}/${resource}`, {
      method: id ? "PATCH" : "POST",
      body: input,
    }),
  );
}

export function useRemove(resource: Resource) {
  return useWsMutation<string>((base, id) => api(`${base}/${resource}/${id}`, { method: "DELETE" }));
}
