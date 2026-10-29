import { CONTACT_STATUSES, stageOf, type ContactStatus, type Stage } from "@shared/constants";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const STAGE_COLOR: Record<Stage, string> = {
  lead: "bg-slate-400",
  qualified: "bg-sky-500",
  proposal: "bg-violet-500",
  negotiation: "bg-amber-500",
  won: "bg-emerald-500",
  lost: "bg-rose-500",
};

// The same colors as CSS values, for charts. Tailwind defines these
// variables because the classes above use them.
export const STAGE_FILL: Record<Stage, string> = {
  lead: "var(--color-slate-400)",
  qualified: "var(--color-sky-500)",
  proposal: "var(--color-violet-500)",
  negotiation: "var(--color-amber-500)",
  won: "var(--color-emerald-500)",
  lost: "var(--color-rose-500)",
};

const STATUS_COLOR: Record<ContactStatus, string> = {
  lead: "bg-sky-500",
  active: "bg-violet-500",
  customer: "bg-emerald-500",
  churned: "bg-slate-400",
};

export function Dot({ className }: { className: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-full", className)} />;
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Dot className={STAGE_COLOR[stage]} />
      {stageOf(stage).label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ContactStatus }) {
  const label = CONTACT_STATUSES.find((s) => s.key === status)?.label ?? status;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Dot className={STATUS_COLOR[status]} />
      {label}
    </Badge>
  );
}
