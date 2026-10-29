import { CheckIcon, SparklesIcon } from "lucide-react";
import { LIMITS } from "@shared/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRICING_URL } from "@/lib/api";
import { useWorkspaceDetail } from "@/lib/queries";
import { closeUpgrade, useUpgrade } from "@/lib/upgrade";
import { useWorkspace } from "@/lib/workspace";

const REASON = {
  members: "Free workspaces are for one person. Pro lets you invite your team.",
  contacts: `Free workspaces hold ${LIMITS.free.contacts} contacts.`,
  open_deals: `Free workspaces hold ${LIMITS.free.open_deals} open deals at once.`,
};

// Opened by any 402 from the API (see lib/upgrade.ts). Only the owner is
// sent to the plans: the workspace runs on their plan.
export function UpgradeDialog() {
  const { open, limit } = useUpgrade();
  const { workspace } = useWorkspace();
  const { data: detail } = useWorkspaceDetail();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeUpgrade()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
            <SparklesIcon className="size-5" />
          </div>
          <DialogTitle>Upgrade to Orbit Pro</DialogTitle>
          <DialogDescription>
            {limit ? REASON[limit] : "Pro removes every limit."}{" "}
            {!workspace.is_owner &&
              `Limits follow the workspace owner's plan, so ask ${detail?.owner_name ?? "them"} to upgrade.`}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2 text-sm">
          {[
            "Unlimited contacts and deals",
            `Up to ${LIMITS.pro.members} teammates`,
            "Admin and member roles",
            "14-day free trial, no card",
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <CheckIcon className="size-4 text-emerald-500" />
              {feature}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={closeUpgrade}>
            Not now
          </Button>
          {workspace.is_owner && (
            <Button asChild>
              <a href={PRICING_URL}>See plans</a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
