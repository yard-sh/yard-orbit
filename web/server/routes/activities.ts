import type { ActivityKind } from "../../shared/constants";
import { activitySchema } from "../../shared/schemas";
import type { Activity } from "../../shared/types";
import type { WsCtx } from "../context";
import type { Env, Statement } from "../env";
import { HttpError, json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { checkRefs } from "../refs";
import { ACTIVITY_SELECT } from "../select";
import { limitParam } from "../sql";
import { requireRole } from "../workspace";

type Subject = "contact_id" | "company_id" | "deal_id";
const SUBJECTS: Subject[] = ["contact_id", "company_id", "deal_id"];

// One timeline: ?contact_id=, ?company_id= or ?deal_id=. Newest first.
export async function listActivities({ env, ws, url }: WsCtx) {
  const subject = SUBJECTS.find((key) => url.searchParams.get(key));
  if (!subject) throw new HttpError(400, "invalid", "pass contact_id, company_id or deal_id");
  const { results } = await env.DB.prepare(
    `${ACTIVITY_SELECT} WHERE a.${subject} = ?1 AND a.workspace_id = ?2 ORDER BY a.created_at DESC LIMIT ?3`,
  )
    .bind(url.searchParams.get(subject), ws.id, limitParam(url, 100, 500))
    .all<Activity>();
  return json(results);
}

export async function createActivity({ env, ws, me, request }: WsCtx) {
  const input = await parse(request, activitySchema);
  if (!input.contact_id && !input.company_id && !input.deal_id) {
    throw new HttpError(400, "invalid", "log it on a contact, company or deal");
  }
  await checkRefs(env, ws.id, input);
  const subjects = await widen(env, ws.id, input);
  const id = crypto.randomUUID();
  await insertActivity(env, ws.id, { id, kind: input.kind, body: input.body, author_id: me.id, ...subjects }).run();
  log("activity.create", { ws: shortId(ws.id), kind: input.kind, bodyLen: input.body.length });
  const row = await env.DB.prepare(`${ACTIVITY_SELECT} WHERE a.id = ?1`).bind(id).first<Activity>();
  return json(row, 201);
}

// Authors delete their own entries; admins and the owner delete any.
// System entries (stage changes) are part of the record and stay.
export async function deleteActivity({ env, ws, me }: WsCtx, { id }: Record<string, string>) {
  const row = await env.DB.prepare("SELECT author_id, kind FROM activities WHERE id = ?1 AND workspace_id = ?2")
    .bind(id, ws.id)
    .first<{ author_id: string | null; kind: ActivityKind }>();
  if (!row) throw notFound("activity");
  if (row.kind === "created" || row.kind === "stage_change") {
    throw new HttpError(403, "forbidden", "history entries can't be deleted");
  }
  if (row.author_id !== me.id) requireRole(ws, "admin");
  await env.DB.prepare("DELETE FROM activities WHERE id = ?1 AND workspace_id = ?2").bind(id, ws.id).run();
  log("activity.delete", { ws: shortId(ws.id), activity: shortId(id) });
  return new Response(null, { status: 204 });
}

// An entry logged on a deal also lands on the deal's contact and company
// timelines, and one logged on a contact on their company's.
async function widen(env: Env, workspaceId: string, input: Partial<Record<Subject, string | null>>) {
  const subjects = {
    contact_id: input.contact_id ?? null,
    company_id: input.company_id ?? null,
    deal_id: input.deal_id ?? null,
  };
  if (subjects.deal_id) {
    const deal = await env.DB.prepare("SELECT contact_id, company_id FROM deals WHERE id = ?1 AND workspace_id = ?2")
      .bind(subjects.deal_id, workspaceId)
      .first<{ contact_id: string | null; company_id: string | null }>();
    subjects.contact_id ??= deal?.contact_id ?? null;
    subjects.company_id ??= deal?.company_id ?? null;
  }
  if (subjects.contact_id && !subjects.company_id) {
    const contact = await env.DB.prepare("SELECT company_id FROM contacts WHERE id = ?1 AND workspace_id = ?2")
      .bind(subjects.contact_id, workspaceId)
      .first<{ company_id: string | null }>();
    subjects.company_id = contact?.company_id ?? null;
  }
  return subjects;
}

export function insertActivity(
  env: Env,
  workspaceId: string,
  a: {
    id?: string;
    kind: ActivityKind;
    body?: string;
    author_id: string | null;
    contact_id: string | null;
    company_id: string | null;
    deal_id: string | null;
    created_at?: number;
  },
): Statement {
  return env.DB.prepare(
    "INSERT INTO activities (id, workspace_id, kind, body, contact_id, company_id, deal_id, author_id, created_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
  ).bind(
    a.id ?? crypto.randomUUID(),
    workspaceId,
    a.kind,
    a.body ?? "",
    a.contact_id,
    a.company_id,
    a.deal_id,
    a.author_id,
    a.created_at ?? Date.now(),
  );
}

// When a contact, company or deal is deleted, its timeline entries let go
// of it, and any entry that no longer belongs to anything goes too.
export function detachActivities(env: Env, workspaceId: string, subject: Subject, id: string): Statement[] {
  return [
    env.DB.prepare(`UPDATE activities SET ${subject} = NULL WHERE ${subject} = ?1 AND workspace_id = ?2`).bind(
      id,
      workspaceId,
    ),
    env.DB.prepare(
      "DELETE FROM activities WHERE workspace_id = ?1 AND contact_id IS NULL AND company_id IS NULL AND deal_id IS NULL",
    ).bind(workspaceId),
  ];
}
