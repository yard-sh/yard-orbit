import { isClosed, MAX_LIST, STAGE_KEYS, type Stage } from "../../shared/constants";
import { dealMoveSchema, dealSchema } from "../../shared/schemas";
import type { Deal, DealDetail, Task } from "../../shared/types";
import type { WsCtx } from "../context";
import type { Env, Statement } from "../env";
import { json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { checkRefs } from "../refs";
import { DEAL_SELECT, TASK_ORDER, TASK_SELECT } from "../select";
import { like, update, Where } from "../sql";
import { checkLimit } from "../workspace";
import { detachActivities, insertActivity } from "./activities";

export async function listDeals({ env, ws, url }: WsCtx) {
  const where = new Where().add("d.workspace_id = ?", ws.id);
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const term = like(q);
    where.add("(d.title LIKE ? ESCAPE '\\' OR co.name LIKE ? ESCAPE '\\')", term, term);
  }
  const stage = url.searchParams.get("stage");
  if (stage && (STAGE_KEYS as string[]).includes(stage)) where.add("d.stage = ?", stage);
  const owner = url.searchParams.get("owner_id");
  if (owner) where.add("d.owner_id = ?", owner);

  const { results } = await env.DB.prepare(`${DEAL_SELECT}${where} ORDER BY d.position LIMIT ${MAX_LIST}`)
    .bind(...where.binds)
    .all<Deal>();
  return json(results);
}

async function loadDeal(env: Env, workspaceId: string, id: string): Promise<DealDetail> {
  const deal = await env.DB.prepare(`${DEAL_SELECT} WHERE d.id = ?1 AND d.workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<Deal>();
  if (!deal) throw notFound("deal");
  const { results: tasks } = await env.DB.prepare(
    `${TASK_SELECT} WHERE t.deal_id = ?1 AND t.workspace_id = ?2${TASK_ORDER}`,
  )
    .bind(id, workspaceId)
    .all<Task>();
  return { deal, tasks };
}

export async function getDeal({ env, ws }: WsCtx, { id }: Record<string, string>) {
  return json(await loadDeal(env, ws.id, id));
}

// New deals go to the bottom of their stage's column.
export async function createDeal({ env, ws, me, request }: WsCtx) {
  const input = await parse(request, dealSchema);
  await Promise.all([isClosed(input.stage) ? null : checkLimit(env, ws, "open_deals"), checkRefs(env, ws.id, input)]);
  const bottom = await env.DB.prepare(
    "SELECT COALESCE(MAX(position), 0) AS p FROM deals WHERE workspace_id = ?1 AND stage = ?2",
  )
    .bind(ws.id, input.stage)
    .first<{ p: number }>();
  const id = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO deals (id, workspace_id, title, value, stage, position, company_id, contact_id, owner_id, expected_close_at, closed_at, created_at, updated_at)" +
        " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
    ).bind(
      id,
      ws.id,
      input.title,
      input.value,
      input.stage,
      (bottom?.p ?? 0) + 1,
      input.company_id,
      input.contact_id,
      input.owner_id ?? me.id,
      input.expected_close_at,
      isClosed(input.stage) ? now : null,
      now,
    ),
    insertActivity(env, ws.id, {
      kind: "created",
      author_id: me.id,
      deal_id: id,
      contact_id: input.contact_id,
      company_id: input.company_id,
    }),
  ]);
  log("deal.create", { ws: shortId(ws.id), deal: shortId(id), stage: input.stage });
  return json(await loadDeal(env, ws.id, id), 201);
}

export async function updateDeal({ env, ws, me, request }: WsCtx, { id }: Record<string, string>) {
  const input = await parse(request, dealSchema.partial());
  const before = await currentDeal(env, ws.id, id);
  await checkRefs(env, ws.id, input);
  const { stage, ...rest } = input;
  const statements = [update(env.DB, "deals", rest, id, ws.id)];
  if (stage && stage !== before.stage) statements.push(...(await stageChange(env, ws, me.id, before, stage)));
  await env.DB.batch(statements);
  log("deal.update", { ws: shortId(ws.id), deal: shortId(id), fields: Object.keys(input).length });
  return json(await loadDeal(env, ws.id, id));
}

// A drag on the board: a stage and the midpoint of the card's new
// neighbours, so a move rewrites one row.
export async function moveDeal({ env, ws, me, request }: WsCtx, { id }: Record<string, string>) {
  const { stage, position } = await parse(request, dealMoveSchema);
  const before = await currentDeal(env, ws.id, id);
  const statements = [update(env.DB, "deals", { position }, id, ws.id)];
  if (stage !== before.stage) statements.push(...(await stageChange(env, ws, me.id, before, stage)));
  await env.DB.batch(statements);
  log("deal.move", { ws: shortId(ws.id), deal: shortId(id), from: before.stage, to: stage });
  return json((await loadDeal(env, ws.id, id)).deal);
}

// Tasks stay, unlinked; the deal's own timeline entries go.
export async function deleteDeal({ env, ws }: WsCtx, { id }: Record<string, string>) {
  await currentDeal(env, ws.id, id);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM deals WHERE id = ?1 AND workspace_id = ?2").bind(id, ws.id),
    env.DB.prepare("UPDATE tasks SET deal_id = NULL WHERE deal_id = ?1 AND workspace_id = ?2").bind(id, ws.id),
    env.DB.prepare(
      "DELETE FROM activities WHERE deal_id = ?1 AND workspace_id = ?2 AND kind IN ('created', 'stage_change')",
    ).bind(id, ws.id),
    ...detachActivities(env, ws.id, "deal_id", id),
  ]);
  log("deal.delete", { ws: shortId(ws.id), deal: shortId(id) });
  return new Response(null, { status: 204 });
}

interface DealRow {
  id: string;
  stage: Stage;
  contact_id: string | null;
  company_id: string | null;
}

async function currentDeal(env: Env, workspaceId: string, id: string): Promise<DealRow> {
  const row = await env.DB.prepare(
    "SELECT id, stage, contact_id, company_id FROM deals WHERE id = ?1 AND workspace_id = ?2",
  )
    .bind(id, workspaceId)
    .first<DealRow>();
  if (!row) throw notFound("deal");
  return row;
}

// Entering won or lost stamps closed_at; reopening clears it and counts
// against the open-deal limit again. Every change lands on the timeline as
// "from:to".
async function stageChange(env: Env, ws: WsCtx["ws"], userId: string, deal: DealRow, to: Stage): Promise<Statement[]> {
  const reopening = isClosed(deal.stage) && !isClosed(to);
  if (reopening) await checkLimit(env, ws, "open_deals");
  const closedAt = isClosed(to) ? (isClosed(deal.stage) ? undefined : Date.now()) : null;
  return [
    ...(closedAt === undefined ? [] : [update(env.DB, "deals", { closed_at: closedAt }, deal.id, ws.id)]),
    env.DB.prepare("UPDATE deals SET stage = ?1 WHERE id = ?2 AND workspace_id = ?3").bind(to, deal.id, ws.id),
    insertActivity(env, ws.id, {
      kind: "stage_change",
      body: `${deal.stage}:${to}`,
      author_id: userId,
      deal_id: deal.id,
      contact_id: deal.contact_id,
      company_id: deal.company_id,
    }),
  ];
}
