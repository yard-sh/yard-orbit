import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isClosed, STAGES, type Stage } from "@shared/constants";
import type { DealMove } from "@shared/schemas";
import type { Deal } from "@shared/types";
import { Dot, STAGE_COLOR } from "@/components/badges";
import { PersonAvatar } from "@/components/person";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/format";
import { useWsMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";

type Columns = Record<Stage, Deal[]>;

function group(deals: Deal[]): Columns {
  const columns = Object.fromEntries(STAGES.map((s) => [s.key, [] as Deal[]])) as Columns;
  for (const deal of deals) columns[deal.stage].push(deal);
  for (const list of Object.values(columns)) list.sort((a, b) => a.position - b.position);
  return columns;
}

// A dropped card sits halfway between its new neighbours, so a move writes
// one row and never renumbers the column.
function positionAt(list: Deal[], index: number): number {
  const before = list[index - 1]?.position;
  const after = list[index + 1]?.position;
  if (before !== undefined && after !== undefined) return (before + after) / 2;
  if (before !== undefined) return before + 1;
  if (after !== undefined) return after - 1;
  return 1;
}

export function DealBoard({ deals }: { deals: Deal[] }) {
  const [columns, setColumns] = useState(() => group(deals));
  const [active, setActive] = useState<Deal | null>(null);
  const move = useWsMutation<DealMove & { id: string }>((base, { id, ...body }) =>
    api(`${base}/deals/${id}/move`, { method: "POST", body }),
  );
  const sensors = useSensors(
    // A few pixels of travel before a drag starts, so a click still opens the deal.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Server data wins whenever nothing is being dragged or saved. A move
  // stays pending until its refetch lands, so a dropped card never snaps
  // back to where the old data had it; a failed move does snap back.
  useEffect(() => {
    if (!active && !move.isPending) setColumns(group(deals));
  }, [deals, active, move.isPending]);

  const stageOfId = (id: string, cols = columns): Stage | undefined =>
    (STAGES.find((s) => s.key === id)?.key as Stage | undefined) ??
    STAGES.find((s) => cols[s.key].some((d) => d.id === id))?.key;

  const onDragStart = ({ active }: DragStartEvent) => setActive(deals.find((d) => d.id === active.id) ?? null);

  // Crossing into another column moves the card there right away, so the
  // column opens a gap under the pointer.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = stageOfId(String(active.id));
    const to = stageOfId(String(over.id));
    if (!from || !to || from === to) return;
    setColumns((cols) => {
      const card = cols[from].find((d) => d.id === active.id)!;
      const target = cols[to];
      const overIndex = target.findIndex((d) => d.id === over.id);
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...cols,
        [from]: cols[from].filter((d) => d.id !== active.id),
        [to]: [...target.slice(0, index), { ...card, stage: to }, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    const original = active;
    setActive(null);
    if (!over || !original) return;
    const stage = stageOfId(String(dragged.id));
    if (!stage) return;
    let list = columns[stage];
    const from = list.findIndex((d) => d.id === dragged.id);
    const overIndex = list.findIndex((d) => d.id === over.id);
    const to = overIndex === -1 ? from : overIndex;
    if (from !== to) list = arrayMove(list, from, to);
    setColumns({ ...columns, [stage]: list });
    if (stage === original.stage && from === to) return;
    move.mutate({ id: original.id, stage, position: positionAt(list, to) });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-6 md:px-6">
        {STAGES.map((stage) => (
          <Column key={stage.key} stage={stage.key} label={stage.label} deals={columns[stage.key]} />
        ))}
      </div>
      <DragOverlay>{active && <DealCard deal={active} overlay />}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, label, deals }: { stage: Stage; label: string; deals: Deal[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((sum, d) => sum + d.value, 0);
  return (
    <section className="flex w-72 shrink-0 flex-col">
      <header className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Dot className={cn("size-2", STAGE_COLOR[stage])} />
          {label}
          <span className="text-muted-foreground font-normal">{deals.length}</span>
        </div>
        <span className="text-muted-foreground text-xs tabular-nums">{formatMoneyCompact(total)}</span>
      </header>
      <SortableContext id={stage} items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "bg-muted/40 flex min-h-32 flex-1 flex-col gap-2 rounded-xl border border-transparent p-2 transition-colors",
            isOver && "border-border bg-muted",
          )}
        >
          {deals.map((deal) => (
            <SortableCard key={deal.id} deal={deal} />
          ))}
          {deals.length === 0 && <p className="text-muted-foreground py-6 text-center text-xs">Drop deals here</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({ deal, overlay }: { deal: Deal; overlay?: boolean }) {
  const navigate = useNavigate();
  const late = deal.expected_close_at != null && !isClosed(deal.stage) && deal.expected_close_at < Date.now();
  return (
    <Card
      onClick={() => navigate(`/deals/${deal.id}`)}
      className={cn(
        "cursor-grab gap-3 rounded-lg p-3 shadow-xs transition-shadow hover:shadow-md active:cursor-grabbing",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{deal.title}</p>
        <p className="text-muted-foreground truncate text-xs">
          {deal.company_name ?? deal.contact_name ?? "No company"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold tabular-nums">{formatMoney(deal.value)}</span>
        <div className="flex items-center gap-2">
          {deal.expected_close_at != null && !isClosed(deal.stage) && (
            <span
              className={cn("flex items-center gap-1 text-xs", late ? "text-destructive" : "text-muted-foreground")}
            >
              <CalendarIcon className="size-3" />
              {formatDate(deal.expected_close_at)}
            </span>
          )}
          <PersonAvatar name={deal.owner_name} className="size-5" />
        </div>
      </div>
    </Card>
  );
}
