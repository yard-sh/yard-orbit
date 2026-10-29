// Who is asking. Yard Auth signs people in at the edge and hands this
// service trusted X-Yard-* headers; there are no sessions or passwords here.

import { PRO_TIER, TRIAL_DAYS, type Plan } from "../shared/constants";
import type { Me } from "../shared/types";
import type { Env } from "./env";
import { log, shortId } from "./log";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface Caller {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  entitlement: Me["entitlement"];
}

// Pro is the project owner, or a live purchase, subscription or trial of the
// tier keyed PRO_TIER. Anything else, including a signed-in visitor with no
// purchase at all, is Free.
function planOf(headers: Headers): Plan {
  const entitlement = headers.get("X-Yard-Entitlement") || "none";
  if (entitlement === "owner") return "pro";
  if (entitlement !== "active" && entitlement !== "trial") return "free";
  return headers.get("X-Yard-Tier-Key") === PRO_TIER ? "pro" : "free";
}

// A stored snapshot is Pro until pro_until passes. Only trials carry one.
export function effectivePlan(row: { plan: unknown; pro_until: unknown } | null, now = Date.now()): Plan {
  if (!row || row.plan !== "pro") return "free";
  return row.pro_until == null || (row.pro_until as number) > now ? "pro" : "free";
}

interface UserRow {
  name: string;
  email: string;
  plan: string;
  pro_until: number | null;
  seen_at: number;
}

// There is no display-name header, so the first visit derives one from the
// email and the app lets people change it. The plan is re-snapshotted on
// every request, because that snapshot is what a workspace's limits read
// while its owner is away. The row is only rewritten when something changed
// (or every ten minutes, for seen_at), so a busy app isn't a write per
// request.
//
// A trial carries no end date in the headers. The first time one shows up,
// the snapshot assumes the full TRIAL_DAYS; while the edge keeps saying
// "trial", each visit carries it forward a day at a time. A trial that ends
// while its owner stays away therefore runs out on its own.
export async function identify(env: Env, headers: Headers, id: string): Promise<Caller> {
  const email = headers.get("X-Yard-Email") || "";
  const entitlement = (headers.get("X-Yard-Entitlement") || "none") as Caller["entitlement"];
  const plan = planOf(headers);
  const now = Date.now();
  const before = await env.DB.prepare("SELECT name, email, plan, pro_until, seen_at FROM users WHERE id = ?1")
    .bind(id)
    .first<UserRow>();

  let proUntil: number | null = null;
  if (plan === "pro" && entitlement === "trial") {
    if (!before || before.pro_until == null) proUntil = now + TRIAL_DAYS * DAY;
    else proUntil = before.pro_until > now + HOUR ? before.pro_until : now + DAY;
  }

  const name = before ? before.name : defaultName(id, email);
  const stale =
    !before ||
    before.email !== email ||
    before.plan !== plan ||
    before.pro_until !== proUntil ||
    now - before.seen_at > 10 * MINUTE;
  if (stale) {
    await env.DB.prepare(
      "INSERT INTO users (id, name, email, plan, pro_until, seen_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)" +
        " ON CONFLICT(id) DO UPDATE SET email = excluded.email, plan = excluded.plan," +
        " pro_until = excluded.pro_until, seen_at = excluded.seen_at",
    )
      .bind(id, name, email, plan, proUntil, now)
      .run();
    if (before && before.plan !== plan) log("plan.changed", { user: shortId(id), plan });
  }
  return { id, name, email, plan: effectivePlan({ plan, pro_until: proUntil }, now), entitlement };
}

function defaultName(id: string, email: string): string {
  const local = (email.split("@")[0] || "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 40);
  if (!local) return "user-" + shortId(id);
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
