import type { Env } from "./env";
import type { Caller } from "./identity";
import type { Access } from "./workspace";

// What every handler receives: the request, the bindings and the caller.
export interface Ctx {
  request: Request;
  env: Env;
  url: URL;
  me: Caller;
}

// Handlers under /api/workspaces/:ws/… also get the caller's access there.
export interface WsCtx extends Ctx {
  ws: Access;
}
