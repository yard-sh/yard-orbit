// The bindings Yard gives _service.js, typed to what Orbit uses.
// env.DB is Yard DB (SQLite-compatible SQL, prepared statements);
// env.ASSETS serves this bundle's static files.

export type Row = Record<string, unknown>;

export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}

export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}

export interface Env {
  DB: Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}
