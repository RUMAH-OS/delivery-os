// =============================================================================
// THE COMPLETION-REVIEW ORGAN (C6) — the "did we ACTUALLY finish?" gate (P2 slice 7, roadmap G-23).
// =============================================================================
// This organ is an INDEPENDENT §11-lens review of a COMPLETED goal. It answers ONE question — "is this goal
// genuinely done, across every acceptance lens, or is that a claim we have not earned?" — by REASONING through
// the context-aware ReasoningPort (class VERIFY). VERIFY's primary model is constrained to be MODEL-DIVERSE
// from the author (config, not code): the reviewer is not the builder. Spec: ADR-reasoning-model-routing.md +
// Frozen §10.3/§10.4 (C6 completion review) + §11 (multi-lens, surface-disagreements-never-smooth-them).
//
// RELATION TO THE M2 STUB (src/completion-review-c6.ts): that module is the METRIC-PROBE C6 — it re-reads a
// single quantitative acceptance metric under its own identity. THIS organ is the REASONED C6 — a multi-lens
// judgment over the whole goal (correctness, completeness-vs-acceptance, evidence, regressions/risk), for goals
// whose "done" is not one number. The two are complementary faces of the same §15 principle (a goal does not
// self-declare done); this slice LIGHTS UP the reasoned face via the ReasoningPort. It is STANDALONE — it is
// NOT wired into the live REVIEWING→DONE transition here (that enforce-flip on a live goal is a later slice).
//
// SEPARATION OF POWERS (load-bearing):
//   · The organ REVIEWS. It does NOT transition a contract, mutate state, or authorize a merge. It RETURNS a
//     verdict. Whoever owns REVIEWING→DONE consumes the verdict; a "pass" is evidence, not an enforced flip.
//   · The organ names a CLASS ("VERIFY"), never a model. Which model serves VERIFY is config, resolved by the
//     Model Router behind the ReasoningPort — and it is pinned model-diverse from the author (author≠verifier).
//   · It reasons through reasonWithContext, so the review fires FROM the assembled brief (the goal's own DECIDED
//     acceptance + the observed state), never a cold prompt — an unproven pass on a thin prompt is the failure.
//
// FAIL-CLOSED — the skeptic's bias (an unproven pass is worse than a false fail):
//   NOT-pass is the DEFAULT. The organ returns verdict "pass" in EXACTLY ONE positively-proven state:
//     (the output parsed) AND (every required §11 lens is present, on-enum, and AFFIRMED met) AND (confidence
//     is at/above the VERIFY floor) AND (the model did not itself signal fail/needs_work).
//   EVERY other state yields a NOT-pass verdict, never a fabricated pass:
//     · unparseable output ....................... verdict "fail"       (we could not even review)
//     · a required lens absent / off-enum / malformed  verdict "fail"   (an incomplete review is not a pass)
//     · ANY required lens met:false .............. verdict "needs_work" (identifiable remediation remains)
//     · confidence below the floor ............... verdict "needs_work" (lenses claimed met, reviewer unsure)
//     · the model itself declared fail ........... verdict "fail"       (honor the skeptic, never upgrade)
//     · the model itself declared needs_work ..... verdict "needs_work" (honor the skeptic, never upgrade)
//   A model INVOCATION error (the model is down / the router resolves nothing) is a DIFFERENT failure: it is a
//   step failure, not "the goal is unfinished." It PROPAGATES from the ReasoningPort unchanged — conflating "I
//   can't reach a reviewer" with "the goal failed review" would itself be a lie. The caller decides how to degrade.

import type { ReasoningClass } from "../reasoning-class.js";
import type { ResolveContext } from "../model-router.js";

// ── The §11 lenses this organ reviews across — a small, fixed, versioned set (§10.4 / §11 multi-lens). ─────
// Each lens is one independent axis of "done". A goal is done only when EVERY lens is affirmed; a single unmet
// lens (surfaced, never smoothed) is enough to withhold "pass". Adding/removing a lens is a versioned change
// (bump seam_version) so a verdict's provenance — which lenses it was judged against — is exact and rollback-able.
export const COMPLETION_REVIEW_LENSES = [
  "correctness", //                 does the work actually do what the goal asked, correctly (no wrong behaviour)?
  "completeness-vs-acceptance", //  is EVERY stated acceptance criterion met — nothing dropped or half-done?
  "evidence-cited", //              is the "done" claim backed by concrete, checkable evidence (not an assertion)?
  "regressions-risk", //            no new breakage / undue risk introduced alongside the change?
] as const;
export type CompletionLens = (typeof COMPLETION_REVIEW_LENSES)[number];

/** The VERIFY refusal floor: a review confidence strictly below this withholds "pass" even when every lens is
 *  claimed met (a low-confidence pass is not an earned pass). Set HIGHER than the CLASSIFY floor on purpose —
 *  VERIFY is the high-stakes "are we done" gate, biased to skepticism. A named constant so the bar is rollback-able. */
export const COMPLETION_REVIEW_CONFIDENCE_FLOOR = 0.7;

// ── The organ's output — the verdict a done-owner consumes. ──────────────────────────────────────────────

/** One lens' finding: the axis, whether it is affirmed met, the reviewer's finding, and the cited source/evidence
 *  the finding rests on (§11 — a finding without a source is an assertion, not a review). `met:false` on any
 *  required lens withholds "pass". */
export interface LensFinding {
  readonly lens: CompletionLens;
  /** True iff this lens is positively affirmed met. A missing/ambiguous lens is NEVER coerced to true. */
  readonly met: boolean;
  /** The reviewer's finding for this lens (why it is / is not met) — surfaced for the audit, never smoothed. */
  readonly finding: string;
  /** The concrete evidence/source the finding cites (an acceptance line, an artifact, observed state). */
  readonly source: string;
}

/** Why the organ fell closed to a NOT-pass verdict (attached for the audit; a "pass" carries no reason). */
export type FailClosedReason =
  | "unparseable-output" //       the model output had no parseable JSON object
  | "lenses-incomplete" //        a required lens was absent / off-enum / malformed (an incomplete review)
  | "lens-unmet" //               ≥1 required lens was affirmed met:false (remediation remains)
  | "below-confidence-floor" //   every lens claimed met, but confidence < the VERIFY floor
  | "model-flagged-fail" //       the model itself declared verdict:"fail"
  | "model-flagged-needs-work"; //the model itself declared verdict:"needs_work"

/** The three-valued completion verdict. `pass` = genuinely done across every lens; `needs_work` = reviewable
 *  shortfall (an unmet lens / low confidence) with identifiable remediation; `fail` = review could not stand
 *  (unparseable / incomplete) or the model declared failure. Only `pass` clears the "done" gate. */
export type Verdict = "pass" | "fail" | "needs_work";

/**
 * The completion verdict. On a PASS, `verdict:"pass"`, every required lens is present with `met:true`, `confidence`
 * is at/above the floor, and `reason` is absent. On any NOT-pass, `verdict` is `fail`|`needs_work`, `reason`
 * records the fail-closed cause, and `lensFindings` carries whatever the review could stand on (empty when the
 * output could not be parsed / was incomplete). `seamVersion` pins the prompt asset that produced it (provenance).
 */
export interface CompletionVerdict {
  readonly verdict: Verdict;
  readonly lensFindings: readonly LensFinding[];
  /** The reviewer's confidence in [0, 1] (0 on an unparseable result). */
  readonly confidence: number;
  /** The prompt-asset version that produced this verdict (rollback provenance). */
  readonly seamVersion: string;
  /** Present iff NOT pass — the fail-closed reason (audit only). */
  readonly reason?: FailClosedReason;
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ──────────────────────────
// Changing the wording is a versioned change: bump seam_version so a verdict's provenance is exact and a
// regression can roll back to a known-good prompt. The persona constrains the model to the lenses and to a
// STRICT JSON envelope, and tells it — explicitly — to withhold "pass" unless it can affirm EVERY lens from
// cited evidence. The organ reasons through the CONTEXT-aware port, so the assembled brief (the goal's DECIDED
// acceptance + observed state) is injected AHEAD of this task; the model reviews FROM it, inventing nothing.

const LENS_LINES = COMPLETION_REVIEW_LENSES.map((l) => `    - ${l}`).join("\n");

/** The input the organ reviews: the goal, its acceptance criteria, the completion evidence, and the goal id. */
export interface CompletionReviewInput {
  /** The goal statement under review (what was asked). */
  readonly goal: string;
  /** The stated acceptance criteria — the bar "done" is judged against (the completeness-vs-acceptance lens maps here). */
  readonly acceptance: readonly string[];
  /** The evidence the "done" claim rests on (artifacts, observed state, test output) — the evidence-cited lens maps here. */
  readonly evidence: string;
  /** The goal in scope — lets the context-aware VERIFY assembly pull this goal's DECIDED acceptance + live state. */
  readonly goalId: string;
}

export const COMPLETION_REVIEW_PROMPT = Object.freeze({
  seam_version: "completion-review/v1",
  persona:
    "You are an INDEPENDENT completion reviewer for a software company's autonomous Project Owner. You are NOT " +
    "the author of the work — your job is to decide, skeptically, whether a completed goal is GENUINELY done " +
    "across every acceptance lens. You review only from the goal, its acceptance criteria, the cited evidence, " +
    "and the assembled context — you invent nothing. A goal does not self-declare done: you withhold 'pass' " +
    "unless you can affirm EVERY lens from concrete evidence. An unproven pass is worse than an honest fail.",
  /** Build the concrete review task for one goal. The goal/acceptance/evidence are fenced so they are recoverable. */
  build(input: CompletionReviewInput): string {
    const acceptanceLines = input.acceptance.length
      ? input.acceptance.map((a, i) => `    ${i + 1}. ${a}`).join("\n")
      : "    (none stated)";
    return [
      COMPLETION_REVIEW_PROMPT.persona,
      "",
      "Review whether this COMPLETED goal is genuinely done. Judge it across EXACTLY these lenses:",
      LENS_LINES,
      "",
      "For EACH lens: decide met (true only if positively affirmed from the evidence/context), give a short " +
        "finding, and cite the source it rests on (an acceptance line, an artifact, observed state). If you " +
        "cannot affirm a lens from concrete evidence, set met:false — do NOT assume it is met.",
      "Set the overall verdict: 'pass' ONLY if EVERY lens is met and you are confident; 'needs_work' if a lens " +
        "is unmet but remediable; 'fail' if the work does not stand. Never report a 'pass' you cannot defend.",
      "",
      "Goal under review:",
      `  <<<${input.goal}>>>`,
      "Stated acceptance criteria:",
      acceptanceLines,
      "Completion evidence:",
      `  <<<${input.evidence}>>>`,
      "",
      "Respond with STRICT JSON on ONE line, no prose:",
      '{"verdict":"<pass|fail|needs_work>","confidence":<0..1>,"lensFindings":[' +
        '{"lens":"<lens>","met":<true|false>,"finding":"<text>","source":"<cited evidence>"}]}',
    ].join("\n");
  },
});

// ── Parsing + fail-closed validation (pure — unit-tested directly, no model needed). ─────────────────────

const LENS_SET: ReadonlySet<string> = new Set(COMPLETION_REVIEW_LENSES);
const VERDICT_SET: ReadonlySet<string> = new Set<Verdict>(["pass", "fail", "needs_work"]);

/** A NOT-pass sink for a given fail-closed reason. `verdict` is caller-chosen (fail vs needs_work); lensFindings
 *  carries whatever the review could stand on (empty on an unparseable/incomplete review). Never a fabricated pass. */
function notPass(
  verdict: Exclude<Verdict, "pass">,
  reason: FailClosedReason,
  confidence: number,
  lensFindings: readonly LensFinding[] = [],
): CompletionVerdict {
  return { verdict, lensFindings, confidence, seamVersion: COMPLETION_REVIEW_PROMPT.seam_version, reason };
}

/** Extract the first balanced-ish JSON object from possibly-noisy model text (the model may wrap prose). */
function extractJsonObject(raw: string): unknown | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/** Parse ONE lens finding fail-closed. Returns null if it is absent/malformed/off-enum (never coerces met). */
function parseLensFinding(raw: unknown): LensFinding | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.lens !== "string" || !LENS_SET.has(o.lens)) return null;
  if (typeof o.met !== "boolean") return null; // an ambiguous / missing met is NEVER read as met.
  const finding = typeof o.finding === "string" ? o.finding : "";
  const source = typeof o.source === "string" ? o.source : "";
  return { lens: o.lens as CompletionLens, met: o.met, finding, source };
}

/**
 * Parse a model's raw VERIFY output into a typed CompletionVerdict, FAIL-CLOSED. Pure: no I/O, no model.
 * Returns a NOT-pass verdict (never a fabricated pass) whenever the output is unusable — no JSON, a required
 * lens absent/off-enum/malformed, any lens unmet, confidence below the floor, or the model's own fail/needs_work.
 * A "pass" is returned ONLY when every required lens is present + affirmed met AND confidence ≥ the floor AND
 * the model did not itself declare a shortfall.
 */
export function parseCompletionReviewOutput(raw: string): CompletionVerdict {
  const obj = extractJsonObject(raw);
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return notPass("fail", "unparseable-output", 0);
  }
  const o = obj as Record<string, unknown>;

  // confidence read early so a NOT-pass result still carries the reviewer's own (possibly low) confidence.
  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence) ? Math.max(0, Math.min(1, o.confidence)) : 0;

  // The model's own declared verdict (optional, validated) — honored only to WITHHOLD pass, never to upgrade.
  const modelVerdict = typeof o.verdict === "string" && VERDICT_SET.has(o.verdict) ? (o.verdict as Verdict) : undefined;

  // Every required lens must be present exactly once, on-enum, and well-formed — else the review is incomplete.
  const rawFindings = Array.isArray(o.lensFindings) ? o.lensFindings : [];
  const byLens = new Map<CompletionLens, LensFinding>();
  for (const rf of rawFindings) {
    const parsed = parseLensFinding(rf);
    if (parsed && !byLens.has(parsed.lens)) byLens.set(parsed.lens, parsed);
  }
  const findings: LensFinding[] = [];
  for (const lens of COMPLETION_REVIEW_LENSES) {
    const f = byLens.get(lens);
    if (!f) return notPass("fail", "lenses-incomplete", confidence); // a lens we could not review is not a pass.
    findings.push(f);
  }

  // ANY required lens unmet ⇒ withhold pass (remediation remains). Surfaced, not smoothed.
  if (findings.some((f) => !f.met)) return notPass("needs_work", "lens-unmet", confidence, findings);

  // Honor the model's OWN skepticism: it may claim every lens met yet still declare a shortfall — never upgrade.
  if (modelVerdict === "fail") return notPass("fail", "model-flagged-fail", confidence, findings);
  if (modelVerdict === "needs_work") return notPass("needs_work", "model-flagged-needs-work", confidence, findings);

  // Every lens affirmed met, but under-confident ⇒ not an earned pass (VERIFY is biased to skepticism).
  if (confidence < COMPLETION_REVIEW_CONFIDENCE_FLOOR) {
    return notPass("needs_work", "below-confidence-floor", confidence, findings);
  }

  // The ONE positively-proven pass: parseable, every lens met, confident, and the model itself did not object.
  return { verdict: "pass", lensFindings: findings, confidence, seamVersion: COMPLETION_REVIEW_PROMPT.seam_version };
}

// ── The organ entrypoint — reason through the CONTEXT-aware port, parse fail-closed. ─────────────────────

/** The narrow context-aware reasoning seam the organ depends on: reason WITH CONTEXT, naming a CLASS. The real
 *  ContextAwareReasoningPort satisfies this structurally, so the organ names VERIFY and never a model, and tests
 *  can inject a lightweight double. */
export interface CompletionReviewReasoner {
  reasonWithContext(req: {
    readonly class: ReasoningClass;
    readonly task: string;
    readonly goalId?: string;
    readonly ctx: ResolveContext;
    readonly system?: string;
  }): Promise<{ readonly text: string }>;
}

/**
 * Review whether a completed goal is genuinely done, through the context-aware ReasoningPort (class VERIFY).
 * Builds the VERSIONED review task, reasons FROM the assembled brief (the goal's DECIDED acceptance + observed
 * state), and parses the model's JSON into the typed verdict FAIL-CLOSED (see parseCompletionReviewOutput).
 *
 * This is JUDGMENT, not authorization: it transitions no contract and enforces no flip — a "pass" is evidence a
 * done-owner consumes, not an enforced REVIEWING→DONE.
 *
 * @throws ReasoningInvocationError / ContextRequiredError / UnknownReasoningClassError / NoAvailableModelError —
 *   a model/router/context failure PROPAGATES (a step failure is not "the goal failed review"). Output-level
 *   problems fail closed to a NOT-pass verdict instead.
 */
export async function reviewCompletion(
  input: CompletionReviewInput,
  ctx: ResolveContext,
  reasoner: CompletionReviewReasoner,
): Promise<CompletionVerdict> {
  const task = COMPLETION_REVIEW_PROMPT.build(input);
  const result = await reasoner.reasonWithContext({
    class: "VERIFY",
    task,
    goalId: input.goalId,
    ctx,
    system: COMPLETION_REVIEW_PROMPT.persona,
  });
  return parseCompletionReviewOutput(result.text);
}
