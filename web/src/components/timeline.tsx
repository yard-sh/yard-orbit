import {
  ArrowRightIcon,
  CalendarIcon,
  MailIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  PlusIcon,
  StickyNoteIcon,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LOGGED_KINDS, stageOf, type ActivityKind, type LoggedKind, type Stage } from "@shared/constants";
import type { ActivityInput } from "@shared/schemas";
import type { Activity } from "@shared/types";
import { PersonAvatar } from "@/components/person";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatRelative } from "@/lib/format";
import { useActivities, useRemove, useSave, type Subject } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";

const KIND: Record<ActivityKind, { icon: LucideIcon; label: string; verb: string }> = {
  note: { icon: StickyNoteIcon, label: "Note", verb: "added a note" },
  call: { icon: PhoneIcon, label: "Call", verb: "logged a call" },
  email: { icon: MailIcon, label: "Email", verb: "logged an email" },
  meeting: { icon: CalendarIcon, label: "Meeting", verb: "logged a meeting" },
  created: { icon: PlusIcon, label: "Created", verb: "created" },
  stage_change: { icon: ArrowRightIcon, label: "Stage", verb: "moved" },
};

// The record's history: a composer for notes, calls, emails and meetings,
// then everything logged on it (or on its deals), newest first.
export function Timeline({ subject }: { subject: Subject }) {
  const { data, isPending } = useActivities(subject);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Composer subject={subject} />
        {isPending ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : data?.length ? (
          <ol className="relative flex flex-col gap-6 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-border">
            {data.map((activity) => (
              <Entry key={activity.id} activity={activity} subject={subject} />
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No activity yet. Log the first call or note above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Composer({ subject }: { subject: Subject }) {
  const [kind, setKind] = useState<LoggedKind>("note");
  const [body, setBody] = useState("");
  const save = useSave<ActivityInput>("activities");

  const submit = () => {
    if (!body.trim() || save.isPending) return;
    save.mutate(
      { input: { kind, body, ...subject } },
      {
        onSuccess: () => {
          setBody("");
          toast.success(`${KIND[kind].label} logged`);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <ToggleGroup
        type="single"
        size="sm"
        value={kind}
        onValueChange={(v) => v && setKind(v as LoggedKind)}
        className="self-start"
      >
        {LOGGED_KINDS.map((k) => {
          const Icon = KIND[k].icon;
          return (
            <ToggleGroupItem key={k} value={k} className="gap-1.5 px-2.5">
              <Icon />
              {KIND[k].label}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder={kind === "note" ? "Write a note…" : `What happened on the ${KIND[kind].label.toLowerCase()}?`}
        className="min-h-20 resize-none border-0 p-1 shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">⌘ Enter to log</span>
        <Button size="sm" onClick={submit} disabled={!body.trim() || save.isPending}>
          Log {KIND[kind].label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

function Entry({ activity, subject }: { activity: Activity; subject: Subject }) {
  const { me, workspace } = useWorkspace();
  const remove = useRemove("activities");
  const { icon: Icon, verb } = KIND[activity.kind];
  const system = activity.kind === "created" || activity.kind === "stage_change";
  const canDelete = !system && (activity.author_id === me.user.id || workspace.role !== "member");

  return (
    <li className="relative flex gap-3">
      <span className="bg-background ring-border z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-1">
        <Icon className="text-muted-foreground size-3.5" />
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{activity.author_name ?? "Someone"}</span>{" "}
            <span className="text-muted-foreground">{verb}</span> <Context activity={activity} subject={subject} />
            <span className="text-muted-foreground"> · {formatRelative(activity.created_at)}</span>
          </p>
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-xs" aria-label="More">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => remove.mutate(activity.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {activity.body && !system && (
          <div className="bg-muted/50 mt-2 flex gap-2 rounded-md p-3 text-sm whitespace-pre-wrap">
            <PersonAvatar name={activity.author_name} className="size-5 shrink-0" />
            <p className="min-w-0 flex-1">{activity.body}</p>
          </div>
        )}
      </div>
    </li>
  );
}

// What the entry is about, linked, when that isn't the record being viewed.
function Context({ activity, subject }: { activity: Activity; subject: Subject }) {
  const onDeal = "deal_id" in subject;
  const deal =
    activity.deal_id && !onDeal ? (
      <Link to={`/deals/${activity.deal_id}`} className="font-medium hover:underline">
        {activity.deal_title}
      </Link>
    ) : (
      <span className="font-medium">this deal</span>
    );

  if (activity.kind === "created") return deal;
  if (activity.kind === "stage_change") {
    const [from, to] = activity.body.split(":") as [Stage, Stage];
    return (
      <>
        {deal} <span className="text-muted-foreground">from</span> {stageOf(from).label}{" "}
        <span className="text-muted-foreground">to</span> <span className="font-medium">{stageOf(to).label}</span>
      </>
    );
  }
  if (activity.deal_id && !onDeal)
    return (
      <>
        <span className="text-muted-foreground">on</span> {deal}
      </>
    );
  if (activity.contact_id && "company_id" in subject) {
    return (
      <>
        <span className="text-muted-foreground">with</span>{" "}
        <Link to={`/contacts/${activity.contact_id}`} className="font-medium hover:underline">
          {activity.contact_name}
        </Link>
      </>
    );
  }
  return null;
}
