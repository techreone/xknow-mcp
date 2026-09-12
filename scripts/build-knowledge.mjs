#!/usr/bin/env node
// build-knowledge.mjs — fetch the static XKnow knowledge snapshot into data/.
//
// Source, in order:
//   1. --from <FILE|URL>
//   2. $XKNOW_KNOWLEDGE
//   3. https://xknow.org/mcp/knowledge.json   (static asset, no server)
//   4. ../XKnow/public/mcp/knowledge.json      (local dev)
//
// Output: data/knowledge.json
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = resolve(ROOT, "data/knowledge.json");
const REMOTE = "https://xknow.org/mcp/knowledge.json";
const LOCAL = resolve(ROOT, "..", "XKnow", "public", "mcp", "knowledge.json");

function argFrom() {
  const i = process.argv.indexOf("--from");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith("--from="));
  if (eq) return eq.slice("--from=".length);
  return process.env.XKNOW_KNOWLEDGE;
}

async function load(source) {
  if (source && /^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
    return await res.text();
  }
  if (source && existsSync(source)) return readFileSync(source, "utf-8");
  throw new Error(`source not found: ${source}`);
}

async function main() {
  const explicit = argFrom();
  const candidates = [
    explicit,
    REMOTE,
    existsSync(LOCAL) ? LOCAL : undefined,
  ].filter(Boolean);

  let text = null;
  let used = null;
  for (const c of candidates) {
    try {
      text = await load(c);
      used = c;
      break;
    } catch (err) {
      console.error(`xknow-mcp: source failed (${c}): ${err.message}`);
    }
  }
  if (!text) throw new Error("no usable knowledge source");

  const data = JSON.parse(text);
  if (!data.docs || !Array.isArray(data.docs) || data.docs.length === 0) {
    throw new Error("knowledge snapshot has no docs");
  }
  mkdirSync(resolve(ROOT, "data"), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`OK ${data.docs.length} docs from ${used} -> data/knowledge.json`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
