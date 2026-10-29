import type { z } from "zod";
import type { ApiErrorBody } from "../shared/types";

// Thrown anywhere in a handler; the fetch handler turns it into the JSON
// error body the app expects: { error, code }.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Partial<ApiErrorBody> = {},
  ) {
    super(message);
  }
}

export const notFound = (what = "that") => new HttpError(404, "not_found", `${what} not found`);

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function errorResponse(err: HttpError): Response {
  return json({ error: err.message, code: err.code, ...err.extra }, err.status);
}

// The request body checked against a shared schema. The first problem
// becomes the 400's message, prefixed with the field it's about.
export async function parse<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "bad_json", "send a JSON body");
  }
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue.path.join(".");
  throw new HttpError(400, "invalid", field ? `${field}: ${issue.message}` : issue.message);
}

// Optional text arrives as "" from a cleared form field; it's stored as
// NULL. Fields absent from a PATCH stay absent.
export function blanksToNull<T extends object>(input: T, keys: (keyof T)[]): T {
  const out = { ...input };
  for (const key of keys) if (out[key] === "") (out as Record<keyof T, unknown>)[key] = null;
  return out;
}
