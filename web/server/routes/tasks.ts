import { MAX_LIST } from "../../shared/constants";
import { taskPatchSchema, taskSchema } from "../../shared/schemas";
import type { Task } from "../../shared/types";
import type { WsCtx } from "../context";
import type { Env } from "../env";
import { json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { checkRefs } from "../refs";
import { TASK_ORDER, TASK_SELECT } from "../select";
import { changed, update, Where } from "../sql";

// ?status=open (default), done or all; ?assignee_id= narrows to one person.
export async function listTasks({ env, ws, url }: WsCtx) {
  const where = new Where().add("t.workspace_id = ?", ws.id);
  const status = url.searchParams.get("status") || "open";
  if (status === "open") where.add("t.done_at IS NULL");
  if (status === "done") where.add("t.done_at IS NOT NULL");
  const assignee = url.searchParams.get("assignee_id");
  if (assignee) where.add("t.assignee_id = ?", assignee);

  const { results } = await env.DB.prepare(`${TASK_SELECT}${where}${TASK_ORDER} LIMIT ${MAX_LIST}`)
    .bind(...where.binds)
    .all<Task>();
  return json(results);
}

async function loadTask(env: Env, workspaceId: string, id: string): Promise<Task> {
  const task = await env.DB.prepare(`${TASK_SELECT} WHERE t.id = ?1 AND t.workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<Task>();
  if (!task) throw notFound("task");
  return task;
}

export async function createTask({ env, ws, me, request }: WsCtx) {
  const input = await parse(request, taskSchema);
  await checkRefs(env, ws.id, input);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO tasks (id, workspace_id, title, due_at, assignee_id, contact_id, company_id, deal_id, created_by, created_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
  )
    .bind(
      id,
      ws.id,
      input.title,
      input.due_at,
      input.assignee_id ?? me.id,
      input.contact_id,
      input.company_id,
      input.deal_id,
      me.id,
      Date.now(),
    )
    .run();
  log("task.create", { ws: shortId(ws.id), task: shortId(id) });
  return json(await loadTask(env, ws.id, id), 201);
}

export async function updateTask({ env, ws, request }: WsCtx, { id }: Record<string, string>) {
  const { done, ...input } = await parse(request, taskPatchSchema);
  await checkRefs(env, ws.id, input);
  // Ticking a task that's already done keeps when it was really done.
  const doneAt = done ? ((await loadTask(env, ws.id, id)).done_at ?? Date.now()) : null;
  const fields = { ...input, done_at: done === undefined ? undefined : doneAt };
  await changed(update(env.DB, "tasks", fields, id, ws.id, false), "task");
  log("task.update", { ws: shortId(ws.id), task: shortId(id), done });
  return json(await loadTask(env, ws.id, id));
}

export async function deleteTask({ env, ws }: WsCtx, { id }: Record<string, string>) {
  await changed(env.DB.prepare("DELETE FROM tasks WHERE id = ?1 AND workspace_id = ?2").bind(id, ws.id), "task");
  log("task.delete", { ws: shortId(ws.id), task: shortId(id) });
  return new Response(null, { status: 204 });
}
