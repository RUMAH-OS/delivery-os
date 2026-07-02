// =============================================================================
// COMPLETION-REVIEW ORGAN (C6) PROOF (P2 slice 7, roadmap G-23; I17 "intelligence measured, never assumed").
// =============================================================================
// Proves the OS's independent §11-lens completion review END-TO-END for free (no real model, no network, no DB):
//   (a) the parser / fail-closed default — canned JSON in, typed verdict out; a "pass" is returned ONLY when every
//       lens is affirmed met AND confidence ≥ the VERIFY floor AND the model itself did not object. Unparseable /
//       incomplete lenses / any unmet lens / low confidence / model-flagged shortfall ALL fail closed to NOT-pass.
//   (b) reviewCompletion() — builds the versioned VERIFY task, reasons through a context-aware reasoner double,
//       parses fail-closed; a model INVOCATION error PROPAGATES (a step failure is not "the goal failed review").
//   (c) the COMPLETION-REVIEW golden suite composes with the eval harness and GATES: a scripted-correct model is
//       green (passesGate true); a model that rubber-stamps "pass" fails the gate (fail-closed accounting).
// Real-model scoring runs when a model is provisioned; this proves the MACHINERY + the fail-closed contract.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  reviewCompletion,
  parseCompletionReviewOutput,
  COMPLETION_REVIEW_PROMPT,
  COMPLETION_REVIEW_LENSES,
  COMPLETION_REVIEW_CONFIDENCE_FLOOR,
  type CompletionLens,
  type CompletionReviewReasoner,
  type LensFinding,
  type Verdict,
} from "../src/reasoning/organs/completion-review.js";
import { COMPLETION_REVIEW_SUITE } from "../src/reasoning/eval/suites/completion-review.suite.js";
import { validateEvalSuite } from "../src/reasoning/eval/eval-case.js";
import { runSuite, modelResult } from "../src/reasoning/eval/eval-runner.js";
import { passesGate } from "../src/reasoning/eval/eval-gate.js";

// ── Envelope builders — the full JSON a model would emit for one review. ────────────────────────────────

/** One lens finding object. */
function lens(name: CompletionLens, met: boolean, finding = "reviewed", source = "cited evidence") {
  return { lens: name, met, finding, source };
}

/** All four required lenses, every one met:true. */
function allLensesMet() {
  return COMPLETION_REVIEW_LENSES.map((l) => lens(l, true));
}

/** A full envelope: a declared verdict, a confidence, and lens findings (default: all four met). */
function envelope(opts: {
  verdict: Verdict;
  confidence: number;
  findings?: ReturnType<typeof lens>[];
}): string {
  return JSON.stringify({
    verdict: opts.verdict,
    confidence: opts.confidence,
    lensFindings: opts.findings ?? allLensesMet(),
  });
}

/** A well-formed, confident PASS envelope (the one positively-proven pass). */
const PASS_ENVELOPE = envelope({ verdict: "pass", confidence: 0.9 });

// ── (a) parser / fail-closed unit tests ─────────────────────────────────────────────────────────────────

describe("parseCompletionReviewOutput — typed parse + FAIL-CLOSED (never a fabricated pass)", () => {
  it("returns PASS only when every lens is affirmed met AND confidence ≥ floor AND the model did not object", () => {
    const v = parseCompletionReviewOutput(PASS_ENVELOPE);
    expect(v.verdict).toBe("pass");
    expect(v.reason).toBeUndefined();
    expect(v.confidence).toBeCloseTo(0.9);
    expect(v.lensFindings).toHaveLength(COMPLETION_REVIEW_LENSES.length);
    expect(v.lensFindings.every((f) => f.met)).toBe(true);
    expect(v.seamVersion).toBe(COMPLETION_REVIEW_PROMPT.seam_version);
  });

  it("recovers a JSON object wrapped in prose (model ignored the one-line instruction)", () => {
    const v = parseCompletionReviewOutput(`Here is my review: ${PASS_ENVELOPE} — hope that helps.`);
    expect(v.verdict).toBe("pass");
  });

  it("FAILS CLOSED to 'fail' on unparseable output (no JSON) — cannot even review, never a pass", () => {
    const v = parseCompletionReviewOutput("I think this looks basically done to me.");
    expect(v).toMatchObject({ verdict: "fail", reason: "unparseable-output", confidence: 0 });
    expect(v.lensFindings).toEqual([]);
  });

  it("FAILS CLOSED to 'fail' when a required lens is ABSENT (an incomplete review is not a pass)", () => {
    // Only three of the four required lenses present → lenses-incomplete.
    const three = COMPLETION_REVIEW_LENSES.slice(0, 3).map((l) => lens(l, true));
    const v = parseCompletionReviewOutput(envelope({ verdict: "pass", confidence: 0.95, findings: three }));
    expect(v).toMatchObject({ verdict: "fail", reason: "lenses-incomplete" });
  });

  it("FAILS CLOSED to 'fail' when a lens is malformed (met not boolean ⇒ never coerced to met)", () => {
    const findings = allLensesMet();
    (findings[1] as { met: unknown }).met = "yes"; // off-type met on completeness-vs-acceptance
    const v = parseCompletionReviewOutput(envelope({ verdict: "pass", confidence: 0.95, findings }));
    expect(v).toMatchObject({ verdict: "fail", reason: "lenses-incomplete" });
  });

  it("FAILS CLOSED to 'needs_work' when ONE lens is unmet (surfaced, not smoothed) — carries the finding", () => {
    const findings = allLensesMet();
    findings[1] = lens("completeness-vs-acceptance", false, "criterion 3 (tests) not met", "no test files added");
    const v = parseCompletionReviewOutput(envelope({ verdict: "pass", confidence: 0.95, findings }));
    expect(v).toMatchObject({ verdict: "needs_work", reason: "lens-unmet" });
    const unmet = v.lensFindings.find((f) => !f.met) as LensFinding;
    expect(unmet.lens).toBe("completeness-vs-acceptance");
    expect(unmet.finding).toContain("tests");
  });

  it("FAILS CLOSED to 'needs_work' below the confidence floor even when every lens is claimed met", () => {
    const under = COMPLETION_REVIEW_CONFIDENCE_FLOOR - 0.1;
    const v = parseCompletionReviewOutput(envelope({ verdict: "pass", confidence: under }));
    expect(v).toMatchObject({ verdict: "needs_work", reason: "below-confidence-floor" });
    expect(v.confidence).toBeCloseTo(under);
  });

  it("accepts exactly AT the confidence floor (>= floor is confident)", () => {
    const v = parseCompletionReviewOutput(envelope({ verdict: "pass", confidence: COMPLETION_REVIEW_CONFIDENCE_FLOOR }));
    expect(v.verdict).toBe("pass");
    expect(v.reason).toBeUndefined();
  });

  it("HONORS the model's own skepticism: verdict:'fail' is never upgraded even if lenses read met", () => {
    const v = parseCompletionReviewOutput(envelope({ verdict: "fail", confidence: 0.95 }));
    expect(v).toMatchObject({ verdict: "fail", reason: "model-flagged-fail" });
  });

  it("HONORS the model's own 'needs_work' even when every lens is claimed met and confidence is high", () => {
    const v = parseCompletionReviewOutput(envelope({ verdict: "needs_work", confidence: 0.95 }));
    expect(v).toMatchObject({ verdict: "needs_work", reason: "model-flagged-needs-work" });
  });

  it("an off-enum / missing overall verdict does NOT block a pass when lenses+confidence earn it", () => {
    // The model's declared `verdict` is optional; a pass is derived from the lenses, not the headline field.
    const noVerdict = JSON.stringify({ confidence: 0.9, lensFindings: allLensesMet() });
    expect(parseCompletionReviewOutput(noVerdict).verdict).toBe("pass");
    const offEnum = JSON.stringify({ verdict: "definitely-done", confidence: 0.9, lensFindings: allLensesMet() });
    expect(parseCompletionReviewOutput(offEnum).verdict).toBe("pass");
  });
});

// ── (b) reviewCompletion() — reasons through a context-aware double, parses fail-closed ──────────────────

const CTX = { requestId: "test-req-c6" };
const INPUT = {
  goal: "add a POST /login endpoint",
  acceptance: ["returns 200 + token on valid creds", "returns 401 on bad creds", "covered by tests"],
  evidence: "endpoint merged in PR#12; login.test.ts pass 8/8; CI green",
  goalId: "g-login-1",
};

/** A minimal context-aware reasoner double: captures the request, returns fixed model text. */
function reasonerReturning(text: string): CompletionReviewReasoner & { seen?: { class: string; goalId?: string; task: string } } {
  const self: CompletionReviewReasoner & { seen?: { class: string; goalId?: string; task: string } } = {
    async reasonWithContext(req) {
      self.seen = { class: req.class, goalId: req.goalId, task: req.task };
      return { text };
    },
  };
  return self;
}

describe("reviewCompletion() — versioned VERIFY task, reason-with-context, parse fail-closed", () => {
  it("builds a task that names the lenses + fences the goal/evidence, and reasons through class VERIFY", async () => {
    const reasoner = reasonerReturning(PASS_ENVELOPE);
    const v = await reviewCompletion(INPUT, CTX, reasoner);
    expect(v.verdict).toBe("pass");
    // reasoned as VERIFY (a class, never a model), scoped to the goal, from a versioned task.
    expect(reasoner.seen!.class).toBe("VERIFY");
    expect(reasoner.seen!.goalId).toBe("g-login-1");
    expect(reasoner.seen!.task).toContain("<<<add a POST /login endpoint>>>");
    expect(reasoner.seen!.task).toContain("completeness-vs-acceptance");
    expect(COMPLETION_REVIEW_PROMPT.seam_version).toBe("completion-review/v1");
  });

  it("fails closed (not-pass) when the model returns garbage — never fabricates a pass", async () => {
    const v = await reviewCompletion(INPUT, CTX, reasonerReturning("looks good to me 👍"));
    expect(v).toMatchObject({ verdict: "fail", reason: "unparseable-output" });
  });

  it("returns needs_work when the model reports an unmet acceptance lens", async () => {
    const findings = allLensesMet();
    findings[1] = lens("completeness-vs-acceptance", false, "no tests added", "PR#12 has no test files");
    const v = await reviewCompletion(INPUT, CTX, reasonerReturning(envelope({ verdict: "needs_work", confidence: 0.9, findings })));
    expect(v.verdict).toBe("needs_work");
    expect(v.lensFindings.find((f) => !f.met)!.lens).toBe("completeness-vs-acceptance");
  });

  it("propagates a model INVOCATION error (a step failure is not 'the goal failed review')", async () => {
    const failing: CompletionReviewReasoner = { async reasonWithContext() { throw new Error("model_down"); } };
    await expect(reviewCompletion(INPUT, CTX, failing)).rejects.toThrow("model_down");
  });
});

// ── (c) the golden suite gates through the eval harness ──────────────────────────────────────────────────

/** Build the raw envelope a well-scripted reviewer would emit for a case, keyed by its EXPECTED verdict.
 *  json-field-match scores only the `verdict` field, so the lens findings just have to be internally consistent. */
function scriptedEnvelopeFor(expectedVerdict: Verdict): string {
  if (expectedVerdict === "pass") return envelope({ verdict: "pass", confidence: 0.92 });
  // needs_work / fail: mark one lens unmet so the envelope is honest about WHY it is not a pass.
  const findings = allLensesMet();
  findings[1] = lens("completeness-vs-acceptance", false, "an acceptance lens is not met", "stated evidence");
  return envelope({ verdict: expectedVerdict, confidence: 0.88, findings });
}

/** A StubLlm scripted from the suite: for each case input, the envelope matching its expected verdict. */
function scriptedLlm(): StubLlm {
  const byInput = new Map<string, string>();
  for (const c of COMPLETION_REVIEW_SUITE.cases) {
    byInput.set(c.input, scriptedEnvelopeFor((c.expected as { verdict: Verdict }).verdict));
  }
  return new StubLlm((prompt) => {
    const out = byInput.get(prompt);
    if (out === undefined) throw new Error(`no canned review for input: ${JSON.stringify(prompt.slice(0, 60))}`);
    return out;
  });
}

describe("COMPLETION-REVIEW golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite covering pass / needs_work / fail", () => {
    const v = validateEvalSuite(COMPLETION_REVIEW_SUITE);
    expect(v.class).toBe("VERIFY");
    expect(v.cases.length).toBeGreaterThanOrEqual(10);
    const verdicts = new Set(v.cases.map((c) => (c.expected as { verdict: Verdict }).verdict));
    expect(verdicts).toEqual(new Set<Verdict>(["pass", "needs_work", "fail"]));
    // the skeptical majority: at least as many not-pass goldens as pass goldens (bias to withholding done).
    const passes = v.cases.filter((c) => (c.expected as { verdict: Verdict }).verdict === "pass").length;
    expect(passes).toBeLessThan(v.cases.length - passes);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    const report = await runSuite(COMPLETION_REVIEW_SUITE, { models: ["stub-review"], llm: scriptedLlm() });
    const row = modelResult(report, "stub-review")!;
    expect(row.failures).toEqual([]);
    expect(row.passRate).toBe(1);
    expect(passesGate(report, "stub-review")).toBe(true); // green on the frozen suite ⇒ adoptable
  });

  it("a model that RUBBER-STAMPS 'pass' fails the gate (fail-closed accounting catches the false pass)", async () => {
    // Always-"pass" reviewer is right on the pass goldens but wrong on every not-pass golden → passRate < 0.9.
    const rubberStamp = new StubLlm(() => PASS_ENVELOPE);
    const report = await runSuite(COMPLETION_REVIEW_SUITE, { models: ["rubber-stamp"], llm: rubberStamp });
    expect(passesGate(report, "rubber-stamp")).toBe(false);
  });
});
