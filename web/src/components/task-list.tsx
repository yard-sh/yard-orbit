import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Task } from "@shared/types";
import { TaskSheet } from "@/components/forms/task-sheet";
import { PersonAvatar } from "@/components/person";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, startOfToday } from "@/lib/format";
import { useRemove, useWsMutation } from "@/lib/queries";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const DAY = 86_400_000;

export function useToggleTask() {
  return useWsMutation<{ id: string; done: boolean }>((base, { id, done }) =>
    api(`${base}/tasks/${id}`, { method: "PATCH", body: { done } }),
  );
}

export function TaskList({ tasks, showLinks = true, empty }: { tasks: Task[]; showLinks?: boolean; empty?: string }) {
  if (!tasks.length) return <p className="text-muted-foreground py-4 text-center text-sm">{empty ?? "No tasks."}</p>;
  return (
    <ul className="divide-y">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} showLinks={showLinks} />
      ))}
    </ul>
  );
}

function TaskRow({ task, showLinks }: { task: Task; showLinks: boolean }) {
  const toggle = useToggleTask();
  const remove = useRemove("tasks");
  const [editing, setEditing] = useState(false);
  // Optimistic: the box ticks at once while the request is in flight.
  const done = toggle.isPending ? toggle.variables.done : task.done_at != null;
  const link = showLinks && taskLink(task);

  return (
    <li className="group flex items-start gap-3 py-2.5">
      <Checkbox
        checked={done}
        onCheckedChange={(checked) => toggle.mutate({ id: task.id, done: checked === true })}
        className="mt-0.5"
        aria-label={done ? "Mark as not done" : "Mark as done"}
      />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm leading-5", done && "text-muted-foreground line-through")}>{task.title}</p>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <Due task={task} done={done} />
          {link && (
            <Link to={link.to} className="truncate hover:underline">
              {link.label}
            </Link>
          )}
        </div>
      </div>
      <PersonAvatar name={task.assignee_name} className="size-6" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" aria-label="More" className="opacity-60 group-hover:opacity-100">
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(task.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TaskSheet open={editing} onOpenChange={setEditing} task={task} />
    </li>
  );
}

function Due({ task, done }: { task: Task; done: boolean }) {
  if (task.due_at == null) return null;
  const today = startOfToday();
  if (done || task.due_at >= today + DAY) return <span>Due {formatDate(task.due_at)}</span>;
  if (task.due_at >= today)
    return (
      <Badge variant="secondary" className="h-5 px-1.5">
        Today
      </Badge>
    );
  return (
    <Badge variant="destructive" className="h-5 px-1.5">
      Overdue · {formatDate(task.due_at)}
    </Badge>
  );
}

function taskLink(task: Task) {
  if (task.deal_id) return { to: `/deals/${task.deal_id}`, label: task.deal_title };
  if (task.contact_id) return { to: `/contacts/${task.contact_id}`, label: task.contact_name };
  if (task.company_id) return { to: `/companies/${task.company_id}`, label: task.company_name };
  return null;
}
