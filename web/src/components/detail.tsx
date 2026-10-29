import { MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { TaskInput } from "@shared/schemas";
import type { Deal, Task } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { StageBadge } from "@/components/badges";
import { ConfirmDelete } from "@/components/confirm-delete";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";

// The building blocks of the contact, company and deal pages.

export function DetailLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4">{aside}</div>
      <div className="flex flex-col gap-4 lg:col-span-2">{children}</div>
    </div>
  );
}

export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function Fields({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 truncate text-right">{value ?? <span className="text-muted-foreground">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
      <PlusIcon />
    </Button>
  );
}

export function DealsCard({ deals, onAdd }: { deals: Deal[]; onAdd: () => void }) {
  return (
    <SectionCard title={`Deals · ${deals.length}`} action={<AddButton label="Add deal" onClick={onAdd} />}>
      {deals.length ? (
        <ul className="flex flex-col gap-3">
          {deals.map((deal) => (
            <li key={deal.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <Link to={`/deals/${deal.id}`} className="block truncate font-medium hover:underline">
                  {deal.title}
                </Link>
                <span className="text-muted-foreground tabular-nums">{formatMoney(deal.value)}</span>
              </div>
              <StageBadge stage={deal.stage} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No deals yet.</p>
      )}
    </SectionCard>
  );
}

export function TasksCard({ tasks, defaults }: { tasks: Task[]; defaults: Partial<TaskInput> }) {
  const { create } = useActions();
  return (
    <SectionCard
      title="Tasks"
      action={<AddButton label="Add task" onClick={() => create({ kind: "task", defaults })} />}
    >
      <TaskList tasks={tasks} showLinks={false} empty="No tasks yet." />
    </SectionCard>
  );
}

// Edit, plus delete behind a menu and a confirmation.
export function RecordActions({
  noun,
  name,
  consequence,
  onEdit,
  onDelete,
}: {
  noun: string;
  name: string;
  consequence: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={onEdit}>
        <PencilIcon />
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <ConfirmDelete
            title={`Delete ${noun}?`}
            description={`${name} will be deleted. ${consequence}`}
            onConfirm={onDelete}
          >
            <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
              <TrashIcon />
              Delete {noun}
            </DropdownMenuItem>
          </ConfirmDelete>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72" />
        <Skeleton className="h-96 lg:col-span-2" />
      </div>
    </div>
  );
}
