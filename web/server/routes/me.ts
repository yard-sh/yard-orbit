import type { Role } from "../../shared/constants";
import { profileSchema } from "../../shared/schemas";
import type { Me, WorkspaceSummary } from "../../shared/types";
import type { Ctx } from "../context";
import { json, parse } from "../http";
import { effectivePlan } from "../identity";
import { log, shortId } from "../log";
import { ensureWorkspace } from "../workspace";

// The app's first call: who I am and every workspace I can open, my own
// first. My own workspace is made here on my first visit.
export async function getMe({ env, me }: Pick<Ctx, "env" | "me">) {
  await ensureWorkspace(env, me);
  const { results } = await env.DB.prepare(
    "SELECT w.id, w.name, w.owner_id, m.role, u.plan AS owner_plan, u.pro_until AS owner_pro_until" +
      " FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id LEFT JOIN users u ON u.id = w.owner_id" +
      " WHERE m.user_id = ?1 ORDER BY (w.owner_id = ?1) DESC, w.name COLLATE NOCASE",
  )
    .bind(me.id)
    .all<{
      id: string;
      name: string;
      owner_id: string;
      role: Role;
      owner_plan: string;
      owner_pro_until: number | null;
    }>();

  const workspaces: WorkspaceSummary[] = results.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    is_owner: row.owner_id === me.id,
    plan: row.owner_id === me.id ? me.plan : effectivePlan({ plan: row.owner_plan, pro_until: row.owner_pro_until }),
  }));
  return json({
    user: { id: me.id, name: me.name, email: me.email },
    plan: me.plan,
    entitlement: me.entitlement,
    workspaces,
  } satisfies Me);
}

export async function updateMe({ env, me, request }: Ctx) {
  const { name } = await parse(request, profileSchema);
  await env.DB.prepare("UPDATE users SET name = ?1 WHERE id = ?2").bind(name, me.id).run();
  log("me.rename", { user: shortId(me.id), nameLen: name.length });
  return getMe({ env, me: { ...me, name } });
}
