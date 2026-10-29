import type { Stage } from "../../shared/constants";
import type { Activity, Dashboard, Task } from "../../shared/types";
import type { WsCtx } from "../context";
import { json } from "../http";
import { ACTIVITY_SELECT, TASK_SELECT } from "../select";

const SIX_MONTHS = 186 * 24 * 60 * 60 * 1000;

// Everything the overview shows, in one round trip.
export async function getDashboard({ env, ws, me }: WsCtx) {
  const [counts, stages, closed, tasks, recent] = await Promise.all([
    env.DB.prepare(
      "SELECT (SELECT COUNT(*) FROM contacts WHERE workspace_id = ?1) AS contacts," +
        " (SELECT COUNT(*) FROM companies WHERE workspace_id = ?1) AS companies," +
        " (SELECT COUNT(*) FROM deals WHERE workspace_id = ?1 AND stage NOT IN ('won', 'lost')) AS open_deals",
    )
      .bind(ws.id)
      .first<Dashboard["counts"]>(),
    env.DB.prepare(
      "SELECT stage, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value FROM deals WHERE workspace_id = ?1 GROUP BY stage",
    )
      .bind(ws.id)
      .all<{ stage: Stage; count: number; value: number }>(),
    env.DB.prepare(
      "SELECT stage, value, closed_at FROM deals WHERE workspace_id = ?1 AND stage IN ('won', 'lost') AND closed_at >= ?2",
    )
      .bind(ws.id, Date.now() - SIX_MONTHS)
      .all<Dashboard["closed"][number]>(),
    env.DB.prepare(
      `${TASK_SELECT} WHERE t.workspace_id = ?1 AND t.assignee_id = ?2 AND t.done_at IS NULL` +
        " ORDER BY (t.due_at IS NULL), t.due_at, t.created_at LIMIT 8",
    )
      .bind(ws.id, me.id)
      .all<Task>(),
    env.DB.prepare(`${ACTIVITY_SELECT} WHERE a.workspace_id = ?1 ORDER BY a.created_at DESC LIMIT 10`)
      .bind(ws.id)
      .all<Activity>(),
  ]);
  return json({
    counts: counts!,
    stages: stages.results,
    closed: closed.results,
    my_tasks: tasks.results,
    recent: recent.results,
  } satisfies Dashboard);
}
