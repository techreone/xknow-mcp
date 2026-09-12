import { Doc, KnowledgeBase, normalize } from "./knowledge.js";

export interface ExploreResult {
  root: Doc;
  outbound: Doc[];
  inbound: Doc[];
  links: string[];
}

export class Graph {
  private byTitle = new Map<string, Doc>();
  private bySlug = new Map<string, Doc>();
  private inbound = new Map<string, Set<string>>();

  constructor(kb: KnowledgeBase) {
    for (const doc of kb.docs) {
      this.byTitle.set(normalize(doc.title), doc);
      this.bySlug.set(normalize(doc.slug), doc);
    }
    for (const doc of kb.docs) {
      for (const target of this.outboundKeys(doc)) {
        const t = this.resolve(target);
        if (t && t !== doc) {
          if (!this.inbound.has(t.slug)) this.inbound.set(t.slug, new Set());
          this.inbound.get(t.slug)!.add(doc.slug);
        }
      }
    }
  }

  private outboundKeys(doc: Doc): string[] {
    return [...(doc.links ?? []), ...(doc.related ?? [])];
  }

  resolve(key: string): Doc | undefined {
    const k = normalize(key);
    return this.byTitle.get(k) ?? this.bySlug.get(k);
  }

  outbound(doc: Doc): Doc[] {
    const seen = new Set<string>();
    const out: Doc[] = [];
    for (const key of this.outboundKeys(doc)) {
      const t = this.resolve(key);
      if (t && t !== doc && !seen.has(t.slug)) {
        seen.add(t.slug);
        out.push(t);
      }
    }
    return out;
  }

  inboundDocs(doc: Doc): Doc[] {
    const slugs = this.inbound.get(doc.slug);
    if (!slugs) return [];
    return [...slugs].map((s) => this.bySlug.get(normalize(s))).filter((d): d is Doc => Boolean(d));
  }

  explore(doc: Doc): ExploreResult {
    return { root: doc, outbound: this.outbound(doc), inbound: this.inboundDocs(doc), links: doc.links ?? [] };
  }
}
