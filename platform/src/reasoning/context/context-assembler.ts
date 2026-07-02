// =============================================================================
// THE CONTEXT ASSEMBLER — the O4 Company-Intelligence read-view (Frozen §10.2, roadmap G-15, I17).
// =============================================================================
// `assembleContext` performs the TWO PAIRED MOVES that must precede every consequential thought (§10.2):
//   1. Knowledge-retrieve  ("retrieve-what-we-decided") — surface the relevant Deliberative Truth.
//   2. C0-INVESTIGATE      ("investigate-before-deciding") — a CITED brief over the live truth domains.
// It aggregates their output into a single ContextBrief and returns it. It DECIDES NOTHING — O4 "supplies
// facts, never decisions" (§2.1); it makes the reasoning call INFORMED, then hands off.
//
// It is a CLEAN PORT: the knowledge corpus and each investigate source are injected. The reasoning path never
// changes when a new source or corpus attaches — you add a source to the list. This keeps it real at N=1
// (wire the goal-contract + OS-runtime sources that EXIST today) and open (more truth domains later).
//
// HONESTY (I4): every item/finding is CITED (non-empty id + source) or DROPPED — an uncited claim is not
// context. When both moves come back empty, the brief is honestly `empty: true` (no fabricated filler).

import type {
  ContextBrief,
  Citation,
  Finding,
  InvestigateSource,
  KnowledgeItem,
  KnowledgePort,
} from "./context-brief.js";
import type { ReasoningClass } from "../reasoning-class.js";
import type { ResolveContext } from "../model-router.js";

/** A context-assembly request: the class we are assembling FOR, the task, an optional goal in scope, the ctx. */
export interface AssembleContextRequest {
  readonly class: ReasoningClass;
  readonly task: string;
  readonly goalId?: string;
  readonly ctx: ResolveContext;
}

/** The injected sources — the assembler's two clients (§10.2). Clean seams: fakes in tests, real ones in prod. */
export interface ContextSources {
  /** Knowledge-retrieve corpus. */
  readonly knowledge: KnowledgePort;
  /** C0-INVESTIGATE sources over live truth domains (goal-contract, OS runtime, …). */
  readonly investigators: readonly InvestigateSource[];
}

/** True iff a value is a non-empty, trimmed string — the citation floor (I4). */
function cited(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

/** Keep only items that carry BOTH a non-empty id and a non-empty source (cited-or-dropped, I4). */
function keepCitedKnowledge(items: readonly KnowledgeItem[]): KnowledgeItem[] {
  return items.filter((it) => cited(it.id) && cited(it.source) && cited(it.claim));
}
function keepCitedFindings(items: readonly Finding[]): Finding[] {
  return items.filter((it) => cited(it.id) && cited(it.source) && cited(it.claim));
}

/**
 * Assemble context for a reasoning call. Runs both moves (knowledge-retrieve + all investigate sources) —
 * concurrently, since they are independent read-only reads — filters every result through the citation floor,
 * and aggregates into one ContextBrief. Never throws for "nothing found": an empty corpus / silent source
 * yields an honest `empty: true` brief. A source that itself THROWS propagates (a broken read is a step
 * failure, not silently-empty context — conflating them would be a different lie).
 */
export async function assembleContext(
  req: AssembleContextRequest,
  sources: ContextSources,
): Promise<ContextBrief> {
  // Move 1 (retrieve) + Move 2 (investigate) run in parallel — independent read-only reads.
  const [retrievedRaw, investigatedGroups] = await Promise.all([
    sources.knowledge.retrieve(req.task),
    Promise.all(
      sources.investigators.map((src) =>
        src.investigate({ task: req.task, goalId: req.goalId, ctx: req.ctx }),
      ),
    ),
  ]);

  const retrieved = keepCitedKnowledge(retrievedRaw);
  const investigated = keepCitedFindings(investigatedGroups.flat());

  const citations: Citation[] = [
    ...retrieved.map((it): Citation => ({ id: it.id, source: it.source, kind: "knowledge" })),
    ...investigated.map((it): Citation => ({ id: it.id, source: it.source, kind: "investigation" })),
  ];

  return {
    retrieved,
    investigated,
    citations,
    assembledFor: req.class,
    empty: retrieved.length === 0 && investigated.length === 0,
  };
}

/** A no-op Knowledge port — honest empty retrieval (used as the default when no corpus is configured). */
export const EMPTY_KNOWLEDGE_PORT: KnowledgePort = {
  async retrieve(): Promise<KnowledgeItem[]> {
    return [];
  },
};

export type { ResolveContext };
