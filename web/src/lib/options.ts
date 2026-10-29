import { useMemo } from "react";
import type { Option } from "@/components/pickers";
import { fullName } from "./format";
import { useCompanies, useContacts, useDeals, useMembers } from "./queries";

// Choices for the pickers in forms, from the same cached lists the pages use.

export function useMemberOptions(): Option[] {
  const { data } = useMembers();
  return useMemo(() => (data ?? []).map((m) => ({ value: m.user_id, label: m.name })), [data]);
}

export function useCompanyOptions(): Option[] {
  const { data } = useCompanies();
  return useMemo(() => (data ?? []).map((c) => ({ value: c.id, label: c.name })), [data]);
}

export function useContactOptions(): Option[] {
  const { data } = useContacts();
  return useMemo(
    () =>
      (data ?? []).map((c) => ({
        value: c.id,
        label: c.company_name ? `${fullName(c)} · ${c.company_name}` : fullName(c),
      })),
    [data],
  );
}

export function useDealOptions(): Option[] {
  const { data } = useDeals();
  return useMemo(() => (data ?? []).map((d) => ({ value: d.id, label: d.title })), [data]);
}
