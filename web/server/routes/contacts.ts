import { CONTACT_STATUS_KEYS, MAX_LIST } from "../../shared/constants";
import { contactSchema } from "../../shared/schemas";
import type { Contact, ContactDetail, Deal, Task } from "../../shared/types";
import type { WsCtx } from "../context";
import type { Env } from "../env";
import { blanksToNull, json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { checkRefs } from "../refs";
import { CONTACT_SELECT, DEAL_SELECT, TASK_ORDER, TASK_SELECT } from "../select";
import { changed, like, update, Where } from "../sql";
import { checkLimit } from "../workspace";
import { detachActivities } from "./activities";

const OPTIONAL_TEXT = ["email", "phone", "title"] as const;

export async function listContacts({ env, ws, url }: WsCtx) {
  const where = new Where().add("c.workspace_id = ?", ws.id);
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const term = like(q);
    where.add(
      "(c.first_name || ' ' || c.last_name LIKE ? ESCAPE '\\' OR c.email LIKE ? ESCAPE '\\' OR co.name LIKE ? ESCAPE '\\')",
      term,
      term,
      term,
    );
  }
  const status = url.searchParams.get("status");
  if (status && (CONTACT_STATUS_KEYS as string[]).includes(status)) where.add("c.status = ?", status);

  const { results } = await env.DB.prepare(`${CONTACT_SELECT}${where} ORDER BY c.updated_at DESC LIMIT ${MAX_LIST}`)
    .bind(...where.binds)
    .all<Contact>();
  return json(results);
}

async function loadContact(env: Env, workspaceId: string, id: string): Promise<ContactDetail> {
  const contact = await env.DB.prepare(`${CONTACT_SELECT} WHERE c.id = ?1 AND c.workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<Contact>();
  if (!contact) throw notFound("contact");
  const [deals, tasks] = await Promise.all([
    env.DB.prepare(`${DEAL_SELECT} WHERE d.contact_id = ?1 AND d.workspace_id = ?2 ORDER BY d.updated_at DESC`)
      .bind(id, workspaceId)
      .all<Deal>(),
    env.DB.prepare(`${TASK_SELECT} WHERE t.contact_id = ?1 AND t.workspace_id = ?2${TASK_ORDER}`)
      .bind(id, workspaceId)
      .all<Task>(),
  ]);
  return { contact, deals: deals.results, tasks: tasks.results };
}

export async function getContact({ env, ws }: WsCtx, { id }: Record<string, string>) {
  return json(await loadContact(env, ws.id, id));
}

export async function createContact({ env, ws, request, me }: WsCtx) {
  const input = blanksToNull(await parse(request, contactSchema), [...OPTIONAL_TEXT]);
  await Promise.all([checkLimit(env, ws, "contacts"), checkRefs(env, ws.id, input)]);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO contacts (id, workspace_id, company_id, first_name, last_name, email, phone, title, status, owner_id, created_at, updated_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
  )
    .bind(
      id,
      ws.id,
      input.company_id,
      input.first_name,
      input.last_name,
      input.email,
      input.phone,
      input.title,
      input.status,
      input.owner_id ?? me.id,
      Date.now(),
    )
    .run();
  log("contact.create", { ws: shortId(ws.id), contact: shortId(id) });
  return json(await loadContact(env, ws.id, id), 201);
}

export async function updateContact({ env, ws, request }: WsCtx, { id }: Record<string, string>) {
  const input = blanksToNull(await parse(request, contactSchema.partial()), [...OPTIONAL_TEXT]);
  await checkRefs(env, ws.id, input);
  await changed(update(env.DB, "contacts", input, id, ws.id), "contact");
  log("contact.update", { ws: shortId(ws.id), contact: shortId(id), fields: Object.keys(input).length });
  return json(await loadContact(env, ws.id, id));
}

// Deals and tasks stay, unlinked from the person; their timeline entries go
// unless a deal or company still holds them.
export async function deleteContact({ env, ws }: WsCtx, { id }: Record<string, string>) {
  await changed(env.DB.prepare("DELETE FROM contacts WHERE id = ?1 AND workspace_id = ?2").bind(id, ws.id), "contact");
  await env.DB.batch([
    env.DB.prepare("UPDATE deals SET contact_id = NULL WHERE contact_id = ?1 AND workspace_id = ?2").bind(id, ws.id),
    env.DB.prepare("UPDATE tasks SET contact_id = NULL WHERE contact_id = ?1 AND workspace_id = ?2").bind(id, ws.id),
    ...detachActivities(env, ws.id, "contact_id", id),
  ]);
  log("contact.delete", { ws: shortId(ws.id), contact: shortId(id) });
  return new Response(null, { status: 204 });
}
