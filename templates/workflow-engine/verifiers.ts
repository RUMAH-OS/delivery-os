// Workflow Engine — the GENERIC Verifier capability surface (Slice 1).
// §11 DECISION-REVIEW-2026-06-22 (S4, C2) + EXECUTION-MODEL §10.5.1/§10.5.2. A Verifier IS the loop's
// objective stop condition made an interface (§10.5.1). The engine runs the named verifier IN-PROCESS,
// stores the Verdict, and evaluates the declarative stopCondition over it — it NEVER embeds verifier logic.
//
// OWNERSHIP BOUNDARY: this module is GENERIC mechanism only — the Verdict + the generic VerifierInput
// contract + an empty registry + register/get functions. It carries ZERO domain knowledge: it does NOT
// know about any specific domain. The engine passes the act step's checkpoint as the OPAQUE `candidate`;
// a domain verifier (APP-owned) destructures whatever it needs from that candidate ON ITS OWN SIDE.
// Domain reason enums live with the domain verifier, not here.
//
// S4 — Verdict is PII-FREE at the seam: `reasons` are CODED string values (a closed enum on the domain
// side), NEVER free text. The engine + the outbox only ever carry these codes.
//
// THE CONTRACT (§10.5.1): verify(input) -> Verdict. score/confidence/suggestedImprovement are part of the
// full contract; a T1 deterministic check (a rule is pass|fail) omits them rather than faking them.

// ── The GENERIC verifier input — what the engine hands every verifier. Domain-agnostic. ───────────
// `candidate` is the OPAQUE checkpoint the act step prepared (PII-free refs). The engine does NOT read
// inside it — a domain verifier destructures the keys it cares about on its own side. `attempt` is the act
// step's attempt (so a verifier can offer a deterministic proof-only force-fail hook). `tx` is the txn.
export interface VerifierInput {
  tx: TxLike;
  candidate: Record<string, unknown>;
  attempt: number;
}
type TxLike = unknown; // the Drizzle tx handle (the engine passes the real one; verifiers narrow it).

// ── The Verdict (the stop signal P4 reads). PII-FREE (S4): reasons are CODED strings only. ────────
export type VerifierVerdict = "pass" | "fail" | "needs_improvement";

export interface Verdict {
  verdict: VerifierVerdict;
  score?: number;
  confidence?: number;
  reasons: string[]; // S4: coded, PII-free (the closed enum lives with the domain verifier)
  suggestedImprovement?: unknown;
}

// ── The verifier registry — GENERIC + EMPTY. Domain verifiers register INTO it at startup. ────────
// The engine ships with NO verifiers; an owning app registers each by id (the catalog discipline,
// §10.5.4). Re-registering the same id overwrites (idempotent on re-import).
export type Verifier = (input: VerifierInput) => Promise<Verdict>;

const VERIFIERS: Record<string, Verifier> = {};

export function registerVerifier(id: string, fn: Verifier): void {
  VERIFIERS[id] = fn;
}

export function getVerifier(id: string): Verifier | undefined {
  return VERIFIERS[id];
}
