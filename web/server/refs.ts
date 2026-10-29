// Foreign keys in a request body must point inside the same workspace, or a
// contact could be filed under another workspace's company and the join
// would leak that company's name. Owners and assignees must be members.

import type { Env } from "./env";
import { HttpError } from "./http";

interface Refs {
  company_id?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  owner_id?: string | null;
  assignee_id?: string | null;
}

const TABLES = {
  company_id: ["companies", "company"],
  contact_id: ["contacts", "contact"],
  deal_id: ["deals", "deal"],
} as const;

export async function checkRefs(env: Env, workspaceId: string, refs: Refs) {
  const checks: Promise<void>[] = [];
  for (const key of ["company_id", "contact_id", "deal_id"] as const) {
    const id = refs[key];
    if (!id) continue;
    const [table, noun] = TABLES[key];
    checks.push(
      expect(
        env.DB.prepare(`SELECT 1 FROM ${table} WHERE id = ?1 AND workspace_id = ?2`).bind(id, workspaceId).first(),
        `that ${noun} isn't in this workspace`,
      ),
    );
  }
  for (const key of ["owner_id", "assignee_id"] as const) {
    const id = refs[key];
    if (!id) continue;
    checks.push(
      expect(
        env.DB.prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2")
          .bind(workspaceId, id)
          .first(),
        "that person isn't a member of this workspace",
      ),
    );
  }
  await Promise.all(checks);
}

async function expect(row: Promise<unknown>, message: string) {
  if (!(await row)) throw new HttpError(400, "invalid_reference", message);
}
