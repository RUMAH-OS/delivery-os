// =============================================================================
// STORE-BACKED KNOWLEDGE PORT — the REAL corpus behind the context-assembler's retrieve move (Frozen §10.5).
// =============================================================================
// This is the KnowledgePort the context-assembler was BUILT to accept (slice 4 left the seam; the default was
// an honest empty port). `StoreKnowledgePort` implements that exact interface over a `KnowledgeStore`, so it
// drops into the assembler by INJECTION — you construct the assembler's `ContextSources` with this port instead
// of the empty default. The assembler code does not change; its default empty behavior is untouched (I17/§10.2).
//
// Every returned KnowledgeItem carries the KU's `source` — the retrieve move stays CITED end-to-end (I4). The
// port narrows a KU (id/claim/body/tags/kind/source) to the KnowledgeItem the assembler expects (id/claim/
// source); the body/tags fed the ranker, the citation rides through to the prompt.
//
// The boot factory `createKnowledgePortFromEnv` is the OPTIONAL wiring: if `PLATFORM_KNOWLEDGE_DIR` is set it
// ingests that dir into a store-backed port; otherwise it returns the honest empty default (no corpus ⇒ no
// fabricated memory). Nothing in the boot path changes unless an operator opts in by pointing at a corpus.

import type { KnowledgeItem, KnowledgePort } from "../context/context-brief.js";
import { EMPTY_KNOWLEDGE_PORT } from "../context/context-assembler.js";
import { KnowledgeStore } from "./knowledge-store.js";
import { ingestMarkdownDir, type IngestOptions } from "./ingest.js";

export interface StoreKnowledgePortOptions {
  /** Max KUs to surface per retrieve. Forwarded to the store's ranker. Default: the store default. */
  readonly k?: number;
}

/**
 * A KnowledgePort over a KnowledgeStore. Satisfies the slice-4 `KnowledgePort` contract structurally, so it
 * injects into the context-assembler with zero assembler changes. Returns CITED items (each carries its KU's
 * `source`); an empty store or an off-topic query returns [] (honest, never fabricated).
 */
export class StoreKnowledgePort implements KnowledgePort {
  constructor(
    private readonly store: KnowledgeStore,
    private readonly opts: StoreKnowledgePortOptions = {},
  ) {}

  async retrieve(query: string): Promise<KnowledgeItem[]> {
    const hits = this.store.retrieve(query, { k: this.opts.k });
    return hits.map((h): KnowledgeItem => ({ id: h.unit.id, claim: h.unit.claim, source: h.unit.source }));
  }
}

/** Build a store-backed port from an already-ingested set of KUs (test/composition convenience). */
export function storeKnowledgePortFromDir(
  dir: string,
  opts: StoreKnowledgePortOptions & IngestOptions = {},
): StoreKnowledgePort {
  const store = new KnowledgeStore();
  store.addAll(ingestMarkdownDir(dir, opts));
  return new StoreKnowledgePort(store, opts);
}

/**
 * The OPTIONAL boot path. If `PLATFORM_KNOWLEDGE_DIR` is set (and non-blank), ingest it into a store-backed
 * port. Otherwise return the honest empty default — the seam is real, the corpus is only what an operator
 * configures. This never changes the assembler's default empty behavior; it just provides the port to inject.
 */
export function createKnowledgePortFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  opts: StoreKnowledgePortOptions & IngestOptions = {},
): KnowledgePort {
  const dir = env.PLATFORM_KNOWLEDGE_DIR?.trim();
  if (!dir) return EMPTY_KNOWLEDGE_PORT; // no corpus configured — honest empty (not a fake)
  return storeKnowledgePortFromDir(dir, opts);
}
