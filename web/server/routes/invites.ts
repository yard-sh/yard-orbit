import type { InvitePreview } from "../../shared/types";
import type { Ctx } from "../context";
import type { Env } from "../env";
import { json, notFound } from "../http";
import { log, shortId } from "../log";
import { checkLimit, hasRoom, ownerLimits } from "../workspace";

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

// The invite link is …/app/?invite=<token>: one per workspace, joining as
// a member. Accepting needs room under the owner's member limit.
async function findInvite(env: Env, token: string) {
  if (!TOKEN.test(token)) throw notFound("invite");
  const row = await env.DB.prepare(
    "SELECT w.id, w.name, w.owner_id, u.name AS owner_name," +
      " (SELECT COUNT(*) FROM workspace_members x WHERE x.workspace_id = w.id) AS member_count" +
      " FROM workspaces w LEFT JOIN users u ON u.id = w.owner_id WHERE w.invite_token = ?1",
  )
    .bind(token)
    .first<{ id: string; name: string; owner_id: string; owner_name: string | null; member_count: number }>();
  // A reset link reads the same as one that never existed.
  if (!row) throw notFound("invite");
  return row;
}

// What the join screen shows before anyone accepts.
export async function previewInvite({ env, me }: Ctx, { token }: Record<string, string>) {
  const invite = await findInvite(env, token);
  const member = await env.DB.prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2")
    .bind(invite.id, me.id)
    .first();
  const full = !member && !(await hasRoom(env, await ownerLimits(env, invite.id), "members"));
  return json({
    workspace: { id: invite.id, name: invite.name },
    owner_name: invite.owner_name ?? "Someone",
    member_count: invite.member_count,
    already_member: !!member,
    full,
  } satisfies InvitePreview);
}

export async function acceptInvite({ env, me }: Ctx, { token }: Record<string, string>) {
  const invite = await findInvite(env, token);
  const member = await env.DB.prepare("SELECT 1 FROM workspace_members WHERE workspace_id = ?1 AND user_id = ?2")
    .bind(invite.id, me.id)
    .first();
  if (!member) {
    const capped = await ownerLimits(env, invite.id);
    await checkLimit(env, capped, "members");
    // The cap is checked again inside the INSERT, so two people accepting
    // at once can't both take the last seat.
    const { meta } = await env.DB.prepare(
      "INSERT OR IGNORE INTO workspace_members (workspace_id, user_id, role, joined_at)" +
        " SELECT ?1, ?2, 'member', ?3 WHERE (SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ?1) < ?4",
    )
      .bind(invite.id, me.id, Date.now(), capped.limits.members)
      .run();
    if (meta.changes === 0) await checkLimit(env, capped, "members");
    log("invite.accept", { ws: shortId(invite.id), member: shortId(me.id) });
  }
  return json({ workspace_id: invite.id });
}
