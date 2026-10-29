import type { ApiErrorBody } from "@shared/types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly limit?: ApiErrorBody["limit"];

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.error ?? "Something went wrong");
    this.status = status;
    this.code = body.code ?? "unknown";
    this.limit = body.limit;
  }
}

// Every call is relative ("api/…"): the app is served at /<slug>/app/, and
// at /<slug>/@<sandbox>/app/ in a sandbox, so the same build works in both.
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`api/${path}`, {
    method: init.method ?? "GET",
    headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // A lapsed Yard session answers with a redirect to sign-in, which a
    // fetch can't follow usefully; see it and reload instead.
    redirect: "manual",
  });
  const isJSON = (res.headers.get("Content-Type") ?? "").includes("application/json");
  if (res.type === "opaqueredirect" || res.status === 401 || (!isJSON && res.status !== 204)) {
    throw new ApiError(401, { error: "Your session ended. Signing you back in…", code: "signed_out" });
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// The project root, where Yard serves the landing page and its own
// /__yard/auth endpoints: one level up from /<slug>/app/.
export const LOGOUT_URL = "../__yard/auth/logout?return=/";
export const PRICING_URL = "../#pricing";
