// =============================================================================
// REACHABILITY ORGAN PROOF (P2 slice 6, roadmap G-22; I17 "intelligence measured, never assumed").
// =============================================================================
// Proves the OS's fail-closed FEASIBILITY organ END-TO-END for free (no real model, no network, no DB):
//   (a) the parser / θ=0.7 fail-closed logic — canned JSON in, typed verdict out; the EXACT rule
//       (conf 0.69 ⇒ false; 0.71+asserted ⇒ true; exactly θ ⇒ true; unparseable ⇒ false; model uncertain ⇒
//       false; not-asserted ⇒ false) — a goal is NEVER admitted unless positively shown reachable;
//   (b) evaluateReachability() through a reasoner double — a confident output ⇒ reachable:true; garbage ⇒
//       reachable:false; and a model INVOCATION error PROPAGATES (a step failure is not "unreachable");
//   (c) the organ, driven through a REAL ContextAwareReasoningPort (real Model Router + assembled cited
//       context over a StubLlm), reasons FROM the brief and parses fail-closed; and it FAILS CLOSED with
//       ContextRequiredError (propagated, NOT a false verdict) when the consequential class has no context;
//   (d) the frozen REACHABILITY suite composes with the eval harness and GATES (runSuite + passesGate).
// Real-model scoring runs when a model is provisioned; this proves the MACHINERY + the fail-closed contract.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  evaluateReachability,
  parseReachabilityOutput,
  REACHABILITY_PROMPT,
  REACHABILITY_CONFIDENCE_FLOOR,
  type ReachabilityReasoner,
} from "../src/reasoning/organs/reachability.js";
import { REACHABILITY_SUITE } from "../src/reasoning/eval/suites/reachability.suite.js";
import { validateEvalSuite } from "../src/reasoning/eval/eval-case.js";
import { runSuite, modelResult } from "../src/reasoning/eval/eval-runner.js";
import { passesGate } from "../src/reasoning/eval/eval-gate.js";
import { ReasoningPort } from "../src/reasoning/reasoning-port.js";
import { ModelRouter } from "../src/reasoning/model-router.js";
import { loadRoutingConfig } from "../src/reasoning/routing-config.js";
import { ContextAwareReasoningPort } from "../src/reasoning/context/context-aware-port.js";
import { EMPTY_KNOWLEDGE_PORT, type ContextSources } from "../src/reasoning/context/context-assembler.js";
import type { InvestigateSource, KnowledgeItem, KnowledgePort } from "../src/reasoning/context/context-brief.js";
import { ContextRequiredError } from "../src/reasoning/context/context-policy.js";

const CTX = { requestId: "reachability-test-req-1" };

// ── Full REACHABILITY envelopes a good model would emit, keyed by goal (drives suite + organ paths). ────────
// The suite scores only the EXPECTED subset (json-field-match); these full envelopes also parse cleanly through
// the organ. Reachable → asserted true, high confidence, no blockers. Infeasible → false, confident, CITED
// blocker. Borderline → the model HEDGES (uncertain:true), so the organ falls closed to reachable:false.
const RESPONSES: Record<string, string> = {
  // reachable
  "fix a typo in the README": envReachable(0.97),
  "add a dark-mode toggle to the settings page": envReachable(0.92),
  "ship the invoicing feature — the delivery engine exists and has precedent": envReachable(0.9),
  "add a GET /health endpoint to the API": envReachable(0.95),
  "raise delivery coverage to 100% — the delivery engine is the lever and it exists": envReachable(0.88),
  // infeasible
  "make the API respond faster than the speed of light allows": envInfeasible(0.98, "physical limit — no lever moves it", "os_runtime:physics"),
  "double revenue by tomorrow with no product changes and no sales team": envInfeasible(0.95, "no lever available in the timebox", "goal_contract:levers"),
  "achieve negative request latency": envInfeasible(0.99, "logically impossible", "os_runtime:physics"),
  "guarantee 100% uptime forever with a single server and no redundancy": envInfeasible(0.96, "single point of failure precludes the guarantee", "os_runtime:topology"),
  "write a program that decides the halting problem for all inputs": envInfeasible(0.99, "provably undecidable", "knowledge:computability"),
  // borderline → the model hedges (uncertain:true)
  "improve the product": envBorderline(0.4, "goal is under-specified; no acceptance metric", "goal_contract:objective"),
  "migrate the database to a system we have not chosen yet": envBorderline(0.45, "target system undecided", "goal_contract:decision"),
  "scale to a load we have never measured or specified": envBorderline(0.5, "no measured target load", "goal_contract:metric"),
  "integrate a third-party vendor that has not been selected": envBorderline(0.35, "vendor not selected", "goal_contract:decision"),
};

function envReachable(confidence: number): string {
  return JSON.stringify({ reachable: true, confidence, uncertain: false, blockers: [], reason: "lever exists; precedent" });
}
function envInfeasible(confidence: number, claim: string, source: string): string {
  return JSON.stringify({ reachable: false, confidence, uncertain: false, blockers: [{ claim, source }], reason: "no path" });
}
function envBorderline(confidence: number, claim: string, source: string): string {
  return JSON.stringify({ reachable: false, confidence, uncertain: true, blockers: [{ claim, source }], reason: "insufficient evidence" });
}

/**
 * A StubLlm scripted from RESPONSES. It keys on the GOAL: the eval runner sends the raw goal as the prompt
 * (reasonForced), while the organ sends its built prompt with the goal fenced as <<<…>>> — this responder
 * recovers the goal from either form, so the SAME script drives both paths deterministically.
 */
function scriptedLlm(): StubLlm {
  return new StubLlm((prompt) => {
    const fenced = prompt.match(/<<<([\s\S]*)>>>/);
    const key = fenced ? fenced[1]! : prompt;
    const out = RESPONSES[key];
    if (out === undefined) throw new Error(`no canned response for goal: ${JSON.stringify(key)}`);
    return out;
  });
}

/** A minimal ReachabilityReasoner that returns a fixed model text (for isolated organ proofs). */
function reasonerReturning(text: string): ReachabilityReasoner {
  return {
    async reasonWithContext() {
      return { text, binding: { model: "stub", params: { thinking: "off" }, bindingId: "REACHABILITY:primary:stub" } };
    },
  };
}

// ── (a) parser / θ=0.7 fail-closed unit tests ──────────────────────────────────────────────────────────────

describe("parseReachabilityOutput — θ=0.7 FAIL-CLOSED (never a fabricated reachable:true)", () => {
  it("θ is 0.7 and the seam version is pinned", () => {
    expect(REACHABILITY_CONFIDENCE_FLOOR).toBe(0.7);
    expect(REACHABILITY_PROMPT.seam_version).toBe("reachability/v1");
  });

  it("reachable:true asserted AND confidence 0.71 ⇒ reachable:true (positively shown)", () => {
    const v = parseReachabilityOutput('{"reachable":true,"confidence":0.71,"uncertain":false,"blockers":[]}');
    expect(v).toMatchObject({ reachable: true, via: "reasoning", blockers: [] });
    expect(v.confidence).toBeCloseTo(0.71);
    expect(v.reason).toBeUndefined();
  });

  it("accepts EXACTLY at the floor (confidence 0.70 is reachable — >= θ)", () => {
    const v = parseReachabilityOutput(`{"reachable":true,"confidence":${REACHABILITY_CONFIDENCE_FLOOR},"uncertain":false,"blockers":[]}`);
    expect(v.reachable).toBe(true);
    expect(v.via).toBe("reasoning");
  });

  it("FAILS CLOSED just below the floor (confidence 0.69 ⇒ reachable:false) even when asserted", () => {
    const v = parseReachabilityOutput('{"reachable":true,"confidence":0.69,"uncertain":false,"blockers":[]}');
    expect(v).toMatchObject({ reachable: false, via: "fail-closed", reason: "below-confidence-floor" });
    expect(v.confidence).toBeCloseTo(0.69);
  });

  it("FAILS CLOSED when the model FLAGS uncertainty (uncertain:true), even at high confidence", () => {
    const v = parseReachabilityOutput('{"reachable":true,"confidence":0.95,"uncertain":true,"blockers":[{"claim":"unsure","source":"goal_contract:x"}]}');
    expect(v).toMatchObject({ reachable: false, via: "fail-closed", reason: "model-flagged-uncertain" });
    expect(v.confidence).toBeCloseTo(0.95); // carries the model's own confidence for the audit
    expect(v.blockers).toHaveLength(1); // cited blockers survive
  });

  it("FAILS CLOSED when the model does not positively assert reachable (reachable:false)", () => {
    const v = parseReachabilityOutput('{"reachable":false,"confidence":0.99,"uncertain":false,"blockers":[{"claim":"no lever","source":"os_runtime:x"}]}');
    expect(v).toMatchObject({ reachable: false, via: "fail-closed", reason: "reachable-not-asserted" });
    expect(v.blockers[0]).toMatchObject({ claim: "no lever", source: "os_runtime:x" });
  });

  it("FAILS CLOSED when reachable is absent / non-boolean (never guesses true)", () => {
    expect(parseReachabilityOutput('{"confidence":0.9,"uncertain":false}').reason).toBe("reachable-not-asserted");
    expect(parseReachabilityOutput('{"reachable":"yes","confidence":0.9,"uncertain":false}').reason).toBe("reachable-not-asserted");
  });

  it("FAILS CLOSED on unparseable output (no JSON) ⇒ reachable:false, confidence 0, no blockers", () => {
    const v = parseReachabilityOutput("I think it's probably doable?");
    expect(v).toMatchObject({ reachable: false, via: "fail-closed", reason: "unparseable-output", confidence: 0, blockers: [] });
  });

  it("recovers a JSON object wrapped in prose (model ignored the one-line instruction)", () => {
    const v = parseReachabilityOutput('Sure: {"reachable":true,"confidence":0.9,"uncertain":false,"blockers":[]} — hope that helps');
    expect(v).toMatchObject({ reachable: true, via: "reasoning" });
  });

  it("DROPS uncited blockers (I4: an uncited blocker is unattributable) but keeps cited ones", () => {
    const v = parseReachabilityOutput('{"reachable":false,"confidence":0.9,"uncertain":false,"blockers":[{"claim":"cited","source":"goal_contract:g"},{"claim":"uncited","source":""},{"claim":"","source":"x"}]}');
    expect(v.blockers).toHaveLength(1);
    expect(v.blockers[0]).toMatchObject({ claim: "cited", source: "goal_contract:g" });
  });

  it("clamps an out-of-range / non-finite confidence (defensive: never NaN, never > 1)", () => {
    expect(parseReachabilityOutput('{"reachable":true,"confidence":5,"uncertain":false,"blockers":[]}').confidence).toBe(1);
    expect(parseReachabilityOutput('{"reachable":true,"confidence":"high","uncertain":false,"blockers":[]}')).toMatchObject({ reachable: false, confidence: 0 });
  });
});

// ── (b) evaluateReachability() — builds the versioned task, reasons, parses fail-closed ────────────────────

describe("evaluateReachability() — reasons through the context-aware port, parses fail-closed", () => {
  it("builds a task that fences the goal and names the class (not a model)", () => {
    const task = REACHABILITY_PROMPT.build("ship invoicing");
    expect(task).toContain("<<<ship invoicing>>>");
    expect(task).toContain("reachable");
    expect(task).toContain("confidence");
  });

  it("returns reachable:true from a confident, asserted model output", async () => {
    const v = await evaluateReachability("ship it", CTX, reasonerReturning(envReachable(0.95)));
    expect(v).toMatchObject({ reachable: true, via: "reasoning" });
  });

  it("fails closed (reachable:false) when the model returns garbage — never fabricates reachable", async () => {
    const v = await evaluateReachability("ship it", CTX, reasonerReturning("¯\\_(ツ)_/¯ maybe"));
    expect(v).toMatchObject({ reachable: false, via: "fail-closed", reason: "unparseable-output" });
  });

  it("PROPAGATES a model INVOCATION error (a step failure is NOT 'unreachable')", async () => {
    const failing: ReachabilityReasoner = { async reasonWithContext() { throw new Error("model_down"); } };
    await expect(evaluateReachability("anything", CTX, failing)).rejects.toThrow("model_down");
  });
});

// ── (c) the organ through a REAL context-aware ReasoningPort (assembled cited context) ─────────────────────

describe("reachability organ — through a REAL ContextAwareReasoningPort (context before cognition)", () => {
  const router = new ModelRouter(loadRoutingConfig());

  function fakeGoalSource(goalId: string): InvestigateSource {
    return {
      id: "fake-goal",
      async investigate(q) {
        if (q.goalId !== goalId) return [];
        return [{ id: "goal.state", claim: `Goal ${goalId} is EXECUTING.`, source: `goal_contract:${goalId}` }];
      },
    };
  }
  function fakeKnowledge(items: KnowledgeItem[]): KnowledgePort {
    return { async retrieve() { return items; } };
  }
  const sources = (): ContextSources => ({
    knowledge: fakeKnowledge([{ id: "ADR.md", claim: "the delivery engine is the lever", source: "/d/ADR.md" }]),
    investigators: [fakeGoalSource("g-1")],
  });

  it("(c1) assembles cited context, injects it AHEAD of the task, and parses a reachable verdict", async () => {
    let seenPrompt = "";
    const goal = "ship the invoicing feature — the delivery engine exists and has precedent";
    const llm = new StubLlm((p) => { seenPrompt = p; return RESPONSES[goal]!; });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), sources());

    const v = await evaluateReachability(goal, CTX, port, "g-1");

    expect(v.reachable).toBe(true);
    // The assembled, CITED brief provably reached the model's prompt, AHEAD of the fenced goal.
    expect(seenPrompt).toContain("Assembled context");
    expect(seenPrompt).toContain("goal_contract:g-1");
    expect(seenPrompt.indexOf("Assembled context")).toBeLessThan(seenPrompt.indexOf(`<<<${goal}>>>`));
  });

  it("(c2) PROPAGATES ContextRequiredError when the consequential class has NO context (not a false verdict)", async () => {
    // Empty knowledge + a goal source scoped to a DIFFERENT goal ⇒ empty brief ⇒ I17 fails closed BEFORE any model call.
    const emptySources: ContextSources = { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [fakeGoalSource("other")] };
    const llm = new StubLlm(() => { throw new Error("model must NOT be called on empty context"); });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), emptySources);

    // The error PROPAGATES — it is NOT swallowed into a fabricated reachable:false verdict.
    await expect(evaluateReachability("plan with no context", CTX, port)).rejects.toBeInstanceOf(ContextRequiredError);
  });
});

// ── (d) the golden suite gates through the eval harness ────────────────────────────────────────────────────

describe("REACHABILITY golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite covering reachable / infeasible / borderline", () => {
    const v = validateEvalSuite(REACHABILITY_SUITE);
    expect(v.class).toBe("REACHABILITY");
    expect(v.cases.length).toBeGreaterThanOrEqual(12);
    const reachable = v.cases.filter((c) => (c.expected as { reachable?: boolean }).reachable === true);
    const infeasible = v.cases.filter((c) => (c.expected as { reachable?: boolean; uncertain?: boolean }).reachable === false && (c.expected as { uncertain?: boolean }).uncertain === false);
    const borderline = v.cases.filter((c) => (c.expected as { uncertain?: boolean }).uncertain === true);
    expect(reachable.length).toBeGreaterThanOrEqual(3);
    expect(infeasible.length).toBeGreaterThanOrEqual(3);
    expect(borderline.length).toBeGreaterThanOrEqual(3);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    const report = await runSuite(REACHABILITY_SUITE, { models: ["stub-reachability"], llm: scriptedLlm() });
    const row = modelResult(report, "stub-reachability")!;
    expect(row.failures).toEqual([]); // every golden matched its expected subset
    expect(row.passRate).toBe(1);
    expect(passesGate(report, "stub-reachability")).toBe(true); // green on the frozen suite ⇒ adoptable
  });

  it("a model that ALWAYS over-claims reachable FAILS the gate (fail-closed accounting)", async () => {
    // A model that always asserts reachable:true never matches the infeasible/borderline goldens → gate red.
    const overclaim = new StubLlm(() => '{"reachable":true,"confidence":0.99,"uncertain":false,"blockers":[]}');
    const report = await runSuite(REACHABILITY_SUITE, { models: ["overclaim"], llm: overclaim });
    expect(passesGate(report, "overclaim")).toBe(false);
  });
});
