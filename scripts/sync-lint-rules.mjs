#!/usr/bin/env node
/**
 * Keep data/lint-rules.json in sync with the XKnow repo's lint rubric.
 * Source of truth: <XKnow>/lint.config.json -> <XKnow>/public/mcp/lint-rules.json
 *
 * Resolution order:
 *   1. XKNOW_LINT_RULES env var (explicit path)
 *   2. ../XKnow/public/mcp/lint-rules.json (sibling checkout)
 *   3. keep the existing data/lint-rules.json (offline / published package)
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "../data/lint-rules.json");
const candidates = [
  process.env.XKNOW_LINT_RULES,
  resolve(here, "../../XKnow/public/mcp/lint-rules.json"),
].filter(Boolean);

const src = candidates.find((p) => p && existsSync(p));
if (!src) {
  if (existsSync(dest)) {
    console.log("sync-lint-rules: no source found, keeping existing data/lint-rules.json");
    process.exit(0);
  }
  console.error("sync-lint-rules: no source and no existing data/lint-rules.json");
  process.exit(1);
}
copyFileSync(src, dest);
console.log(`sync-lint-rules: ${src} -> data/lint-rules.json`);
