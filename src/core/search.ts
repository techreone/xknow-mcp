import { Doc, KnowledgeBase, normalize } from "./knowledge.js";

export interface SearchHit {
  doc: Doc;
  score: number;
  snippet: string;
}

const STOP = new Set(
  "the and for with from that this these those are was were you your how what why when where which who does did can not but its into over about than then them they their have has had will would should could more most much many some any all one two use using used get makes make new best is are of to in on a an and or out".split(
    " "
  )
);

function tokenize(query: string): string[] {
  const q = normalize(query);
  const terms = q.split(" ").filter((t) => t.length >= 3 && !STOP.has(t));
  if (terms.length) return [...new Set(terms)];
  return [...new Set(q.split(" ").filter((t) => t.length >= 2))];
}

function makeSnippet(doc: Doc, phrase: string, terms: string[]): string {
  const body = doc.body;
  const lower = body.toLowerCase();
  const pats = phrase.includes(" ") ? [phrase, ...terms] : terms.length ? terms : [phrase];
  for (const pat of pats) {
    const idx = lower.indexOf(pat.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(body.length, idx + 180);
      let s = body.slice(start, end).replace(/\s+/g, " ").replace(/^[#>*_\-\s]+/, "");
      if (start > 0) s = "…" + s;
      if (end < body.length) s = s + "…";
      return s;
    }
  }
  return body.replace(/\s+/g, " ").slice(0, 180);
}

export function search(
  kb: KnowledgeBase,
  query: string,
  limit = 8,
  section?: string
): SearchHit[] {
  const phrase = normalize(query);
  const terms = tokenize(query);
  if (!phrase) return [];

  const hits: SearchHit[] = [];
  for (const doc of kb.docs) {
    if (section && doc.section.toLowerCase() !== section.toLowerCase()) continue;
    const title = normalize(doc.title);
    const body = doc.body.toLowerCase();
    const lower = phrase;
    let score = 0;

    if (title === lower) score += 10;
    if (title.includes(lower)) score += 12;
    for (const t of terms) if (title.includes(t)) score += 6;

    if (phrase.includes(" ")) {
      const occurrences = body.split(lower).length - 1;
      score += Math.min(occurrences, 3) + 10;
    }
    for (const t of terms) {
      const occurrences = body.split(t).length - 1;
      if (occurrences > 0) score += Math.min(occurrences, 4) + 2;
    }

    if (score > 0) hits.push({ doc, score, snippet: makeSnippet(doc, phrase, terms) });
  }

  hits.sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title));
  return hits.slice(0, limit);
}

export function findDoc(kb: KnowledgeBase, query: string): Doc | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  let exact: Doc | undefined;
  let partial: Doc | undefined;
  for (const doc of kb.docs) {
    const slug = normalize(doc.slug);
    const title = normalize(doc.title);
    if (slug === q || title === q) {
      exact = doc;
      break;
    }
    if (!partial && (title.includes(q) || slug.includes(q))) partial = doc;
  }
  return exact ?? partial;
}
