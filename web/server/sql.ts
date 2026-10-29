// Small helpers for the dynamic parts of queries: list filters and partial
// updates. Static queries are written out in full where they're used.

import type { Database, Statement } from "./env";
import { HttpError, notFound } from "./http";

// Collects WHERE clauses with numbered placeholders. Each "?" in a clause
// takes the next value.
export class Where {
  private clauses: string[] = [];
  readonly binds: unknown[] = [];

  add(clause: string, ...values: unknown[]): this {
    this.clauses.push(clause.replace(/\?/g, () => `?${this.binds.push(values.shift())}`));
    return this;
  }

  toString(): string {
    return this.clauses.length ? " WHERE " + this.clauses.join(" AND ") : "";
  }
}

// A search term for LIKE, with its wildcards escaped. Pair with ESCAPE '\'.
export function like(term: string): string {
  return "%" + term.replace(/[\\%_]/g, (c) => "\\" + c) + "%";
}

// "UPDATE table SET a = ?1, b = ?2, updated_at = ?3 WHERE id = ?4 AND
// workspace_id = ?5" for the fields present in a PATCH body.
export function update(
  db: Database,
  table: string,
  fields: Record<string, unknown>,
  id: string,
  workspaceId: string,
  touch = true,
): Statement {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (touch) entries.push(["updated_at", Date.now()]);
  if (!entries.length) throw new HttpError(400, "invalid", "nothing to change");
  const sets = entries.map(([key], i) => `${key} = ?${i + 1}`).join(", ");
  const n = entries.length;
  return db
    .prepare(`UPDATE ${table} SET ${sets} WHERE id = ?${n + 1} AND workspace_id = ?${n + 2}`)
    .bind(...entries.map(([, v]) => v), id, workspaceId);
}

export async function changed(statement: Statement, what: string) {
  const { meta } = await statement.run();
  if (meta.changes === 0) throw notFound(what);
}

export function limitParam(url: URL, fallback: number, max: number): number {
  const n = Number(url.searchParams.get("limit"));
  return Number.isInteger(n) && n > 0 ? Math.min(n, max) : fallback;
}
