#!/usr/bin/env node
/**
 * Build the API for Vercel with the Build Output API (v3).
 *
 * The workspace packages ship TypeScript source, which Vercel's per-file
 * compiler can't resolve at runtime. Bundling everything into one ESM file
 * avoids that, and the output layout tells Vercel exactly what to run.
 *
 *   .vercel/output/config.json
 *   .vercel/output/functions/index.func/{index.mjs,.vc-config.json}
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(appDir, ".vercel", "output");
const fn = join(output, "functions", "index.func");

await rm(output, { recursive: true, force: true });
await mkdir(fn, { recursive: true });

await build({
  entryPoints: [join(appDir, "src", "vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  // Some bundled CommonJS dependencies call require(); give ESM output one.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "warning",
});

await writeFile(
  join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false }, null, 2),
);

await writeFile(
  join(output, "config.json"),
  JSON.stringify({ version: 3, routes: [{ src: "/(.*)", dest: "/index" }] }, null, 2),
);

console.log(`Built Vercel output in ${output}`);
