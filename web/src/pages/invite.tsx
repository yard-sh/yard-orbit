import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UsersIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import type { InvitePreview } from "@shared/types";
import { OrbitMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { meQuery, useWorkspace } from "@/lib/workspace";

// …/app/?invite=<token> lands here (main.tsx moves the token into the
// hash). Joining is one click; the workspace then opens.
export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const client = useQueryClient();
  const { switchWorkspace } = useWorkspace();
  const { data: invite, error } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api<InvitePreview>(`invites/${encodeURIComponent(token)}`),
    retry: false,
  });

  const open = (id: string) => {
    switchWorkspace(id);
    navigate("/", { replace: true });
  };

  const accept = async () => {
    try {
      const { workspace_id } = await api<{ workspace_id: string }>(`invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      await client.refetchQueries(meQuery);
      toast.success(`You joined ${invite!.workspace.name}`);
      open(workspace_id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't join");
    }
  };

  return (
    <div className="bg-muted/40 flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader className="items-center">
          <div className="bg-primary text-primary-foreground mx-auto mb-2 flex size-12 items-center justify-center rounded-xl">
            {invite ? <UsersIcon className="size-5" /> : <OrbitMark className="size-6" />}
          </div>
          {error ? (
            <>
              <CardTitle>This invite link doesn't work</CardTitle>
              <CardDescription>It may have been reset. Ask whoever sent it for a new one.</CardDescription>
            </>
          ) : !invite ? (
            <Skeleton className="mx-auto h-6 w-48" />
          ) : (
            <>
              <CardTitle>Join {invite.workspace.name}</CardTitle>
              <CardDescription>
                {invite.owner_name} invited you to their Orbit workspace. {invite.member_count}{" "}
                {invite.member_count === 1 ? "person is" : "people are"} there already.
              </CardDescription>
            </>
          )}
        </CardHeader>
        {invite?.full && !invite.already_member && (
          <CardContent className="text-muted-foreground text-sm">
            This workspace is full on its current plan. {invite.owner_name} can upgrade to Pro to add you.
          </CardContent>
        )}
        <CardFooter className="flex-col gap-2">
          {invite?.already_member ? (
            <Button className="w-full" onClick={() => open(invite.workspace.id)}>
              You're already a member. Open it
            </Button>
          ) : (
            invite && (
              <Button className="w-full" disabled={invite.full} onClick={accept}>
                Join workspace
              </Button>
            )
          )}
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/">Not now</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
