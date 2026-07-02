// =============================================================================
// FILE-BACKED KNOWLEDGE PORT — a REAL Knowledge-retrieve seam over decision/ADR markdown (Frozen §10.2, I17).
// =============================================================================
// The "retrieve-what-we-decided" move (§10.2), at N=1: a MINIMAL, REAL, file-backed KnowledgePort that reads
// Deliberative-Truth markdown (ADRs / Decision Records) from a CONFIGURABLE directory and returns CITED
// KnowledgeItems. The SEAM is real; the CORPUS is whatever exists. The default is NO directory configured ⇒
// it honestly returns [] (empty:true downstream) — it is NOT a fake that invents decisions. When a dir is
// configured, each `.md` file becomes one item: id = filename, claim = the doc's title (first `# ` heading, or
// first non-empty line), source = the file path (the citation, I4). Retrieval is a case-insensitive substring
// match of the query against title+body — deliberately minimal (the full Knowledge Layer / semantic retrieval
// is E7/P4); this is the early retrieve seam only.
//
// READ-ONLY: it only reads files. No writes, no DB, no migration. Pure Node fs — deterministic given a corpus.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { KnowledgeItem, KnowledgePort } from "../context-brief.js";

export interface FileKnowledgeOptions {
  /**
   * The corpus directory to read decision/ADR markdown from. DEFAULT: undefined ⇒ no corpus ⇒ retrieve() → []
   * (honest empty). Point this at a decisions/ADR dir to activate real retrieval.
   */
  readonly dir?: string;
  /** File extensions treated as knowledge docs. Default: [".md"]. */
  readonly extensions?: readonly string[];
}

/** Extract a doc's citable title: the first `# ` heading, else the first non-empty line, else the filename. */
export function extractTitle(body: string, fallback: string): string {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m && m[1] && m[1].trim()) return m[1].trim();
  }
  for (const line of lines) {
    if (line.trim()) return line.trim();
  }
  return fallback;
}

/**
 * A file-backed KnowledgePort. Constructed with an options bag; with no `dir`, retrieve() always returns []
 * (honest — the seam is real, the corpus is empty). With a `dir`, it reads the markdown docs and returns the
 * ones whose title/body match the query (case-insensitive substring), each CITED by its file path.
 */
export class FileKnowledgePort implements KnowledgePort {
  private readonly dir?: string;
  private readonly extensions: readonly string[];

  constructor(opts: FileKnowledgeOptions = {}) {
    this.dir = opts.dir;
    this.extensions = opts.extensions ?? [".md"];
  }

  async retrieve(query: string): Promise<KnowledgeItem[]> {
    if (!this.dir) return []; // no corpus configured — honest empty (not a fake)

    let entries: string[];
    try {
      entries = readdirSync(this.dir);
    } catch {
      // The configured dir does not exist / is unreadable: honestly nothing retrieved (never fabricate).
      return [];
    }

    const needle = query.trim().toLowerCase();
    const items: KnowledgeItem[] = [];
    for (const name of entries.sort()) {
      if (!this.extensions.some((ext) => name.endsWith(ext))) continue;
      const full = resolve(this.dir, name);
      let body: string;
      try {
        if (!statSync(full).isFile()) continue;
        body = readFileSync(full, "utf8");
      } catch {
        continue; // unreadable file — skip, never invent its content
      }
      const title = extractTitle(body, name);
      // Minimal retrieval: an empty query matches everything; otherwise title+body substring match.
      if (needle && !`${title}\n${body}`.toLowerCase().includes(needle)) continue;
      items.push({ id: name, claim: title, source: full });
    }
    return items;
  }
}
