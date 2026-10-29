import { MAX_LIST } from "../../shared/constants";
import { companySchema } from "../../shared/schemas";
import type { Company, CompanyDetail, Contact, Deal, Task } from "../../shared/types";
import type { WsCtx } from "../context";
import type { Env } from "../env";
import { blanksToNull, json, notFound, parse } from "../http";
import { log, shortId } from "../log";
import { checkRefs } from "../refs";
import { COMPANY_SELECT, CONTACT_SELECT, DEAL_SELECT, TASK_ORDER, TASK_SELECT } from "../select";
import { changed, like, update, Where } from "../sql";
import { detachActivities } from "./activities";

const OPTIONAL_TEXT = ["domain", "industry"] as const;

// "https://acme.com/" and "acme.com" are the same website; store the host.
function bareDomain<T extends { domain?: string | null }>(input: T): T {
  if (!input.domain) return input;
  return { ...input, domain: input.domain.replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "") };
}

export async function listCompanies({ env, ws, url }: WsCtx) {
  const where = new Where().add("co.workspace_id = ?", ws.id);
  const q = url.searchParams.get("q")?.trim();
  if (q) {
    const term = like(q);
    where.add("(co.name LIKE ? ESCAPE '\\' OR co.domain LIKE ? ESCAPE '\\')", term, term);
  }
  const { results } = await env.DB.prepare(
    `${COMPANY_SELECT}${where} ORDER BY co.name COLLATE NOCASE LIMIT ${MAX_LIST}`,
  )
    .bind(...where.binds)
    .all<Company>();
  return json(results);
}

async function loadCompany(env: Env, workspaceId: string, id: string): Promise<CompanyDetail> {
  const company = await env.DB.prepare(`${COMPANY_SELECT} WHERE co.id = ?1 AND co.workspace_id = ?2`)
    .bind(id, workspaceId)
    .first<Company>();
  if (!company) throw notFound("company");
  const [contacts, deals, tasks] = await Promise.all([
    env.DB.prepare(
      `${CONTACT_SELECT} WHERE c.company_id = ?1 AND c.workspace_id = ?2 ORDER BY c.first_name COLLATE NOCASE`,
    )
      .bind(id, workspaceId)
      .all<Contact>(),
    env.DB.prepare(`${DEAL_SELECT} WHERE d.company_id = ?1 AND d.workspace_id = ?2 ORDER BY d.updated_at DESC`)
      .bind(id, workspaceId)
      .all<Deal>(),
    env.DB.prepare(`${TASK_SELECT} WHERE t.company_id = ?1 AND t.workspace_id = ?2${TASK_ORDER}`)
      .bind(id, workspaceId)
      .all<Task>(),
  ]);
  return { company, contacts: contacts.results, deals: deals.results, tasks: tasks.results };
}

export async function getCompany({ env, ws }: WsCtx, { id }: Record<string, string>) {
  return json(await loadCompany(env, ws.id, id));
}

export async function createCompany({ env, ws, request, me }: WsCtx) {
  const input = bareDomain(blanksToNull(await parse(request, companySchema), [...OPTIONAL_TEXT]));
  await checkRefs(env, ws.id, input);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO companies (id, workspace_id, name, domain, industry, size, owner_id, created_at, updated_at)" +
      " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
  )
    .bind(id, ws.id, input.name, input.domain, input.industry, input.size, input.owner_id ?? me.id, Date.now())
    .run();
  log("company.create", { ws: shortId(ws.id), company: shortId(id) });
  return json(await loadCompany(env, ws.id, id), 201);
}

export async function updateCompany({ env, ws, request }: WsCtx, { id }: Record<string, string>) {
  const input = bareDomain(blanksToNull(await parse(request, companySchema.partial()), [...OPTIONAL_TEXT]));
  await checkRefs(env, ws.id, input);
  await changed(update(env.DB, "companies", input, id, ws.id), "company");
  log("company.update", { ws: shortId(ws.id), company: shortId(id), fields: Object.keys(input).length });
  return json(await loadCompany(env, ws.id, id));
}

// Its people, deals and tasks stay, no longer filed under it.
export async function deleteCompany({ env, ws }: WsCtx, { id }: Record<string, string>) {
  await changed(env.DB.prepare("DELETE FROM companies WHERE id = ?1 AND workspace_id = ?2").bind(id, ws.id), "company");
  await env.DB.batch([
    ...["contacts", "deals", "tasks"].map((table) =>
      env.DB.prepare(`UPDATE ${table} SET company_id = NULL WHERE company_id = ?1 AND workspace_id = ?2`).bind(
        id,
        ws.id,
      ),
    ),
    ...detachActivities(env, ws.id, "company_id", id),
  ]);
  log("company.delete", { ws: shortId(ws.id), company: shortId(id) });
  return new Response(null, { status: 204 });
}
