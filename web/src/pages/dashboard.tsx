import { ArrowRightIcon, DatabaseIcon, UserPlusIcon } from "lucide-react";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Link } from "react-router";
import { toast } from "sonner";
import { STAGES, isClosed } from "@shared/constants";
import type { Dashboard } from "@shared/types";
import { useActions } from "@/components/app-actions";
import { STAGE_FILL } from "@/components/badges";
import { Page, PageHeader } from "@/components/page";
import { TaskList } from "@/components/task-list";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatMoney, formatMoneyCompact, formatRelative } from "@/lib/format";
import { useDashboard, useWsMutation } from "@/lib/queries";
import { useWorkspace } from "@/lib/workspace";

export function DashboardPage() {
  const { me } = useWorkspace();
  const { data } = useDashboard();
  const firstName = me.user.name.split(" ")[0];

  if (!data) return <DashboardSkeleton />;
  const empty = data.counts.contacts + data.counts.companies + data.counts.open_deals + data.stages.length === 0;

  return (
    <Page>
      <PageHeader title={`Welcome back, ${firstName}`} description="Here's where your pipeline stands today." />
      {empty ? (
        <Onboarding />
      ) : (
        <>
          <Kpis data={data} />
          <div className="grid gap-4 lg:grid-cols-7">
            <RevenueChart data={data} />
            <StageChart data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>My tasks</CardTitle>
                <CardDescription>Open tasks assigned to you</CardDescription>
                <CardAction>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tasks">
                      All tasks <ArrowRightIcon />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <TaskList tasks={data.my_tasks} empty="You're all caught up." />
              </CardContent>
            </Card>
            <RecentActivity data={data} />
          </div>
        </>
      )}
    </Page>
  );
}

function Kpis({ data }: { data: Dashboard }) {
  const open = data.stages.filter((s) => !isClosed(s.stage));
  const pipeline = open.reduce((sum, s) => sum + s.value, 0);
  const weighted = open.reduce(
    (sum, s) => sum + s.value * (STAGES.find((x) => x.key === s.stage)?.probability ?? 0),
    0,
  );
  const won = data.closed.filter((d) => d.stage === "won");
  const wonValue = won.reduce((sum, d) => sum + d.value, 0);
  const winRate = data.closed.length ? Math.round((won.length / data.closed.length) * 100) : null;

  const kpis = [
    { label: "Open pipeline", value: formatMoney(pipeline), hint: `${data.counts.open_deals} open deals` },
    { label: "Weighted forecast", value: formatMoney(Math.round(weighted)), hint: "Value × stage probability" },
    { label: "Won, last 6 months", value: formatMoney(wonValue), hint: `${won.length} deals closed` },
    { label: "Win rate", value: winRate === null ? "—" : `${winRate}%`, hint: `${data.closed.length} deals decided` },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="gap-2">
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{kpi.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground text-xs">{kpi.hint}</CardContent>
        </Card>
      ))}
    </div>
  );
}

const revenueConfig = { won: { label: "Won", color: "var(--chart-2)" } } satisfies ChartConfig;

// Won value per calendar month, in the viewer's time zone.
function RevenueChart({ data }: { data: Dashboard }) {
  const months = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return {
        key: `${d.getFullYear()}-${d.getMonth()}`,
        month: d.toLocaleString("en-US", { month: "short" }),
        won: 0,
      };
    });
    for (const deal of data.closed) {
      if (deal.stage !== "won") continue;
      const d = new Date(deal.closed_at);
      const bucket = buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.won += deal.value;
    }
    return buckets;
  }, [data.closed]);

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Revenue won</CardTitle>
        <CardDescription>Closed-won value, last six months</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={revenueConfig} className="aspect-auto h-64 w-full">
          <BarChart data={months} margin={{ left: 0, right: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => formatMoneyCompact(v)} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(v) => formatMoney(Number(v))} />} />
            <Bar dataKey="won" fill="var(--color-won)" radius={6} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const stageConfig = { value: { label: "Value" } } satisfies ChartConfig;

function StageChart({ data }: { data: Dashboard }) {
  const rows = STAGES.filter((s) => !isClosed(s.key)).map((s) => ({
    stage: s.key,
    label: s.label,
    value: data.stages.find((x) => x.stage === s.key)?.value ?? 0,
  }));
  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Pipeline by stage</CardTitle>
        <CardDescription>Open deal value in each stage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={stageConfig} className="aspect-auto h-64 w-full">
          <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 16 }}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={88} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideIndicator formatter={(v) => formatMoney(Number(v))} />}
            />
            <Bar dataKey="value" radius={6}>
              {rows.map((row) => (
                <Cell key={row.stage} fill={STAGE_FILL[row.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function RecentActivity({ data }: { data: Dashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>The latest across your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {data.recent.map((a) => {
            const subject = a.deal_id
              ? { to: `/deals/${a.deal_id}`, label: a.deal_title }
              : a.contact_id
                ? { to: `/contacts/${a.contact_id}`, label: a.contact_name }
                : { to: `/companies/${a.company_id}`, label: a.company_name };
            return (
              <li key={a.id} className="flex items-start justify-between gap-4 text-sm">
                <p className="min-w-0">
                  <span className="font-medium">{a.author_name ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">{RECENT_VERB[a.kind]}</span>{" "}
                  <Link to={subject.to} className="font-medium hover:underline">
                    {subject.label}
                  </Link>
                </p>
                <span className="text-muted-foreground shrink-0 text-xs">{formatRelative(a.created_at)}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

const RECENT_VERB = {
  note: "added a note on",
  call: "logged a call with",
  email: "emailed",
  meeting: "met with",
  created: "created",
  stage_change: "moved",
};

function Onboarding() {
  const { create } = useActions();
  const seed = useWsMutation<void>((base) => api(`${base}/seed`, { method: "POST" }));
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DatabaseIcon />
        </EmptyMedia>
        <EmptyTitle>Your workspace is empty</EmptyTitle>
        <EmptyDescription>
          Add your first contact, or load a sample book of business to see the pipeline, dashboard and timelines in
          action.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button onClick={() => create({ kind: "contact" })}>
          <UserPlusIcon />
          Add a contact
        </Button>
        <Button
          variant="outline"
          disabled={seed.isPending}
          onClick={() => seed.mutate(undefined, { onSuccess: () => toast.success("Sample data loaded") })}
        >
          {seed.isPending ? "Loading…" : "Load sample data"}
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function DashboardSkeleton() {
  return (
    <Page>
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </Page>
  );
}
