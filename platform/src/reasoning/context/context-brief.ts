// =============================================================================
// THE CONTEXT BRIEF — the assembled, CITED situational awareness a reasoning call thinks FROM.
// =============================================================================
// I17 ("context before cognition", Frozen §10.2): no consequential reasoning call fires without a
// context-assembly step first. This file holds the SHAPES of that step's output — the ContextBrief — and the
// two PORTS the assembler draws from (the O4 aggregator's two clients, §10.2):
//   · Knowledge-retrieve  → "what we already DECIDED" (Deliberative Truth: ADRs / Decision Records).
//   · C0-INVESTIGATE      → "what I OBSERVED, cited" (live truth domains: goal-contract state, OS runtime).
//
// HONESTY-BY-CONSTRUCTION (I4): every KnowledgeItem and every Finding carries a `source` id. An item with no
// source is not "context", it is an unattributable claim — the assembler DROPS it rather than let the model
// reason from an uncited assertion. "Cited or dropped; never invent sources." When nothing real is available,
// the brief is honestly `empty: true` — a real empty, not a fabricated filler.

import type { ReasoningClass } from "../reasoning-class.js";
import type { ResolveContext } from "../model-router.js";

/** A retrieved memory: something the company ALREADY DECIDED (Deliberative Truth). CITED by `source`. */
export interface KnowledgeItem {
  /** Stable id of the decided artifact (e.g. an ADR/DR filename or slug). Non-empty or the item is dropped. */
  readonly id: string;
  /** The decided claim, in the company's own words. */
  readonly claim: string;
  /** WHERE it was decided — the citation. Non-empty or the item is dropped (I4: no uncited memory). */
  readonly source: string;
}

/** An investigated observation of LIVE reality (goal-contract state, OS runtime). CITED by `source`. */
export interface Finding {
  /** Stable id of this finding within its source (e.g. "goal.state"). Non-empty or the finding is dropped. */
  readonly id: string;
  /** The observed fact. */
  readonly claim: string;
  /** WHICH live source produced it — the citation (e.g. `goal_contract:<id>`). Non-empty or dropped (I4). */
  readonly source: string;
  /** Optional observation timestamp (ISO), when the source knows it. */
  readonly observedAt?: string;
}

/** A single citation entry — the flattened provenance of one item/finding, tagged by which move produced it. */
export interface Citation {
  readonly id: string;
  readonly source: string;
  readonly kind: "knowledge" | "investigation";
}

/**
 * The assembled context brief — the output of the two paired moves (§10.2), the thing a consequential
 * reasoning call is REQUIRED (I17) to think from. `empty` is true iff BOTH moves returned nothing real: an
 * honest "we know nothing relevant here yet", never masked by filler.
 */
export interface ContextBrief {
  /** Knowledge-retrieve output — what we already decided. */
  readonly retrieved: readonly KnowledgeItem[];
  /** C0-INVESTIGATE output — what we observed, each cited. */
  readonly investigated: readonly Finding[];
  /** The flattened provenance of everything above — every claim in the brief is traceable to a source. */
  readonly citations: readonly Citation[];
  /** The class this brief was assembled FOR (audit: a brief is assembled per reasoning call, not reused blindly). */
  readonly assembledFor: ReasoningClass;
  /** True iff nothing real was retrieved AND nothing was investigated (honest emptiness, not fabricated). */
  readonly empty: boolean;
}

// ── The two PORTS the assembler draws from (clean seams so more sources/corpora attach later). ────────────

/** The Knowledge-retrieve port: "what did we already decide?" Returns CITED items ([] when no corpus — honest). */
export interface KnowledgePort {
  retrieve(query: string): Promise<KnowledgeItem[]>;
}

/** What an investigate source is asked to look into (the task, the optional goal in scope, the resolve ctx). */
export interface InvestigateQuery {
  readonly task: string;
  readonly goalId?: string;
  readonly ctx: ResolveContext;
}

/**
 * A C0-INVESTIGATE source: a clean port over ONE live truth domain (goal-contract, OS runtime, …). Returns
 * CITED findings ([] when it has nothing to say). Adding a domain = adding a source to the assembler's list;
 * the assembler and the reasoning path never change. Each source is responsible for citing its own findings.
 */
export interface InvestigateSource {
  /** Stable identifier of the source (for audit / dedup). */
  readonly id: string;
  investigate(query: InvestigateQuery): Promise<Finding[]>;
}
