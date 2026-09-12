#!/usr/bin/env node
// smoke.mjs — exercise every xknow-mcp tool over a real stdio connection.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0;
let fail = 0;
const note = (ok, msg) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`);
  ok ? pass++ : fail++;
};

function text(result) {
  return (result?.content ?? []).map((c) => c.text ?? "").join("\n");
}

async function run(extraArgs, label, cfg) {
  const { page, concept } = cfg;
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(ROOT, "dist/index.js"), ...extraArgs],
    stderr: "ignore",
  });
  const client = new Client({ name: "xknow-mcp-smoke", version: "1.0.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  const want = ["cite", "explore_concept", "get_page", "list_topics", "search_knowledge"];
  note(
    want.every((w) => names.includes(w)),
    `${label}: tools registered (${names.join(", ")})`
  );

  const search = text(await client.callTool({ name: "search_knowledge", arguments: { query: "keyword difficulty" } }));
  note(/keyword|difficulty/i.test(search), `${label}: search_knowledge returns relevant notes`);

  const pageOut = text(await client.callTool({ name: "get_page", arguments: { slug: page } }));
  note(pageOut.length > 400, `${label}: get_page returns a full note (${pageOut.length} chars)`);

  const explore = text(await client.callTool({ name: "explore_concept", arguments: { concept, depth: 1 } }));
  note(/Links to|Linked from/i.test(explore), `${label}: explore_concept returns graph edges`);

  const topics = text(await client.callTool({ name: "list_topics", arguments: {} }));
  note(/^## \w/m.test(topics), `${label}: list_topics groups by section`);

  const cite = text(await client.callTool({ name: "cite", arguments: { slug: concept } }));
  note(/xknow\.org|vault/i.test(cite), `${label}: cite returns a source`);

  const missing = text(await client.callTool({ name: "get_page", arguments: { slug: "zzz-no-such-note" } }));
  note(/No note found/i.test(missing), `${label}: handles missing note`);

  await client.close();
}

console.log("xknow-mcp smoke test");
await run([], "bundled", { page: "keyword-research", concept: "what-is-an-llm-wiki" });
const vault = process.env.SMOKE_VAULT;
if (vault) {
  await run(["--vault", vault], "vault", { page: "Keyword Difficulty (KD)", concept: "Keyword Difficulty (KD)" });
}
console.log(`  ---- ${pass} passed, ${fail} failed ----`);
process.exit(fail === 0 ? 0 : 1);
