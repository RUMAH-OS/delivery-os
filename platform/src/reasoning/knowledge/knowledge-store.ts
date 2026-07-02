// =============================================================================
// KNOWLEDGE STORE — the in-memory index + retrieval over Knowledge Units (Frozen §10.5, the MEMORY faculty).
// =============================================================================
// The store is what turns a pile of Knowledge Units into "retrieve what we already decided". It holds a set of
// KUs and answers `retrieve(query, {k})` with the top-k most relevant, each still CITED (it carries its KU's
// `source` — retrieval never strips the citation, I4).
//
// The ranker is a DETERMINISTIC lexical scorer (BM25-lite) — NO external embedding service, no network, no
// hidden model. Given the same corpus + query it returns the same ranking, every time, on any machine; it is
// fully testable. Scoring is over the KU's claim + body + tags, with the claim and tags weighted higher (a
// match in the headline/keywords matters more than a match buried in the body). idf uses the smoothed
// `ln(1 + (N - df + 0.5)/(df + 0.5))` form, which is ALWAYS positive, so an off-topic query (no matching
// terms) scores exactly 0 and is honestly returned as [] rather than a low-confidence fabricated hit.
//
// In-memory + pure: no DB, no I/O. Adding a KU re-derives nothing lazily — stats are computed at retrieve time
// from the indexed token lists, keeping `add` O(1) and `retrieve` a clean pass over a small corpus.

import { parseKnowledgeUnit, type KnowledgeUnit } from "./knowledge-unit.js";

/** BM25 term-frequency saturation. Standard default. */
const BM25_K1 = 1.5;
/** BM25 length normalization. Standard default. */
const BM25_B = 0.75;
/** How many times claim/tag tokens are counted vs body tokens — field weighting, deterministic. */
const HEADLINE_WEIGHT = 3;
/** Default number of hits returned when the caller does not specify k. */
const DEFAULT_K = 8;

/** One retrieval hit — the KU, its score, and WHICH query terms matched (for audit + prompt provenance). */
export interface RetrievalHit {
  /** The matched Knowledge Unit — carries its own `source` (the citation survives retrieval, I4). */
  readonly unit: KnowledgeUnit;
  /** The BM25-lite relevance score (> 0; higher is more relevant). */
  readonly score: number;
  /** The unique query terms that actually matched this KU, sorted (deterministic). */
  readonly matchedOn: readonly string[];
}

export interface RetrieveOptions {
  /** Max hits to return. Default 8. Only positive-score hits are ever returned. */
  readonly k?: number;
}

/** Lowercase, split on non-alphanumeric runs. The one tokenizer both indexing and querying use. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * The searchable token bag of a KU: claim + tags counted HEADLINE_WEIGHT times, body once. This is how a match
 * in the decided headline/keywords outranks the same match deep in the body — deterministically, with no model.
 */
function indexTokens(unit: KnowledgeUnit): string[] {
  const headline = [...tokenize(unit.claim), ...unit.tags.flatMap(tokenize)];
  const out: string[] = [];
  for (let i = 0; i < HEADLINE_WEIGHT; i++) out.push(...headline);
  out.push(...tokenize(unit.body));
  return out;
}

/**
 * The in-memory Knowledge Store: a set of KUs plus a BM25-lite index over them. `add` validates (fail-closed),
 * `all` lists, `retrieve` ranks. Re-adding the same id REPLACES the KU (last write wins — an updated decision
 * supersedes the old one; there is never a duplicate memory for one id).
 */
export class KnowledgeStore {
  private readonly units = new Map<string, KnowledgeUnit>();
  private readonly tokens = new Map<string, string[]>();

  /** Add (or replace) a KU. Validated through the schema — a malformed unit never enters the corpus. */
  add(unit: KnowledgeUnit): void {
    const valid = parseKnowledgeUnit(unit); // fail-closed: throws on a malformed KU
    this.units.set(valid.id, valid);
    this.tokens.set(valid.id, indexTokens(valid));
  }

  /** Add many KUs. */
  addAll(units: readonly KnowledgeUnit[]): void {
    for (const u of units) this.add(u);
  }

  /** How many KUs are indexed. */
  get size(): number {
    return this.units.size;
  }

  /** All KUs, sorted by id (deterministic). */
  all(): KnowledgeUnit[] {
    return [...this.units.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /**
   * Retrieve the top-k KUs for a query, ranked by BM25-lite. Only positive-score hits are returned, so an
   * off-topic query honestly yields [] (no matching term ⇒ score 0). Ties break by ascending id (deterministic).
   * Every hit carries its KU's `source` — retrieval keeps the citation (I4).
   */
  retrieve(query: string, opts: RetrieveOptions = {}): RetrievalHit[] {
    const k = opts.k ?? DEFAULT_K;
    const queryTerms = [...new Set(tokenize(query))];
    if (queryTerms.length === 0 || this.units.size === 0) return [];

    const N = this.units.size;
    // Document frequency of each query term across the corpus.
    const df = new Map<string, number>();
    for (const term of queryTerms) df.set(term, 0);
    let totalLen = 0;
    for (const toks of this.tokens.values()) {
      totalLen += toks.length;
      const seen = new Set(toks);
      for (const term of queryTerms) if (seen.has(term)) df.set(term, (df.get(term) ?? 0) + 1);
    }
    const avgLen = totalLen / N;

    // idf per query term — smoothed form, always > 0 (so an all-corpus term still contributes, never subtracts).
    const idf = new Map<string, number>();
    for (const term of queryTerms) {
      const n = df.get(term) ?? 0;
      idf.set(term, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
    }

    const hits: RetrievalHit[] = [];
    for (const [id, toks] of this.tokens) {
      const dl = toks.length;
      const tf = new Map<string, number>();
      for (const t of toks) if (idf.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      const matchedOn: string[] = [];
      for (const term of queryTerms) {
        const f = tf.get(term) ?? 0;
        if (f === 0) continue;
        matchedOn.push(term);
        const numerator = f * (BM25_K1 + 1);
        const denominator = f + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / avgLen);
        score += (idf.get(term) ?? 0) * (numerator / denominator);
      }
      if (score > 0) {
        hits.push({ unit: this.units.get(id)!, score, matchedOn: matchedOn.sort() });
      }
    }

    hits.sort((a, b) => (b.score - a.score) || (a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0));
    return hits.slice(0, k);
  }
}
