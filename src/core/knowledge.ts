import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export interface Doc {
  title: string;
  slug: string;
  section: string;
  url?: string;
  description?: string;
  keyword?: string;
  type?: string;
  body: string;
  links: string[];
  related?: string[];
  words: number;
}

export interface KnowledgeBase {
  name: string;
  generatedAt: string;
  source: string;
  docs: Doc[];
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugOf(title: string): string {
  return normalize(title).replace(/\s+/g, "-");
}

export function extractLinks(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of body.matchAll(/\[\[([^\]|#]+)/g)) {
    const t = m[1].trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

export function countWords(body: string): number {
  return body
    .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1")
    .replace(/[#>*_`\[\]]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

export function loadBundled(): KnowledgeBase {
  const url = new URL("../../data/knowledge.json", import.meta.url);
  const raw = readFileSync(url, "utf-8");
  return JSON.parse(raw) as KnowledgeBase;
}

/* ---------------- vault mode (buyer's purchased copy) ---------------- */

function parseFrontmatter(raw: string): { fm: string; body: string } {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(raw);
  if (!m) return { fm: "", body: raw };
  return { fm: m[1], body: raw.slice(m[0].length) };
}

function fmScalar(fm: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(fm);
  if (!m) return undefined;
  return m[1].trim().replace(/^"|"$/g, "") || undefined;
}

function fmList(fm: string, key: string): string[] {
  const block = new RegExp(`^${key}:\\s*\\n((?:\\s+-[^\\n]*\\n)+)`, "m").exec(fm);
  if (block) {
    return [...block[1].matchAll(/-\s+(.+)/g)].map((m) => m[1].trim().replace(/^"|"$/g, ""));
  }
  const inline = new RegExp(`^${key}:\\s*\\[(.*?)\\]\\s*$`, "m").exec(fm);
  if (inline) return inline[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
  return [];
}

const VAULT_FOLDERS = ["Concepts", "Entities", "Articles", "Industry"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Load a purchased vault folder (markdown notes) as the knowledge base. */
export function loadVault(root: string): KnowledgeBase {
  const docs: Doc[] = [];
  for (const folder of VAULT_FOLDERS) {
    const dir = join(root, folder);
    let files: string[] = [];
    try {
      files = walk(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      const raw = readFileSync(f, "utf-8");
      const { fm, body } = parseFrontmatter(raw);
      const title = fmScalar(fm, "title") ?? f.split("/").pop()!.replace(/\.md$/, "");
      const aliases = fmList(fm, "aliases");
      const rel = f.slice(root.length + 1).replace(/\\/g, "/");
      docs.push({
        title,
        slug: slugOf(title),
        section: folder.toLowerCase(),
        description: [aliases.length ? aliases.join(", ") : "", fmScalar(fm, "type")]
          .filter(Boolean)
          .join(" — "),
        keyword: undefined,
        type: fmScalar(fm, "type"),
        body,
        links: extractLinks(body),
        words: countWords(body),
      });
      void rel;
    }
  }
  return {
    name: "XKnow Knowledge Base (vault)",
    generatedAt: new Date().toISOString().slice(0, 10),
    source: root,
    docs,
  };
}
