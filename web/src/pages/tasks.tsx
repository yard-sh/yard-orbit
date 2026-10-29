import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { Task } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { Page, PageHeader } from "@/components/page";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfToday } from "@/lib/format";
import { useTasks } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";

const DAY = 86_400_000;

// Open tasks fall into these, by due date in the viewer's time zone.
function sections(tasks: Task[]): [string, Task[]][] {
  const today = startOfToday();
  const groups: Record<string, Task[]> = { Overdue: [], Today: [], Upcoming: [], "No due date": [] };
  for (const task of tasks) {
    const due = task.due_at;
    const key = due == null ? "No due date" : due < today ? "Overdue" : due < today + DAY ? "Today" : "Upcoming";
    groups[key].push(task);
  }
  return Object.entries(groups).filter(([, list]) => list.length > 0);
}

export function TasksPage() {
  const { me } = useWorkspace();
  const { create } = useActions();
  const [status, setStatus] = useState<"open" | "done">("open");
  const [who, setWho] = useState<string>(me.user.id);
  const { data } = useTasks({ status, assignee_id: who === "everyone" ? null : who });

  return (
    <Page>
      <PageHeader
        title="Tasks"
        description="Follow-ups for you and your team."
        actions={
          <Button onClick={() => create({ kind: "task" })}>
            <PlusIcon />
            New task
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={status} onValueChange={(v) => setStatus(v as "open" | "done")}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={me.user.id}>Assigned to me</SelectItem>
            <SelectItem value="everyone">Everyone</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {!data ? (
        <Skeleton className="h-64" />
      ) : data.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-muted-foreground py-10 text-center text-sm">
              {status === "open" ? "Nothing to do. Enjoy it." : "No completed tasks yet."}
            </p>
          </CardContent>
        </Card>
      ) : status === "done" ? (
        <Card>
          <CardContent>
            <TaskList tasks={data} />
          </CardContent>
        </Card>
      ) : (
        sections(data).map(([title, tasks]) => (
          <Card key={title} className="gap-2">
            <CardHeader>
              <CardTitle className={title === "Overdue" ? "text-destructive text-sm" : "text-sm"}>
                {title} <span className="text-muted-foreground font-normal">{tasks.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TaskList tasks={tasks} />
            </CardContent>
          </Card>
        ))
      )}
    </Page>
  );
}
