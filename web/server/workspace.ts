// Workspaces, roles and plan limits. Every workspace route resolves its
// workspace through workspaceAccess first; anything the caller isn't a
// member of answers 404, the same as something that doesn't exist, so ids
// can't be probed.

import { LIMITS, ROLE_RANK, type Limits, type Plan, type Role } from "../shared/constants";
import type { Env } from "./env";
import { HttpError, notFound } from "./http";
import { effectivePlan, type Caller } from "./identity";
import { log, shortId } from "./log";

export interface Access {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string;
  role: Role;
  plan: Plan;
  limits: Limits;
}

// Everyone has exactly one workspace of their own, made on their first
// visit and never deletable. The unique index on workspaces(owner_id) makes
// the INSERT OR IGNOREs safe when two first requests race: one row wins and
// both requests read it back.
export async function ensureWorkspace(env: Env, me: Caller): Promise<string> {
  const find = env.DB.prepare("SELECT id FROM workspaces WHERE owner_id = ?1").bind(me.id);
  const found = await find.first<{ id: string }>();
  if (found) return found.id;

  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO workspaces (id, owner_id, name, invite_token, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    ).bind(crypto.randomUUID(), me.id, workspaceNameFor(me.name), newToken(), now),
    env.DB.prepare(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at)" +
        " SELECT id, owner_id, 'owner', ?2 FROM workspaces WHERE owner_id = ?1",
    ).bind(me.id, now),
  ]);
  const made = (await find.first<{ id: string }>())!;
  log("workspace.provision", { user: shortId(me.id), ws: shortId(made.id) });
  return made.id;
}

// "Tate McCormick" becomes "Tate's workspace".
function workspaceNameFor(name: string): string {
  const first = (name.split(/\s+/).find(Boolean) || "My").slice(0, 30);
  return `${first}'s workspace`;
}

interface AccessRow {
  id: string;
  name: string;
  owner_id: string;
  invite_token: string;
  role: Role;
  owner_plan: string | null;
  owner_pro_until: number | null;
}

export async function workspaceAccess(env: Env, me: Caller, workspaceId: string): Promise<Access> {
  const row = await env.DB.prepare(
    "SELECT w.id, w.name, w.owner_id, w.invite_token, m.role, u.plan AS owner_plan, u.pro_until AS owner_pro_until" +
      " FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id AND m.user_id = ?2" +
      " LEFT JOIN users u ON u.id = w.owner_id WHERE w.id = ?1",
  )
    .bind(workspaceId, me.id)
    .first<AccessRow>();
  if (!row) throw notFound("workspace");
  // The owner's own request carries their live plan; everyone else reads
  // the owner's snapshot.
  const plan =
    row.owner_id === me.id ? me.plan : effectivePlan({ plan: row.owner_plan, pro_until: row.owner_pro_until });
  return {
    id: row.id,
    name: row.name,
    owner_id: row.owner_id,
    invite_token: row.invite_token,
    role: row.role,
    plan,
    limits: LIMITS[plan],
  };
}

export function requireRole(ws: Access, role: Role) {
  if (ROLE_RANK[ws.role] >= ROLE_RANK[role]) return;
  const who = role === "owner" ? "the workspace owner" : "admins and the owner";
  throw new HttpError(403, "forbidden", `only ${who} can do that`);
}

export async function usage(env: Env, workspaceId: string) {
  const row = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ?1) AS members," +
      " (SELECT COUNT(*) FROM contacts WHERE workspace_id = ?1) AS contacts," +
      " (SELECT COUNT(*) FROM deals WHERE workspace_id = ?1 AND stage NOT IN ('won', 'lost')) AS open_deals",
  )
    .bind(workspaceId)
    .first<{ members: number; contacts: number; open_deals: number }>();
  return row!;
}

const LIMIT_NOUN: Record<keyof Limits, string> = {
  members: "people",
  contacts: "contacts",
  open_deals: "open deals",
};

type Capped = Pick<Access, "id" | "limits">;

export async function hasRoom(env: Env, ws: Capped, limit: keyof Limits, adding = 1): Promise<boolean> {
  const cap = ws.limits[limit];
  if (cap === null) return true;
  return (await usage(env, ws.id))[limit] + adding <= cap;
}

// Throws a 402 when adding `adding` more of `limit` would pass the plan's
// cap. The app answers a 402 with the upgrade dialog.
export async function checkLimit(env: Env, ws: Capped, limit: keyof Limits, adding = 1) {
  if (await hasRoom(env, ws, limit, adding)) return;
  const cap = ws.limits[limit];
  log("limit.reached", { ws: shortId(ws.id), limit, cap });
  throw new HttpError(
    402,
    "plan_limit",
    `the Free plan includes ${cap} ${LIMIT_NOUN[limit]}; upgrade to Pro for more`,
    {
      limit,
    },
  );
}

// A workspace's limits for someone who isn't in it yet (an invite): its
// owner's snapshot, as workspaceAccess reads it for members.
export async function ownerLimits(env: Env, workspaceId: string): Promise<Capped> {
  const row = await env.DB.prepare(
    "SELECT u.plan, u.pro_until FROM workspaces w LEFT JOIN users u ON u.id = w.owner_id WHERE w.id = ?1",
  )
    .bind(workspaceId)
    .first<{ plan: string | null; pro_until: number | null }>();
  return { id: workspaceId, limits: LIMITS[effectivePlan(row)] };
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
