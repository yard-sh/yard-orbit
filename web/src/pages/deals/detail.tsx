import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { isClosed, STAGES, stageOf, type Stage } from "@shared/constants";
import type { DealInput } from "@shared/schemas";
import { Dot, STAGE_COLOR, StageBadge } from "@/components/badges";
import { DetailLayout, DetailSkeleton, Fields, RecordActions, SectionCard, TasksCard } from "@/components/detail";
import { DealSheet } from "@/components/forms/deal-sheet";
import { Page, PageHeader } from "@/components/page";
import { Person } from "@/components/person";
import { Timeline } from "@/components/timeline";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import { useDeal, useRemove, useSave } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { NotFound } from "@/pages/not-found";

export function DealPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, error } = useDeal(id);
  const remove = useRemove("deals");
  const save = useSave<Partial<DealInput>>("deals");
  const [editing, setEditing] = useState(false);

  if (error) return <NotFound what="deal" back="/deals" />;
  if (!data) return <DetailSkeleton />;
  const { deal, tasks } = data;

  const setStage = (stage: Stage) =>
    save.mutate(
      { id: deal.id, input: { stage } },
      { onSuccess: () => toast.success(`Moved to ${stageOf(stage).label}`) },
    );

  return (
    <Page>
      <PageHeader
        title={deal.title}
        description={
          <span className="flex items-center gap-2">
            <span className="text-foreground font-medium tabular-nums">{formatMoney(deal.value)}</span>
            <StageBadge stage={deal.stage} />
          </span>
        }
        actions={
          <RecordActions
            noun="deal"
            name={deal.title}
            consequence="Its tasks stay; its history goes with it."
            onEdit={() => setEditing(true)}
            onDelete={() => {
              // Leave first, so this page doesn't refetch the deleted deal.
              // A failure is toasted by the mutation cache (main.tsx).
              navigate("/deals");
              remove.mutateAsync(deal.id).then(
                () => toast.success("Deal deleted"),
                () => {},
              );
            }}
          />
        }
      />
      <StageStepper stage={deal.stage} onChange={setStage} pending={save.isPending} />
      <DetailLayout
        aside={
          <>
            <SectionCard title="Details">
              <Fields
                rows={[
                  ["Value", <span className="tabular-nums">{formatMoney(deal.value)}</span>],
                  [
                    "Company",
                    deal.company_id && (
                      <Link to={`/companies/${deal.company_id}`} className="hover:underline">
                        {deal.company_name}
                      </Link>
                    ),
                  ],
                  [
                    "Contact",
                    deal.contact_id && (
                      <Link to={`/contacts/${deal.contact_id}`} className="hover:underline">
                        {deal.contact_name}
                      </Link>
                    ),
                  ],
                  [
                    "Owner",
                    <span className="inline-flex justify-end">
                      <Person name={deal.owner_name} />
                    </span>,
                  ],
                  isClosed(deal.stage)
                    ? ["Closed", formatDate(deal.closed_at)]
                    : ["Expected close", formatDate(deal.expected_close_at)],
                  ["Created", formatDate(deal.created_at)],
                ]}
              />
            </SectionCard>
            <TasksCard
              tasks={tasks}
              defaults={{ deal_id: deal.id, contact_id: deal.contact_id, company_id: deal.company_id }}
            />
          </>
        }
      >
        <Timeline subject={{ deal_id: deal.id }} />
      </DetailLayout>
      <DealSheet open={editing} onOpenChange={setEditing} deal={deal} />
    </Page>
  );
}

// The open stages as a path, then the two ways out.
function StageStepper({ stage, onChange, pending }: { stage: Stage; onChange: (s: Stage) => void; pending: boolean }) {
  const open = STAGES.filter((s) => !isClosed(s.key));
  const reached = open.findIndex((s) => s.key === stage);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div
        className="grid flex-1 gap-1 overflow-hidden rounded-lg border p-1"
        style={{ gridTemplateColumns: `repeat(${open.length}, minmax(0, 1fr))` }}
      >
        {open.map((s, i) => (
          <button
            key={s.key}
            disabled={pending}
            onClick={() => s.key !== stage && onChange(s.key)}
            className={cn(
              "rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              s.key === stage
                ? "bg-primary text-primary-foreground"
                : i < reached
                  ? "bg-muted text-foreground hover:bg-accent"
                  : "text-muted-foreground hover:bg-accent",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(["won", "lost"] as const).map((key) => (
          <Button
            key={key}
            variant={stage === key ? "default" : "outline"}
            disabled={pending}
            onClick={() => key !== stage && onChange(key)}
            className="flex-1 sm:flex-none"
          >
            <Dot className={STAGE_COLOR[key]} />
            {key === "won" ? "Won" : "Lost"}
          </Button>
        ))}
      </div>
    </div>
  );
}
