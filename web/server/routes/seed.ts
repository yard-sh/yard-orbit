// "Load sample data" on an empty workspace: a believable book of business
// so the pipeline, dashboard and timelines have something to show. Dates are
// relative to now, so the charts always cover the last six months.

import type { CompanySize, ContactStatus, LoggedKind, Stage } from "../../shared/constants";
import type { WsCtx } from "../context";
import type { Statement } from "../env";
import { HttpError, json } from "../http";
import { log, shortId } from "../log";
import { checkLimit } from "../workspace";
import { insertActivity } from "./activities";

const DAY = 24 * 60 * 60 * 1000;

const COMPANIES: [name: string, domain: string, industry: string, size: CompanySize][] = [
  ["Northwind Traders", "northwind.example", "Wholesale", "201-1000"],
  ["Lumen Health", "lumenhealth.example", "Healthcare", "51-200"],
  ["Brightline Logistics", "brightline.example", "Logistics", "1000+"],
  ["Fable & Fern", "fableandfern.example", "Retail", "11-50"],
  ["Copperleaf Energy", "copperleaf.example", "Energy", "201-1000"],
  ["Quill Analytics", "quill.example", "Software", "51-200"],
  ["Harbor Labs", "harborlabs.example", "Biotech", "11-50"],
  ["Summit Outfitters", "summit.example", "Retail", "51-200"],
];

// [first, last, title, company index, status]
const CONTACTS: [string, string, string, number, ContactStatus][] = [
  ["Avery", "Chen", "VP Operations", 0, "customer"],
  ["Jordan", "Patel", "Procurement Lead", 0, "active"],
  ["Maya", "Okafor", "Chief Medical Officer", 1, "active"],
  ["Sam", "Rivera", "IT Director", 1, "lead"],
  ["Riley", "Nakamura", "Head of Fleet", 2, "customer"],
  ["Casey", "Morgan", "CFO", 2, "active"],
  ["Elena", "Petrova", "Founder", 3, "customer"],
  ["Noah", "Fischer", "Store Manager", 3, "churned"],
  ["Priya", "Raman", "Sustainability Lead", 4, "active"],
  ["Diego", "Alvarez", "COO", 4, "lead"],
  ["Hannah", "Brooks", "Head of Data", 5, "customer"],
  ["Theo", "Laurent", "Engineering Manager", 5, "active"],
  ["Imani", "Clarke", "Research Director", 6, "lead"],
  ["Lucas", "Weber", "Lab Operations", 6, "lead"],
  ["Grace", "Kim", "Merchandising Director", 7, "active"],
  ["Owen", "Hughes", "E-commerce Lead", 7, "lead"],
];

// [title, value, stage, contact index, days ago closed (closed stages) or days until expected close]
const DEALS: [string, number, Stage, number, number][] = [
  ["Northwind annual renewal", 48000, "won", 0, 160],
  ["Brightline fleet rollout", 125000, "won", 4, 120],
  ["Fable & Fern starter plan", 6000, "won", 6, 95],
  ["Quill data platform", 72000, "won", 10, 60],
  ["Northwind regional expansion", 36000, "won", 1, 28],
  ["Summit loyalty program", 18000, "lost", 15, 75],
  ["Fable & Fern second store", 9000, "lost", 7, 40],
  ["Brightline analytics add-on", 30000, "won", 5, 9],
  ["Lumen clinic pilot", 24000, "negotiation", 2, 12],
  ["Copperleaf grid monitoring", 96000, "proposal", 8, 30],
  ["Quill team expansion", 28000, "proposal", 11, 21],
  ["Harbor Labs LIMS integration", 42000, "qualified", 12, 45],
  ["Summit holiday campaign", 15000, "qualified", 14, 35],
  ["Copperleaf field ops", 54000, "lead", 9, 60],
  ["Lumen IT modernization", 38000, "lead", 3, 75],
  ["Harbor Labs data warehouse", 22000, "lead", 13, 90],
];

// [contact index, kind, body, days ago]
const ACTIVITIES: [number, LoggedKind, string, number][] = [
  [2, "meeting", "Walked the clinical team through the pilot scope. They want SSO before rollout.", 3],
  [8, "call", "Priya confirmed budget is approved for Q1; proposal needs a sustainability section.", 2],
  [11, "email", "Sent revised pricing for 25 additional seats.", 1],
  [12, "note", "Imani is evaluating two other vendors. Decision expected after their board meeting.", 6],
  [0, "call", "Quarterly check-in. Avery is happy, asked about the regional expansion timeline.", 30],
  [14, "meeting", "Kickoff for the holiday campaign. Creative brief due next week.", 4],
  [9, "note", "Diego came in through the webinar. Interested in field ops tooling.", 8],
  [5, "email", "Shared the analytics add-on ROI summary with Casey.", 12],
];

// [title, contact index, days from now (negative is overdue)]
const TASKS: [string, number, number][] = [
  ["Send SSO security questionnaire to Lumen", 2, 1],
  ["Draft Copperleaf proposal", 8, 3],
  ["Follow up on Quill seat pricing", 11, -1],
  ["Book demo with Harbor Labs research team", 12, 5],
  ["Prep Summit campaign brief review", 14, 0],
  ["Check in with Diego after webinar", 9, 7],
  ["Ask Avery for a case-study quote", 0, 14],
];

export async function seedWorkspace({ env, ws, me }: WsCtx) {
  const existing = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM contacts WHERE workspace_id = ?1) + (SELECT COUNT(*) FROM companies WHERE workspace_id = ?1)" +
      " + (SELECT COUNT(*) FROM deals WHERE workspace_id = ?1) AS n",
  )
    .bind(ws.id)
    .first<{ n: number }>();
  if (existing!.n > 0) throw new HttpError(409, "not_empty", "sample data only loads into an empty workspace");
  const openDeals = DEALS.filter(([, , stage]) => stage !== "won" && stage !== "lost").length;
  await Promise.all([checkLimit(env, ws, "contacts", CONTACTS.length), checkLimit(env, ws, "open_deals", openDeals)]);

  const now = Date.now();
  const db = env.DB;
  const statements: Statement[] = [];
  const companyIds = COMPANIES.map(() => crypto.randomUUID());
  const contactIds = CONTACTS.map(() => crypto.randomUUID());
  const companyOf = (contact: number) => companyIds[CONTACTS[contact][3]];

  COMPANIES.forEach(([name, domain, industry, size], i) => {
    const at = now - (200 - i * 5) * DAY;
    statements.push(
      db
        .prepare(
          "INSERT INTO companies (id, workspace_id, name, domain, industry, size, owner_id, created_at, updated_at)" +
            " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        )
        .bind(companyIds[i], ws.id, name, domain, industry, size, me.id, at),
    );
  });

  CONTACTS.forEach(([first, last, title, company, status], i) => {
    const at = now - (190 - i * 6) * DAY;
    const email = `${first}.${last}@${COMPANIES[company][1]}`.toLowerCase();
    statements.push(
      db
        .prepare(
          "INSERT INTO contacts (id, workspace_id, company_id, first_name, last_name, email, phone, title, status, owner_id, created_at, updated_at)" +
            " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
        )
        .bind(
          contactIds[i],
          ws.id,
          companyIds[company],
          first,
          last,
          email,
          `+1 555 01${String(i).padStart(2, "0")}`,
          title,
          status,
          me.id,
          at,
        ),
    );
  });

  DEALS.forEach(([title, value, stage, contact, days], i) => {
    const closed = stage === "won" || stage === "lost";
    const closedAt = closed ? now - days * DAY : null;
    const createdAt = (closedAt ?? now) - (30 + (i % 4) * 12) * DAY;
    const id = crypto.randomUUID();
    statements.push(
      db
        .prepare(
          "INSERT INTO deals (id, workspace_id, title, value, stage, position, company_id, contact_id, owner_id, expected_close_at, closed_at, created_at, updated_at)" +
            " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
        )
        .bind(
          id,
          ws.id,
          title,
          value,
          stage,
          i + 1,
          companyOf(contact),
          contactIds[contact],
          me.id,
          closed ? closedAt : now + days * DAY,
          closedAt,
          createdAt,
        ),
      insertActivity(env, ws.id, {
        kind: "created",
        author_id: me.id,
        deal_id: id,
        contact_id: contactIds[contact],
        company_id: companyOf(contact),
        created_at: createdAt,
      }),
    );
  });

  ACTIVITIES.forEach(([contact, kind, body, days]) => {
    statements.push(
      insertActivity(env, ws.id, {
        kind,
        body,
        author_id: me.id,
        contact_id: contactIds[contact],
        company_id: companyOf(contact),
        deal_id: null,
        created_at: now - days * DAY - 3_600_000,
      }),
    );
  });

  TASKS.forEach(([title, contact, days]) => {
    statements.push(
      db
        .prepare(
          "INSERT INTO tasks (id, workspace_id, title, due_at, assignee_id, contact_id, company_id, created_by, created_at)" +
            " VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?5, ?8)",
        )
        .bind(
          crypto.randomUUID(),
          ws.id,
          title,
          endOfDay(now + days * DAY),
          me.id,
          contactIds[contact],
          companyOf(contact),
          now,
        ),
    );
  });

  await db.batch(statements);
  log("workspace.seed", { ws: shortId(ws.id), rows: statements.length });
  return json({ ok: true }, 201);
}

// Due dates are "by the end of that day" in UTC; the app shows the date.
function endOfDay(ms: number): number {
  return Math.floor(ms / DAY) * DAY + DAY - 1;
}
