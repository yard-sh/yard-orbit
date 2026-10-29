import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { ROLE_RANK, type Role } from "@shared/constants";
import { profileSchema, workspaceSchema } from "@shared/schemas";
import type { Member, Workspace } from "@shared/types";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormField } from "@/components/forms/form-field";
import { Page, PageHeader } from "@/components/page";
import { PersonAvatar } from "@/components/person";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, PRICING_URL } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useMembers, useWorkspaceDetail, useWsMutation } from "@/lib/queries";
import { meQuery, useWorkspace } from "@/lib/workspace";

const TABS = ["general", "members", "plan"] as const;

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get("tab")) ?? "general";
  const { data: workspace } = useWorkspaceDetail();

  return (
    <Page className="max-w-4xl">
      <PageHeader title="Settings" description="Your profile, your team and your plan." />
      <Tabs value={tab} onValueChange={(t) => setParams(t === "general" ? {} : { tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>
        {!workspace ? (
          <Skeleton className="mt-4 h-64" />
        ) : (
          <>
            <TabsContent value="general" className="flex flex-col gap-4 pt-4">
              <ProfileCard />
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            </TabsContent>
            <TabsContent value="members" className="flex flex-col gap-4 pt-4">
              <InviteCard workspace={workspace} />
              <MembersCard workspace={workspace} />
            </TabsContent>
            <TabsContent value="plan" className="pt-4">
              <PlanCard workspace={workspace} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </Page>
  );
}

// A one-field card form: a name, saved with its own button.
function NameForm({
  title,
  description,
  label,
  initial,
  schema,
  disabled,
  onSave,
}: {
  title: string;
  description: ReactNode;
  label: string;
  initial: string;
  schema: typeof profileSchema | typeof workspaceSchema;
  disabled?: boolean;
  onSave: (name: string) => Promise<unknown>;
}) {
  const form = useForm<{ name: string }>({ resolver: zodResolver(schema), defaultValues: { name: initial } });
  const submit = form.handleSubmit(async ({ name }) => {
    // A failure is already shown: every save here is a mutation, and the
    // mutation cache toasts errors (main.tsx).
    const saved = await onSave(name).then(
      () => true,
      () => false,
    );
    if (!saved) return;
    form.reset({ name });
    toast.success("Saved");
  });
  return (
    <Card>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormField control={form.control} name="name" label={label} className="max-w-sm">
            {(field) => <Input {...field} disabled={disabled} />}
          </FormField>
        </CardContent>
        {!disabled && (
          <CardFooter className="justify-end border-t">
            <Button type="submit" size="sm" disabled={!form.formState.isDirty || form.formState.isSubmitting}>
              Save
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  );
}

function ProfileCard() {
  const { me } = useWorkspace();
  const client = useQueryClient();
  const rename = useMutation({
    mutationFn: (name: string) => api("me", { method: "PATCH", body: { name } }),
    // Your name shows in every workspace, so refresh them all.
    onSuccess: () => client.invalidateQueries(),
  });
  return (
    <NameForm
      key={me.user.name}
      title="Your profile"
      description={`How teammates see you. You sign in as ${me.user.email || "your Yard account"}.`}
      label="Display name"
      initial={me.user.name}
      schema={profileSchema}
      onSave={(name) => rename.mutateAsync(name)}
    />
  );
}

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const client = useQueryClient();
  const rename = useWsMutation<string>((base, name) => api(base, { method: "PATCH", body: { name } }));
  const canEdit = ROLE_RANK[workspace.role] >= ROLE_RANK.admin;
  return (
    <NameForm
      title="Workspace"
      description={canEdit ? "The name everyone in this workspace sees." : "Only admins can rename the workspace."}
      key={workspace.name}
      label="Workspace name"
      initial={workspace.name}
      schema={workspaceSchema}
      disabled={!canEdit}
      onSave={async (name) => {
        await rename.mutateAsync(name);
        await client.invalidateQueries(meQuery);
      }}
    />
  );
}

function InviteCard({ workspace }: { workspace: Workspace }) {
  const reset = useWsMutation<void>((base) => api(`${base}/invite/reset`, { method: "POST" }));
  if (!workspace.invite_token) return null;
  // The app's own URL with ?invite=: Yard signs the person in first, then
  // main.tsx routes them to the join screen.
  const link = `${location.origin}${location.pathname}?invite=${workspace.invite_token}`;
  const full = workspace.usage.members >= workspace.limits.members;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite link</CardTitle>
        <CardDescription>
          {workspace.limits.members === 1
            ? "Free workspaces are for one person. Upgrade to Pro to invite your team."
            : `Anyone with this link can join as a member. ${workspace.usage.members} of ${workspace.limits.members} seats used.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={full}
            onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Invite link copied"))}
          >
            <CopyIcon />
            Copy
          </Button>
          <ConfirmReset
            onConfirm={() => reset.mutate(undefined, { onSuccess: () => toast.success("New invite link created") })}
          />
        </div>
      </CardContent>
      {workspace.limits.members === 1 && workspace.is_owner && (
        <CardFooter className="border-t">
          <Button size="sm" asChild>
            <a href={PRICING_URL}>Upgrade to Pro</a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

function ConfirmReset({ onConfirm }: { onConfirm: () => void }) {
  return (
    <ConfirmDelete
      title="Reset the invite link?"
      description="Links you've already shared stop working. People who joined stay."
      onConfirm={onConfirm}
    >
      <Button variant="outline">
        <RefreshCwIcon />
        Reset
      </Button>
    </ConfirmDelete>
  );
}

function MembersCard({ workspace }: { workspace: Workspace }) {
  const { data: members } = useMembers();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Owners and admins manage people. Everyone can work with every record.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {members?.map((member) => (
            <MemberRow key={member.user_id} member={member} workspace={workspace} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MemberRow({ member, workspace }: { member: Member; workspace: Workspace }) {
  const { me, switchWorkspace } = useWorkspace();
  const client = useQueryClient();
  const navigate = useNavigate();
  const setRole = useWsMutation<Role>((base, role) =>
    api(`${base}/members/${member.user_id}`, { method: "PATCH", body: { role } }),
  );
  const remove = useWsMutation<void>((base) => api(`${base}/members/${member.user_id}`, { method: "DELETE" }));
  const isMe = member.user_id === me.user.id;
  // Mirrors the service: admins remove members, only the owner removes
  // admins, nobody removes the owner, and anyone else may leave.
  const canRemove =
    member.role !== "owner" &&
    (isMe || (workspace.role === "owner" ? true : workspace.role === "admin" && member.role === "member"));

  const leaveOrRemove = async () => {
    const removed = await remove.mutateAsync().then(
      () => true,
      () => false,
    );
    if (!removed) return;
    if (isMe) {
      await client.refetchQueries(meQuery);
      switchWorkspace(me.workspaces.find((w) => w.is_owner)!.id);
      navigate("/");
      toast.success(`You left ${workspace.name}`);
    } else toast.success(`${member.name} was removed`);
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <PersonAvatar name={member.name} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {member.name} {isMe && <span className="text-muted-foreground font-normal">(you)</span>}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {member.email} · joined {formatDate(member.joined_at)}
        </p>
      </div>
      {workspace.role === "owner" && member.role !== "owner" ? (
        <Select value={member.role} onValueChange={(role) => setRole.mutate(role as Role)}>
          <SelectTrigger size="sm" className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge variant="secondary" className="capitalize">
          {member.role}
        </Badge>
      )}
      {canRemove && (
        <ConfirmDelete
          title={isMe ? `Leave ${workspace.name}?` : `Remove ${member.name}?`}
          description={isMe ? "You'll need a new invite to come back." : "Their records stay, still assigned to them."}
          onConfirm={leaveOrRemove}
        >
          <Button variant="ghost" size="sm" className="text-destructive">
            {isMe ? "Leave" : "Remove"}
          </Button>
        </ConfirmDelete>
      )}
    </li>
  );
}

function PlanCard({ workspace }: { workspace: Workspace }) {
  const usage: [string, number, number | null][] = [
    ["Contacts", workspace.usage.contacts, workspace.limits.contacts],
    ["Open deals", workspace.usage.open_deals, workspace.limits.open_deals],
    ["Members", workspace.usage.members, workspace.limits.members],
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Orbit {workspace.plan === "pro" ? "Pro" : "Free"}
          <Badge variant={workspace.plan === "pro" ? "default" : "secondary"}>Current plan</Badge>
        </CardTitle>
        <CardDescription>
          {workspace.is_owner
            ? "This workspace runs on your plan."
            : `This workspace runs on ${workspace.owner_name}'s plan.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {usage.map(([label, used, cap]) => (
          <div key={label} className="flex flex-col gap-2">
            <div className="flex justify-between text-sm">
              <span>{label}</span>
              <span className="text-muted-foreground tabular-nums">
                {used} {cap === null ? "· unlimited" : `of ${cap}`}
              </span>
            </div>
            <Progress value={cap === null ? 0 : Math.min(100, (used / cap) * 100)} />
          </div>
        ))}
      </CardContent>
      {workspace.is_owner && (
        <CardFooter className="justify-end gap-2 border-t">
          {workspace.plan === "pro" ? (
            <Button variant="outline" size="sm" asChild>
              <a href="https://yard.sh/library" target="_blank" rel="noreferrer">
                Manage subscription
              </a>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <a href={PRICING_URL}>Upgrade to Pro</a>
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
