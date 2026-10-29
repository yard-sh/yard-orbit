// npm run build: the React app into app/, then the backend into
// app/_service.js. Both are committed: Create in Yard deploys the
// repository as it is, with no build step, so app/ must be ready to serve.
// Vite empties app/ first, which is why the backend is built second.
import { build as esbuild } from "esbuild";
import { build as vite } from "vite";
import { serverBuild } from "./server.mjs";

await vite();
await esbuild(serverBuild);
