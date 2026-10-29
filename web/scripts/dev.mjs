// npm run dev: rebuild app/ on every save while `yard dev` (run from the
// repository root, in another terminal) serves it at
// http://localhost:9875/orbit/app/ with real identity headers and the
// local database. Reload the tab to see a change.
import { context } from "esbuild";
import { build as vite } from "vite";
import { serverBuild } from "./server.mjs";

// Neither watcher empties app/, so the two never delete each other's
// output. `npm run build` starts from a clean app/ before you commit.
await vite({ build: { emptyOutDir: false, watch: {} } });
const server = await context(serverBuild);
await server.watch();
