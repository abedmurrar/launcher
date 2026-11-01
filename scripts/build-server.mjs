// Bundle the custom server (server/index.ts + lib/) into one CommonJS file for production.
// Dependencies stay external (resolved from node_modules at runtime). Runs after `next build`.
import { build } from "esbuild";

await build({
  entryPoints: ["server/index.ts"],
  outfile: "dist/server.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  sourcemap: true,
  legalComments: "none",
  logLevel: "info",
});
