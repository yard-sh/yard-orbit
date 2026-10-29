import { ROLE_RANK } from "../../shared/constants";
import { roleSchema, workspaceSchema } from "../../shared/schemas";
import type { Member, Workspace } from "../../shared/types";
import type { WsCtx } from "../context";
import { HttpError, json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { changed } from "../sql";
import { newToken, requireRole, usage, type Access } from "../workspace";

async function detail({ env, ws }: Pick<WsCtx, "env" | "ws">): Promise<Workspace> {
  const [owner, used] = await Promise.all([
    env.DB.prepare("SELECT name FROM users WHERE id = ?1").bind(ws.owner_id).first<{ name: string }>(),
    usage(env, ws.id),
  ]);
  return {
    id: ws.id,
    name: ws.name,
    role: ws.role,
    is_owner: ws.role === "owner",
    plan: ws.plan,
    owner_id: ws.owner_id,
    owner_name: owner?.name ?? "Someone",
    limits: ws.limits,
    usage: used,
    invite_token: ROLE_RANK[ws.role] >= ROLE_RANK.admin ? ws.invite_token : null,
  };
}

export async function getWorkspace(ctx: WsCtx) {
  return json(await detail(ctx));
}

export async function renameWorkspace({ env, ws, request }: WsCtx) {
  requireRole(ws, "admin");
  const { name } = await parse(request, workspaceSchema);
  await env.DB.prepare("UPDATE workspaces SET name = ?1 WHERE id = ?2").bind(name, ws.id).run();
  log("workspace.rename", { ws: shortId(ws.id), nameLen: name.length });
  return json(await detail({ env, ws: { ...ws, name } }));
}

// A new token revokes every invite link shared so far.
export async function resetInvite({ env, ws }: WsCtx) {
  requireRole(ws, "admin");
  const token = newToken();
  await env.DB.prepare("UPDATE workspaces SET invite_token = ?1 WHERE id = ?2").bind(token, ws.id).run();
  log("invite.reset", { ws: shortId(ws.id) });
  return json(await detail({ env, ws: { ...ws, invite_token: token } }));
}

export async function listMembers({ env, ws }: WsCtx) {
  const { results } = await env.DB.prepare(
    "SELECT u.id AS user_id, u.name, u.email, m.role, m.joined_at FROM workspace_members m JOIN users u ON u.id = m.user_id" +
      " WHERE m.workspace_id = ?1 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.joined_at",
  )
    .bind(ws.id)
    .all<Member>();
  return json(results);
}

// Only the owner promotes and demotes, and the owner's own role is fixed.
export async function setRole({ env, ws, request }: WsCtx, { uid }: Record<string, string>) {
  requireRole(ws, "owner");
  const { role } = await parse(request, roleSchema);
  if (uid === ws.owner_id) throw new HttpError(400, "invalid", "the owner's role can't change");
  await changed(
    env.DB.prepare("UPDATE workspace_members SET role = ?1 WHERE workspace_id = ?2 AND user_id = ?3").bind(
      role,
      ws.id,
      uid,
    ),
    "member",
  );
  log("member.role", { ws: shortId(ws.id), member: shortId(uid), role });
  return new Response(null, { status: 204 });
}

// Removing yourself is leaving, which anyone but the owner may do. Removing
// someone else takes an admin, and removing an admin takes the owner. Their
// records stay, still assigned to them, until someone reassigns them.
export async function removeMember({ env, ws, me }: WsCtx, { uid }: Record<string, string>) {
  if (uid === ws.owner_id) throw new HttpError(400, "invalid", "the owner can't leave their own workspace");
  if (uid !== me.id) {
    requireRole(ws, "admin");
    const target = await memberRole(env, ws, uid);
    if (target === "admin") requireRole(ws, "owner");
  }
  await changed(
    env.DB.prepare("DELETE FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2").bind(ws.id, uid),
    "member",
  );
  log(uid === me.id ? "member.leave" : "member.remove", { ws: shortId(ws.id), member: shortId(uid) });
  return new Response(null, { status: 204 });
}

async function memberRole(env: WsCtx["env"], ws: Access, uid: string) {
  const row = await env.DB.prepare("SELECT role FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2")
    .bind(ws.id, uid)
    .first<{ role: string }>();
  if (!row) throw notFound("member");
  return row.role;
}
