// Workflow Engine — the GENERIC Verifier capability surface (Slice 1) + the RUNG / CALIBRATION /
// EVAL-THE-EVALUATOR framework (T2-T4, §11 DECISION-REVIEW + EXECUTION-MODEL §10.5).
// §10.5.1/§10.5.2 — A Verifier IS the loop's objective stop condition made an interface. The engine runs
// the named verifier IN-PROCESS, stores the Verdict, and evaluates the declarative stopCondition over it —
// it NEVER embeds verifier logic.
//
// OWNERSHIP BOUNDARY: this module is GENERIC mechanism only — the Verdict + the generic VerifierInput
// contract + an empty registry + register/get + the rung/calibration framework. It carries ZERO domain
// knowledge: it does NOT know about any specific domain. The engine passes the act step's checkpoint as the
// OPAQUE `candidate`; a domain verifier (APP-owned) destructures whatever it needs from that candidate ON
// ITS OWN SIDE. Domain reason enums live with the domain verifier, not here.
//
// S4 — Verdict is PII-FREE at the seam: `reasons` are CODED string values (a closed enum on the domain
// side), NEVER free text. The engine + the outbox only ever carry these codes.
//
// THE CONTRACT (§10.5.1): verify(input) -> Verdict. score/confidence/suggestedImprovement are part of the
// full contract; a T1 deterministic check (a rule is pass|fail) omits them rather than faking them.
//
// ── THE T2-T4 VERIFIER FRAMEWORK (§10.5 taxonomy + eval-the-evaluator) ─────────────────────────────────
// A verifier carries a RUNG declaring HOW MUCH JUDGMENT it exercises:
//   T1  deterministic rule (a check that is its own proof)            — GATING-EXEMPT (always allowed to gate)
//   T2  rubric/structured scoring                                     — JUDGMENT (may gate ONLY if calibrated)
//   T3  confidence-scored judgment                                   — JUDGMENT (may gate ONLY if calibrated)
//   T4  LLM-judge / model-scored                                     — JUDGMENT (may gate ONLY if calibrated)
//   T5  human gate                                                   — HUMAN (the human-gate path; always gates)
// THE INVARIANT (eval-the-evaluator, ku-verifier-must-be-evaluated): a T2-T4 verifier must be CALIBRATED
// (pass evaluateVerifier over labeled cases) BEFORE it may GATE a run. An un-calibrated T2-T4 verifier is
// ADVISE-ONLY — it can NEVER cause a run to reach `completed`. The engine reads gate-eligibility from this
// module (isGateEligible); the app calls evaluateVerifier to earn calibration.

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

// ── The verifier RUNG (§10.5 taxonomy). Declares how much judgment the verifier exercises. ──────────
export type VerifierRung = "T1" | "T2" | "T3" | "T4" | "T5";

// the rungs that may gate UNCONDITIONALLY (no calibration required). T1 = deterministic rule (its own
// proof); T5 = human (the human-gate path). T2-T4 are JUDGMENT and require calibration to gate.
const GATING_EXEMPT_RUNGS: ReadonlySet<VerifierRung> = new Set<VerifierRung>(["T1", "T5"]);
const JUDGMENT_RUNGS: ReadonlySet<VerifierRung> = new Set<VerifierRung>(["T2", "T3", "T4"]);

export function isGatingExemptRung(rung: VerifierRung): boolean {
  return GATING_EXEMPT_RUNGS.has(rung);
}
export function isJudgmentRung(rung: VerifierRung): boolean {
  return JUDGMENT_RUNGS.has(rung);
}

// ── The verifier registry — GENERIC + EMPTY. Domain verifiers register INTO it at startup. ────────
// The engine ships with NO verifiers; an owning app registers each by id (the catalog discipline,
// §10.5.4). Re-registering the same id overwrites (idempotent on re-import).
export type Verifier = (input: VerifierInput) => Promise<Verdict>;

// the full registry record: the function + its declared rung + its calibration status. Re-registering the
// same id overwrites the function/rung but PRESERVES a prior calibration result ONLY IF the rung is unchanged
// (a rung change invalidates calibration — a different judgment surface must be re-evaluated). Generic.
interface VerifierRecord {
  fn: Verifier;
  rung: VerifierRung;
  calibration?: CalibrationResult; // undefined = never evaluated (un-calibrated)
}

const VERIFIERS: Record<string, VerifierRecord> = {};

// rung defaults to T1 when omitted (backward-compatible with the Slice-1 deterministic verifiers, which are
// gating-exempt by construction). A T2-T4 verifier MUST declare its rung to participate in calibration.
export function registerVerifier(id: string, fn: Verifier, rung: VerifierRung = "T1"): void {
  const prior = VERIFIERS[id];
  // preserve calibration across an idempotent re-register of the SAME rung; drop it on a rung change.
  const calibration = prior && prior.rung === rung ? prior.calibration : undefined;
  VERIFIERS[id] = { fn, rung, calibration };
}

export function getVerifier(id: string): Verifier | undefined {
  return VERIFIERS[id]?.fn;
}

export function getVerifierRung(id: string): VerifierRung | undefined {
  return VERIFIERS[id]?.rung;
}

// ── eval-the-evaluator (the calibration gate, ku-verifier-must-be-evaluated) ────────────────────────
// A labeled case = an OPAQUE candidate + its EXPECTED ground-truth label (pass|fail). The engine/app runs
// the verifier over every case and scores it: accuracy + the two ERROR RATES that matter for safety:
//   falseAccept = the verifier said PASS on a candidate whose truth is FAIL  (the DANGEROUS error — it lets
//                 a bad outcome through; a verifier that does this must NEVER calibrate)
//   falseReject = the verifier said FAIL/needs_improvement on a candidate whose truth is PASS (annoying, not
//                 dangerous — it triggers an unnecessary retry, never a bad completion)
// CALIBRATED iff accuracy >= threshold AND falseAccept <= a STRICT bound (default 0 — zero tolerance for
// passing a known-bad outcome). The thresholds are conservative by default; an app may tighten them.
export interface CalibrationCase {
  candidate: Record<string, unknown>;
  expected: "pass" | "fail"; // ground truth: should this candidate be ACCEPTED (pass) or REJECTED (fail)?
}

export interface CalibrationThresholds {
  minAccuracy?: number; // default 0.9
  maxFalseAccept?: number; // default 0 (STRICT: never pass a known-bad outcome)
}

export interface CalibrationResult {
  rung: VerifierRung;
  cases: number;
  accuracy: number; // fraction of cases the verdict matched the expected label
  falseAccept: number; // fraction of truth=fail cases the verifier ACCEPTED (verdict=pass) — the dangerous error
  falseReject: number; // fraction of truth=pass cases the verifier REJECTED (verdict!=pass)
  thresholds: Required<CalibrationThresholds>;
  calibrated: boolean; // accuracy >= minAccuracy AND falseAccept <= maxFalseAccept
  evaluatedAt: string; // ISO timestamp (observability)
}

const DEFAULT_THRESHOLDS: Required<CalibrationThresholds> = { minAccuracy: 0.9, maxFalseAccept: 0 };

// Run a verifier over labeled cases and compute its calibration. PURE w.r.t. the registry (it does NOT
// record — call recordCalibration / evaluateAndRegister to persist). `tx` is passed through to the verifier
// (a deterministic verifier ignores it; a DB-reading one narrows it). Generic: cases are opaque candidates.
export async function evaluateVerifier(
  verify: Verifier,
  rung: VerifierRung,
  cases: CalibrationCase[],
  tx: TxLike = undefined,
  thresholds: CalibrationThresholds = {},
): Promise<CalibrationResult> {
  const th: Required<CalibrationThresholds> = { ...DEFAULT_THRESHOLDS, ...thresholds };
  if (cases.length === 0) {
    // no evidence => NOT calibrated (fail-closed; an un-evaluated judge never gates).
    return { rung, cases: 0, accuracy: 0, falseAccept: 1, falseReject: 1, thresholds: th, calibrated: false, evaluatedAt: new Date().toISOString() };
  }
  let correct = 0;
  let truthFail = 0, falseAcceptCount = 0;
  let truthPass = 0, falseRejectCount = 0;
  for (const c of cases) {
    let verdict: Verdict;
    try {
      verdict = await verify({ tx, candidate: c.candidate, attempt: 0 });
    } catch {
      // a verifier that THROWS on a case is treated as the SAFE rejection (verdict=fail) for scoring: it
      // never accepts, so it cannot false-accept; it does count as a (false) reject on a truth=pass case.
      verdict = { verdict: "fail", reasons: ["verifier_threw"] };
    }
    const accepted = verdict.verdict === "pass"; // ONLY an explicit pass is an acceptance; needs_improvement is a rejection.
    const matched = c.expected === "pass" ? accepted : !accepted;
    if (matched) correct++;
    if (c.expected === "fail") {
      truthFail++;
      if (accepted) falseAcceptCount++; // accepted a candidate whose truth is FAIL => the dangerous error.
    } else {
      truthPass++;
      if (!accepted) falseRejectCount++; // rejected a candidate whose truth is PASS.
    }
  }
  const accuracy = correct / cases.length;
  const falseAccept = truthFail === 0 ? 0 : falseAcceptCount / truthFail;
  const falseReject = truthPass === 0 ? 0 : falseRejectCount / truthPass;
  const calibrated = accuracy >= th.minAccuracy && falseAccept <= th.maxFalseAccept;
  return { rung, cases: cases.length, accuracy, falseAccept, falseReject, thresholds: th, calibrated, evaluatedAt: new Date().toISOString() };
}

// Record a calibration result against a registered verifier id (so the engine's gate-eligibility check can
// read it). Throws if the id is not registered (fail-closed: cannot calibrate a non-existent verifier). The
// recorded result's rung must match the registered rung (a mismatch is a programming error).
export function recordCalibration(id: string, result: CalibrationResult): void {
  const rec = VERIFIERS[id];
  if (!rec) throw new Error(`cannot record calibration for unregistered verifier "${id}"`);
  if (rec.rung !== result.rung) {
    throw new Error(`calibration rung mismatch for "${id}": registered ${rec.rung}, result ${result.rung}`);
  }
  rec.calibration = result;
}

// Convenience: evaluate a REGISTERED verifier over labeled cases AND record the result. Returns the result.
// The app calls this to EARN calibration for a T2-T4 verifier before it is allowed to gate.
export async function evaluateAndRegister(
  id: string,
  cases: CalibrationCase[],
  tx: TxLike = undefined,
  thresholds: CalibrationThresholds = {},
): Promise<CalibrationResult> {
  const rec = VERIFIERS[id];
  if (!rec) throw new Error(`cannot evaluate unregistered verifier "${id}"`);
  const result = await evaluateVerifier(rec.fn, rec.rung, cases, tx, thresholds);
  rec.calibration = result;
  return result;
}

export function getCalibration(id: string): CalibrationResult | undefined {
  return VERIFIERS[id]?.calibration;
}

// ── GATE-ELIGIBILITY — the advise-vs-gate decision the engine reads (the safety crux). ──────────────
// A verifier is GATE-ELIGIBLE (its verdict may DRIVE the loop to a terminal `completed`) iff:
//   - its rung is GATING-EXEMPT (T1 deterministic, or T5 human), OR
//   - its rung is JUDGMENT (T2-T4) AND it has a recorded calibration whose `calibrated` flag is true.
// Otherwise it is ADVISE-ONLY: the engine MUST NOT let its verdict complete a run (fail-closed).
export type GateDecision = {
  eligible: boolean; // may this verifier's verdict drive the loop to completion?
  rung: VerifierRung;
  reason: "rung_exempt" | "calibrated" | "uncalibrated" | "unknown_verifier";
  calibrated: boolean; // for a judgment rung: is there a passing calibration on record?
};

export function gateDecision(id: string): GateDecision {
  const rec = VERIFIERS[id];
  if (!rec) return { eligible: false, rung: "T1", reason: "unknown_verifier", calibrated: false };
  if (isGatingExemptRung(rec.rung)) return { eligible: true, rung: rec.rung, reason: "rung_exempt", calibrated: true };
  const calibrated = rec.calibration?.calibrated === true;
  return {
    eligible: calibrated,
    rung: rec.rung,
    reason: calibrated ? "calibrated" : "uncalibrated",
    calibrated,
  };
}

export function isGateEligible(id: string): boolean {
  return gateDecision(id).eligible;
}

// TEST/PROOF-ONLY registry reset (so a deterministic proof can register fresh content per scenario without a
// shared singleton leaking calibration between scenarios). NEVER called in production wiring.
export function __resetVerifiersForTest(): void {
  for (const k of Object.keys(VERIFIERS)) delete VERIFIERS[k];
}
