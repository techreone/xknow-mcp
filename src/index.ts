#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { existsSync } from "node:fs";
import { Doc, KnowledgeBase, loadBundled, loadVault } from "./core/knowledge.js";
import { findDoc, search } from "./core/search.js";
import { Graph } from "./core/graph.js";

const VERSION = "1.0.0";

function parseVaultArg(argv: string[]): string | undefined {
  const env = process.env.XKNOW_VAULT;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--vault" && argv[i + 1]) return argv[i + 1];
    if (argv[i].startsWith("--vault=")) return argv[i].slice("--vault=".length);
  }
  return env;
}

function load(): KnowledgeBase {
  const vault = parseVaultArg(process.argv.slice(2));
  if (vault) {
    if (!existsSync(vault)) {
      console.error(`xknow-mcp: vault not found: ${vault}`);
      process.exit(3);
    }
    return loadVault(vault);
  }
  try {
    return loadBundled();
  } catch (err) {
    console.error(
      "xknow-mcp: bundled knowledge not found. Run `npm run build:data`, or pass --vault <dir>."
    );
    throw err;
  }
}

const kb = load();
const graph = new Graph(kb);
const hasUrls = kb.docs.some((d) => d.url);

const server = new McpServer({ name: "xknow-mcp", version: VERSION });

function ref(doc: Doc): string {
  return doc.url ? `${doc.title} — ${doc.url}` : doc.title;
}

server.registerTool(
  "search_knowledge",
  {
    title: "Search the XKnow knowledge base",
    description:
      "Search curated, source-backed SEO, SaaS, and LLM-wiki knowledge. Returns ranked notes with a snippet and URL. Use this to ground answers about search-engine optimization, SaaS business models, or AI knowledge bases.",
    inputSchema: {
      query: z.string().describe("Natural-language query, e.g. 'keyword difficulty' or 'saas pricing models'"),
      limit: z.number().int().min(1).max(20).optional().describe("Max results (default 8)"),
      section: z.enum(["seo", "saas", "blog"]).optional().describe("Restrict to one section"),
    },
  },
  async ({ query, limit, section }) => {
    const hits = search(kb, query, limit ?? 8, section);
    if (!hits.length) {
      return { content: [{ type: "text", text: `No notes matched "${query}".` }] };
    }
    const lines = hits.map(
      (h, i) =>
        `${i + 1}. ${ref(h.doc)}\n   ${h.snippet}`
    );
    return {
      content: [
        {
          type: "text",
          text: `Top ${hits.length} notes for "${query}" (${kb.docs.length} notes indexed):\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

server.registerTool(
  "get_page",
  {
    title: "Get a knowledge-base note",
    description:
      "Fetch the full text of one note by title or slug. Use after search_knowledge to read the note before answering. Preserves [[wikilinks]].",
    inputSchema: {
      slug: z.string().describe("Exact title or slug, e.g. 'keyword-research' or 'Keyword Research'"),
    },
  },
  async ({ slug }) => {
    const doc = findDoc(kb, slug);
    if (!doc) return { content: [{ type: "text", text: `No note found for "${slug}".` }] };
    const header = doc.url ? `# ${doc.title}\nSource: ${doc.url}\n\n` : `# ${doc.title}\n\n`;
    return { content: [{ type: "text", text: header + doc.body.slice(0, 16000) }] };
  }
);

server.registerTool(
  "explore_concept",
  {
    title: "Explore a concept and its graph",
    description:
      "Return a note together with the notes it links to (outbound) and the notes that link back to it (inbound). Use to walk the knowledge graph around a concept instead of a flat search.",
    inputSchema: {
      concept: z.string().describe("A concept title or slug, e.g. 'Retrieval-Augmented Generation'"),
      depth: z.number().int().min(1).max(2).optional().describe("1 = direct neighbours (default), 2 = two hops"),
    },
  },
  async ({ concept, depth }) => {
    const doc = findDoc(kb, concept);
    if (!doc) return { content: [{ type: "text", text: `No note found for "${concept}".` }] };
    const res = graph.explore(doc);
    const fmt = (docs: Doc[]) =>
      docs.length ? docs.map((d) => `- ${ref(d)}`).join("\n") : "- (none)";
    let text =
      `# ${doc.title}\n` +
      (doc.url ? `Source: ${doc.url}\n` : "") +
      (doc.description ? `\n${doc.description}\n` : "") +
      `\n## Links to\n${fmt(res.outbound)}\n\n## Linked from\n${fmt(res.inbound)}`;
    if ((depth ?? 1) >= 2) {
      const second: string[] = [];
      for (const n of res.outbound) {
        const nn = graph.outbound(n);
        if (nn.length) second.push(`- ${n.title} → ${nn.map((x) => x.title).join(", ")}`);
      }
      if (second.length) text += `\n\n## Two hops out\n${second.join("\n")}`;
    }
    return { content: [{ type: "text", text }] };
  }
);

server.registerTool(
  "list_topics",
  {
    title: "List knowledge-base topics",
    description: "List the available notes, grouped by section (seo, saas, blog). Use to discover what the knowledge base covers.",
    inputSchema: {
      section: z.enum(["seo", "saas", "blog"]).optional().describe("Restrict to one section"),
    },
  },
  async ({ section }) => {
    const groups = new Map<string, Doc[]>();
    for (const d of kb.docs) {
      if (section && d.section !== section) continue;
      if (!groups.has(d.section)) groups.set(d.section, []);
      groups.get(d.section)!.push(d);
    }
    const parts: string[] = [];
    for (const [sec, docs] of [...groups.entries()].sort()) {
      const items = docs
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((d) => `- ${d.title}${d.url ? ` (${d.url})` : ""}`)
        .join("\n");
      parts.push(`## ${sec} (${docs.length})\n${items}`);
    }
    return { content: [{ type: "text", text: parts.join("\n\n") || "No topics." }] };
  }
);

server.registerTool(
  "cite",
  {
    title: "Get a citation for a note",
    description:
      "Return the canonical citation (title, description, URL) for a note, so an answer can attribute the XKnow source.",
    inputSchema: {
      slug: z.string().describe("Exact title or slug to cite"),
    },
  },
  async ({ slug }) => {
    const doc = findDoc(kb, slug);
    if (!doc) return { content: [{ type: "text", text: `No note found for "${slug}".` }] };
    const text = doc.url
      ? `${doc.title}\n${doc.description ?? ""}\nSource: ${doc.url}`
      : `${doc.title}\n${doc.description ?? ""}\nSource: local vault note`;
    return { content: [{ type: "text", text }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `xknow-mcp ${VERSION} — ${kb.docs.length} notes (${kb.source})${hasUrls ? "" : " [vault mode]"}`
  );
}

main().catch((err) => {
  console.error("xknow-mcp fatal:", err);
  process.exit(1);
});
