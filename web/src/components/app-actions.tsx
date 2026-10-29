import { createContext, use, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import type { ContactInput, DealInput, TaskInput } from "@shared/schemas";
import { CommandMenu } from "@/components/command-menu";
import { CompanySheet } from "@/components/forms/company-sheet";
import { ContactSheet } from "@/components/forms/contact-sheet";
import { DealSheet } from "@/components/forms/deal-sheet";
import { TaskSheet } from "@/components/forms/task-sheet";

// App-wide actions: "new contact" from the header, the command menu or an
// empty state all open the same sheet, and ⌘K opens search from anywhere.

type Create =
  | { kind: "contact"; defaults?: Partial<ContactInput> }
  | { kind: "company" }
  | { kind: "deal"; defaults?: Partial<DealInput> }
  | { kind: "task"; defaults?: Partial<TaskInput> };

interface Actions {
  create: (what: Create) => void;
  openSearch: () => void;
}

const ActionsContext = createContext<Actions | null>(null);

export function AppActions({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [creating, setCreating] = useState<Create | null>(null);
  const [searching, setSearching] = useState(false);
  const sheet = (kind: Create["kind"]) => ({
    open: creating?.kind === kind,
    onOpenChange: (open: boolean) => !open && setCreating(null),
  });

  return (
    <ActionsContext value={{ create: setCreating, openSearch: () => setSearching(true) }}>
      {children}
      <ContactSheet
        {...sheet("contact")}
        defaults={creating?.kind === "contact" ? creating.defaults : undefined}
        onSaved={(id) => navigate(`/contacts/${id}`)}
      />
      <CompanySheet {...sheet("company")} onSaved={(id) => navigate(`/companies/${id}`)} />
      <DealSheet
        {...sheet("deal")}
        defaults={creating?.kind === "deal" ? creating.defaults : undefined}
        onSaved={(id) => navigate(`/deals/${id}`)}
      />
      <TaskSheet {...sheet("task")} defaults={creating?.kind === "task" ? creating.defaults : undefined} />
      <CommandMenu open={searching} onOpenChange={setSearching} />
    </ActionsContext>
  );
}

export function useActions(): Actions {
  const actions = use(ActionsContext);
  if (!actions) throw new Error("useActions outside AppActions");
  return actions;
}
