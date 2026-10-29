// A small method + pattern router: "/api/contacts/:id" captures id.
// Matching is exact on segment count, so routes never shadow each other.

type Params = Record<string, string>;
type Handler<C> = (ctx: C, params: Params) => Promise<Response>;

interface Route<C> {
  method: string;
  parts: string[];
  handler: Handler<C>;
}

export class Router<C> {
  private routes: Route<C>[] = [];

  on(method: string, pattern: string, handler: Handler<C>): this {
    this.routes.push({ method, parts: pattern.split("/").filter(Boolean), handler });
    return this;
  }

  get = (pattern: string, handler: Handler<C>) => this.on("GET", pattern, handler);
  post = (pattern: string, handler: Handler<C>) => this.on("POST", pattern, handler);
  patch = (pattern: string, handler: Handler<C>) => this.on("PATCH", pattern, handler);
  delete = (pattern: string, handler: Handler<C>) => this.on("DELETE", pattern, handler);

  // The handler for this request, "method" when the path exists under
  // another method (a 405), or null (a 404).
  match(method: string, path: string): { handler: Handler<C>; params: Params } | "method" | null {
    const segments = path.split("/").filter(Boolean);
    let pathMatched = false;
    for (const route of this.routes) {
      const params = matchParts(route.parts, segments);
      if (!params) continue;
      if (route.method === method) return { handler: route.handler, params };
      pathMatched = true;
    }
    return pathMatched ? "method" : null;
  }
}

function matchParts(parts: string[], segments: string[]): Params | null {
  if (parts.length !== segments.length) return null;
  const params: Params = {};
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].startsWith(":")) {
      if (parts[i] !== segments[i]) return null;
      continue;
    }
    try {
      params[parts[i].slice(1)] = decodeURIComponent(segments[i]);
    } catch {
      return null;
    }
  }
  return params;
}
