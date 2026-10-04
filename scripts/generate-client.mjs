#!/usr/bin/env node
/**
 * Generate the TypeScript client for the vault program with Codama.
 *
 *   pnpm idl:build          # anchor idl build -> idl/stablesave_vault.json
 *   pnpm generate:client    # this script -> packages/client/src/generated
 *
 * The generated code targets @solana/kit. See packages/client/README.md.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";
import { createFromRoot } from "codama";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const idlPath = resolve(root, "idl/stablesave_vault.json");
const packageFolder = resolve(root, "packages/client");

const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));

await codama.accept(
  renderVisitor(packageFolder, {
    generatedFolder: "src/generated",
    deleteFolderBeforeRendering: true,
    formatCode: true,
    syncPackageJson: false,
  }),
);

console.log(`Generated client from ${idlPath} into ${resolve(packageFolder, "src/generated")}`);
