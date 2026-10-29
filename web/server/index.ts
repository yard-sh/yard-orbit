// Orbit backend.
//
// No ports, no listen(): Yard runs this as a fetch handler. Requests arrive
// with the app path rooted at "/" and, for signed-in visitors, trusted
// identity headers the edge verified:
//   X-Yard-User-Id, X-Yard-Email, X-Yard-Entitlement, X-Yard-Tier,
//   X-Yard-Tier-Key, X-Yard-Sandbox
// Clients can never spoof these: the edge strips inbound X-Yard-* first, and
// `yard dev` stamps the same headers locally from the persona you pick.
//
// The service is "authenticated" in .yard/settings.json, so the edge signs
// people in before they get here; the 401 below is a backstop. /api/* is
// the JSON API the React app calls. Everything else is the app itself,
// served from this directory by env.ASSETS.
//
// This file is the source; app/_service.js is built from it by
// `npm run build` in web/.

import type { Ctx, WsCtx } from "./context";
import type { Env } from "./env";
import { errorResponse, HttpError, json } from "./http";
import { identify } from "./identity";
import { log, redactPath, shortId } from "./log";
import { Router } from "./router";
import { createActivity, deleteActivity, listActivities } from "./routes/activities";
import { createCompany, deleteCompany, getCompany, listCompanies, updateCompany } from "./routes/companies";
import { createContact, deleteContact, getContact, listContacts, updateContact } from "./routes/contacts";
import { getDashboard } from "./routes/dashboard";
import { createDeal, deleteDeal, getDeal, listDeals, moveDeal, updateDeal } from "./routes/deals";
import { acceptInvite, previewInvite } from "./routes/invites";
import { getMe, updateMe } from "./routes/me";
import { seedWorkspace } from "./routes/seed";
import { createTask, deleteTask, listTasks, updateTask } from "./routes/tasks";
import { getWorkspace, listMembers, removeMember, renameWorkspace, resetInvite, setRole } from "./routes/workspaces";
import { workspaceAccess } from "./workspace";

type WsHandler = (ctx: WsCtx, params: Record<string, string>) => Promise<Response>;

// Resolves :ws to the caller's access there (404 if they aren't a member)
// before the handler runs.
const inWorkspace =
  (handler: WsHandler) =>
  async (ctx: Ctx, params: Record<string, string>): Promise<Response> =>
    handler({ ...ctx, ws: await workspaceAccess(ctx.env, ctx.me, params.ws) }, params);

const W = "/api/workspaces/:ws";

const router = new Router<Ctx>()
  .get("/api/me", getMe)
  .patch("/api/me", updateMe)
  .get("/api/invites/:token", previewInvite)
  .post("/api/invites/:token/accept", acceptInvite)

  .get(W, inWorkspace(getWorkspace))
  .patch(W, inWorkspace(renameWorkspace))
  .post(`${W}/invite/reset`, inWorkspace(resetInvite))
  .get(`${W}/members`, inWorkspace(listMembers))
  .patch(`${W}/members/:uid`, inWorkspace(setRole))
  .delete(`${W}/members/:uid`, inWorkspace(removeMember))
  .post(`${W}/seed`, inWorkspace(seedWorkspace))
  .get(`${W}/dashboard`, inWorkspace(getDashboard))

  .get(`${W}/companies`, inWorkspace(listCompanies))
  .post(`${W}/companies`, inWorkspace(createCompany))
  .get(`${W}/companies/:id`, inWorkspace(getCompany))
  .patch(`${W}/companies/:id`, inWorkspace(updateCompany))
  .delete(`${W}/companies/:id`, inWorkspace(deleteCompany))

  .get(`${W}/contacts`, inWorkspace(listContacts))
  .post(`${W}/contacts`, inWorkspace(createContact))
  .get(`${W}/contacts/:id`, inWorkspace(getContact))
  .patch(`${W}/contacts/:id`, inWorkspace(updateContact))
  .delete(`${W}/contacts/:id`, inWorkspace(deleteContact))

  .get(`${W}/deals`, inWorkspace(listDeals))
  .post(`${W}/deals`, inWorkspace(createDeal))
  .get(`${W}/deals/:id`, inWorkspace(getDeal))
  .patch(`${W}/deals/:id`, inWorkspace(updateDeal))
  .post(`${W}/deals/:id/move`, inWorkspace(moveDeal))
  .delete(`${W}/deals/:id`, inWorkspace(deleteDeal))

  .get(`${W}/tasks`, inWorkspace(listTasks))
  .post(`${W}/tasks`, inWorkspace(createTask))
  .patch(`${W}/tasks/:id`, inWorkspace(updateTask))
  .delete(`${W}/tasks/:id`, inWorkspace(deleteTask))

  .get(`${W}/activities`, inWorkspace(listActivities))
  .post(`${W}/activities`, inWorkspace(createActivity))
  .delete(`${W}/activities/:id`, inWorkspace(deleteActivity));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    // Never serve the backend as an asset. Yard excludes it server-side;
    // this guard keeps any other host honest.
    if (url.pathname === "/_service.js") return new Response("Not found", { status: 404 });
    // Everything but the API is the static app (env.ASSETS is this
    // directory, falling back to index.html).
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    const started = Date.now();
    const userId = request.headers.get("X-Yard-User-Id");
    let response: Response;
    try {
      response = userId ? await handleAPI(request, env, url, userId) : signedOut();
    } catch (err) {
      if (err instanceof HttpError) response = errorResponse(err);
      else {
        console.error(
          `[orbit] request.failed ${request.method} ${redactPath(url.pathname)}`,
          err instanceof Error ? err.stack : err,
        );
        response = json({ error: "something went wrong on our end", code: "internal" }, 500);
      }
    }
    log("request", {
      method: request.method,
      path: redactPath(url.pathname),
      status: response.status,
      user: shortId(userId),
      ms: Date.now() - started,
    });
    return response;
  },
};

async function handleAPI(request: Request, env: Env, url: URL, userId: string): Promise<Response> {
  const route = router.match(request.method, url.pathname);
  if (route === null) throw new HttpError(404, "not_found", "no such endpoint");
  if (route === "method") throw new HttpError(405, "method_not_allowed", "method not allowed");
  const me = await identify(env, request.headers, userId);
  return route.handler({ request, env, url, me }, route.params);
}

function signedOut(): Response {
  return json({ error: "sign in to use Orbit", code: "signed_out" }, 401);
}
