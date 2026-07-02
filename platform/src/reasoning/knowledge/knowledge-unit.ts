// =============================================================================
// KNOWLEDGE UNIT (KU) — the atom of the PO's MEMORY faculty (Frozen §10.5 / §5.4, Deliberative Truth).
// =============================================================================
// A KnowledgeUnit is ONE thing the company already DECIDED — an ADR, a Decision Record, a Charter clause, or a
// Lesson earned from a live failure — captured in a shape the reasoning path can retrieve and CITE. It is the
// durable form of "retrieve what we already decided, don't rediscover it".
//
// HONESTY-BY-CONSTRUCTION (I4): a KU is worthless without a `source` — the WHERE it was decided, the citation
// that lets a reader verify the claim. The schema makes `id`, `claim`, and `source` all non-empty; anything
// short of that is not a memory, it is an unattributable assertion, and it is REJECTED at construction (the
// ingestor skips it) rather than smuggled into the store as a fabricated decision.
//
// zod-validated: the schema is the single structural contract. Ingestion, the store, and any future writer all
// pass through `parseKnowledgeUnit`, so a malformed KU can never enter the corpus.

import { z } from "zod";

/** The four kinds of Deliberative Truth the memory faculty holds (§5.4). */
export const KNOWLEDGE_KINDS = ["adr", "decision", "charter", "lesson"] as const;
export const knowledgeKindSchema = z.enum(KNOWLEDGE_KINDS);
export type KnowledgeKind = z.infer<typeof knowledgeKindSchema>;

/**
 * The KnowledgeUnit schema — the atom of the corpus. `id`/`claim`/`source` are non-empty (a memory with no
 * citation is dropped, I4); `body` may be empty (a bare-title decision is still a real decision); `tags`
 * defaults to []; `updatedAt` is an optional ISO stamp the source may know. `.strict()` — an unknown field is a
 * malformed KU, not a silently-accepted one.
 */
export const knowledgeUnitSchema = z
  .object({
    /** Stable id of the decided artifact (e.g. an ADR/DR slug or filename). Non-empty. */
    id: z.string().min(1),
    /** The decided claim, in the company's own words — the headline of the memory. Non-empty. */
    claim: z.string().min(1),
    /** The full decided text (retrievable body). May be empty for a title-only decision. */
    body: z.string(),
    /** WHERE it was decided — the citation (a file path / URL / slug). Non-empty (I4: no uncited memory). */
    source: z.string().min(1),
    /** Which kind of Deliberative Truth this is. */
    kind: knowledgeKindSchema,
    /** Retrieval tags — normalized keywords that widen a KU's reach without polluting its claim. */
    tags: z.array(z.string()).default([]),
    /** Optional ISO timestamp of the last decision update, when the source knows it. */
    updatedAt: z.string().optional(),
  })
  .strict();

export type KnowledgeUnit = z.infer<typeof knowledgeUnitSchema>;

/** Parse-or-throw (fail-closed): the one gate every KU passes through before it can enter the store. */
export function parseKnowledgeUnit(input: unknown): KnowledgeUnit {
  return knowledgeUnitSchema.parse(input);
}

/** Non-throwing variant — used by the ingestor to SKIP-not-fabricate a file that fails validation. */
export function safeParseKnowledgeUnit(
  input: unknown,
): z.SafeParseReturnType<unknown, KnowledgeUnit> {
  return knowledgeUnitSchema.safeParse(input);
}
