// =============================================================================
// STRATEGY ORGAN PROOF (reasoning slice 11, O2; I17 "intelligence measured, never assumed").
// =============================================================================
// Proves the OS's deep-approach STRATEGY organ END-TO-END for free (no real model, no network, no DB):
//   (a) the parser / fail-closed logic — canned JSON in, typed result out; the EXACT rule (unparseable ⇒
//       clarify; model asked-to-clarify ⇒ clarify; empty approach/rationale ⇒ clarify; conf < 0.6 ⇒ clarify;
//       committed only when approach ∧ rationale ∧ conf ≥ θ) — a strategy is NEVER fabricated;
//   (b) formStrategy() through a reasoner double — a confident output ⇒ committed strategy; garbage ⇒ clarify;
//       and a model INVOCATION error PROPAGATES (a step failure is not "needs clarification");
//   (c) the organ, driven through a REAL ContextAwareReasoningPort (real Model Router + assembled cited context
//       over a StubLlm), reasons FROM the brief and parses fail-closed; and it FAILS CLOSED with
//       ContextRequiredError (propagated, NOT a false strategy) when the consequential class has no context;
//   (d) the frozen STRATEGY suite composes with the eval harness and GATES (runSuite + passesGate).

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  formStrategy,
  parseStrategyOutput,
  STRATEGY_PROMPT,
  STRATEGY_CONFIDENCE_FLOOR,
  type StrategyReasoner,
} from "../src/reasoning/organs/strategy.js";
import { STRATEGY_SUITE } from "../src/reasoning/eval/suites/strategy.suite.js";
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

const CTX = { requestId: "strategy-test-req-1" };

// ── Full STRATEGY envelopes a good model would emit, keyed by goal (drives suite + organ paths). ─────────────
const RESPONSES: Record<string, string> = {
  // committed
  "ship the invoicing feature — the delivery engine exists and has precedent": envCommit(0.9, "reuse the delivery engine; extend the invoice module and add acceptance tests"),
  "add a GET /health endpoint to the existing API service": envCommit(0.95, "add a stateless /health handler to the existing router"),
  "add a dark-mode toggle to the settings page using the existing theme system": envCommit(0.88, "wire a toggle into the existing theme provider"),
  "raise delivery test coverage to 90% — the delivery engine is the lever and it exists": envCommit(0.82, "add targeted tests to the delivery engine's uncovered branches"),
  "cache the hot read path in the API with the Redis instance we already run": envCommit(0.86, "add a read-through cache keyed by tenant on the hot path"),
  "add per-tenant rate limiting to the public API using the existing gateway middleware": envCommit(0.84, "configure the gateway middleware with a per-tenant token bucket"),
  // clarify
  "improve the product": envClarify(0.3, "no acceptance metric given", "goal_contract:objective"),
  "migrate the database to a system we have not chosen yet": envClarify(0.35, "target system undecided", "goal_contract:decision"),
  "integrate a third-party payments vendor that has not been selected": envClarify(0.3, "vendor not selected", "goal_contract:decision"),
  "scale to a load we have never measured or specified": envClarify(0.4, "no measured target load", "goal_contract:metric"),
  "rewrite the app to be more modern": envClarify(0.25, "no definition of 'modern' or scope", "goal_contract:objective"),
  "grow usage — figure out how": envClarify(0.2, "no lever or channel specified", "goal_contract:objective"),
};

function envCommit(confidence: number, approach: string): string {
  return JSON.stringify({
    approach,
    rationale: "the levers named in the context already exist and have precedent",
    risks: [{ claim: "scope creep if requirements shift", source: "goal_contract:scope" }],
    alternativesConsidered: ["build it from scratch", "defer to a later milestone"],
    confidence,
    needs_clarification: false,
  });
}
function envClarify(confidence: number, claim: string, source: string): string {
  return JSON.stringify({
    approach: "",
    rationale: "",
    risks: [{ claim, source }],
    alternativesConsidered: [],
    confidence,
    needs_clarification: true,
  });
}

/** A StubLlm scripted from RESPONSES. Recovers the goal from the fenced <<<…>>> form (organ) or the raw prompt
 *  (eval runner), so the SAME script drives both paths deterministically. */
function scriptedLlm(): StubLlm {
  return new StubLlm((prompt) => {
    const fenced = prompt.match(/<<<([\s\S]*)>>>/);
    const key = fenced ? fenced[1]! : prompt;
    const out = RESPONSES[key];
    if (out === undefined) throw new Error(`no canned response for goal: ${JSON.stringify(key)}`);
    return out;
  });
}

/** A minimal StrategyReasoner that returns a fixed model text (for isolated organ proofs). */
function reasonerReturning(text: string): StrategyReasoner {
  return {
    async reasonWithContext() {
      return { text, binding: { model: "stub", params: { thinking: "off" }, bindingId: "ARCH_REVIEW:primary:stub" } };
    },
  };
}

// ── (a) parser / fail-closed unit tests ──────────────────────────────────────────────────────────────────────

describe("parseStrategyOutput — FAIL-CLOSED (never a fabricated approach)", () => {
  it("θ is 0.6 and the seam version is pinned", () => {
    expect(STRATEGY_CONFIDENCE_FLOOR).toBe(0.6);
    expect(STRATEGY_PROMPT.seam_version).toBe("strategy/v1");
  });

  it("commits when approach + rationale present and confidence ≥ θ", () => {
    const r = parseStrategyOutput(envCommit(0.7, "reuse the existing engine"));
    expect(r.needs_clarification).toBe(false);
    expect(r.approach).toBe("reuse the existing engine");
    expect(r.rationale.length).toBeGreaterThan(0);
    expect(r.confidence).toBeCloseTo(0.7);
  });

  it("commits EXACTLY at the floor (confidence 0.60 ≥ θ)", () => {
    const r = parseStrategyOutput(envCommit(STRATEGY_CONFIDENCE_FLOOR, "do the thing"));
    expect(r.needs_clarification).toBe(false);
  });

  it("FAILS CLOSED just below the floor (confidence 0.59 ⇒ clarify), even with an approach", () => {
    const r = parseStrategyOutput(envCommit(0.59, "some approach"));
    expect(r.needs_clarification).toBe(true);
    expect(r.approach).toBe(""); // no fabricated strategy
    expect(r.rationale).toBe("");
    expect(r.confidence).toBeCloseTo(0.59); // carries the model's own confidence for the audit
  });

  it("FAILS CLOSED when the model asks to clarify (needs_clarification:true), even at high confidence", () => {
    const raw = JSON.stringify({ approach: "x", rationale: "y", risks: [{ claim: "unsure", source: "goal_contract:z" }], alternativesConsidered: ["a"], confidence: 0.95, needs_clarification: true });
    const r = parseStrategyOutput(raw);
    expect(r.needs_clarification).toBe(true);
    expect(r.approach).toBe("");
    expect(r.risks).toHaveLength(1); // cited risks survive
    expect(r.alternativesConsidered).toEqual(["a"]); // alternatives survive
  });

  it("FAILS CLOSED when approach or rationale is empty (nothing to commit to)", () => {
    expect(parseStrategyOutput(JSON.stringify({ approach: "", rationale: "why", confidence: 0.9, needs_clarification: false })).needs_clarification).toBe(true);
    expect(parseStrategyOutput(JSON.stringify({ approach: "how", rationale: "", confidence: 0.9, needs_clarification: false })).needs_clarification).toBe(true);
  });

  it("FAILS CLOSED on unparseable output (no JSON) ⇒ clarify, confidence 0, empty approach", () => {
    const r = parseStrategyOutput("I think we should probably just wing it?");
    expect(r).toMatchObject({ needs_clarification: true, approach: "", rationale: "", confidence: 0 });
  });

  it("recovers a JSON object wrapped in prose (model ignored the one-line instruction)", () => {
    const r = parseStrategyOutput(`Sure: ${envCommit(0.9, "reuse the engine")} — hope that helps`);
    expect(r.needs_clarification).toBe(false);
    expect(r.approach).toBe("reuse the engine");
  });

  it("DROPS uncited risks (I4: an uncited risk is unattributable) but keeps cited ones", () => {
    const raw = JSON.stringify({ approach: "a", rationale: "b", risks: [{ claim: "cited", source: "goal_contract:g" }, { claim: "uncited", source: "" }, { claim: "", source: "x" }], alternativesConsidered: [], confidence: 0.9, needs_clarification: false });
    const r = parseStrategyOutput(raw);
    expect(r.risks).toHaveLength(1);
    expect(r.risks[0]).toMatchObject({ claim: "cited", source: "goal_contract:g" });
  });

  it("clamps an out-of-range / non-finite confidence (defensive: never NaN, never > 1)", () => {
    expect(parseStrategyOutput(envCommit(5, "a")).confidence).toBe(1);
    // non-finite confidence ⇒ 0 ⇒ below floor ⇒ clarify
    const bad = JSON.stringify({ approach: "a", rationale: "b", confidence: "high", needs_clarification: false });
    expect(parseStrategyOutput(bad)).toMatchObject({ needs_clarification: true, confidence: 0 });
  });
});

// ── (b) formStrategy() — builds the versioned task, reasons, parses fail-closed ─────────────────────────────

describe("formStrategy() — reasons through the context-aware port (class ARCH_REVIEW), parses fail-closed", () => {
  it("builds a task that fences the goal and names the strategy fields (not a model)", () => {
    const task = STRATEGY_PROMPT.build("ship invoicing");
    expect(task).toContain("<<<ship invoicing>>>");
    expect(task).toContain("approach");
    expect(task).toContain("needs_clarification");
  });

  it("returns a committed strategy from a confident, complete model output", async () => {
    const r = await formStrategy("ship it", CTX, reasonerReturning(envCommit(0.9, "reuse the engine")));
    expect(r.needs_clarification).toBe(false);
    expect(r.approach).toBe("reuse the engine");
    expect(r.seamVersion).toBe("strategy/v1");
  });

  it("fails closed (needs_clarification) when the model returns garbage — never fabricates a strategy", async () => {
    const r = await formStrategy("ship it", CTX, reasonerReturning("¯\\_(ツ)_/¯ dunno"));
    expect(r).toMatchObject({ needs_clarification: true, approach: "", rationale: "" });
  });

  it("PROPAGATES a model INVOCATION error (a step failure is NOT 'needs clarification')", async () => {
    const failing: StrategyReasoner = { async reasonWithContext() { throw new Error("model_down"); } };
    await expect(formStrategy("anything", CTX, failing)).rejects.toThrow("model_down");
  });
});

// ── (c) the organ through a REAL context-aware ReasoningPort (assembled cited context) ─────────────────────

describe("strategy organ — through a REAL ContextAwareReasoningPort (context before cognition)", () => {
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

  it("(c1) assembles cited context, injects it AHEAD of the task, and parses a committed strategy", async () => {
    let seenPrompt = "";
    const goal = "ship the invoicing feature — the delivery engine exists and has precedent";
    const llm = new StubLlm((p) => { seenPrompt = p; return RESPONSES[goal]!; });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), sources());

    const r = await formStrategy(goal, CTX, port, "g-1");

    expect(r.needs_clarification).toBe(false);
    expect(seenPrompt).toContain("Assembled context");
    expect(seenPrompt).toContain("goal_contract:g-1");
    expect(seenPrompt.indexOf("Assembled context")).toBeLessThan(seenPrompt.indexOf(`<<<${goal}>>>`));
  });

  it("(c2) PROPAGATES ContextRequiredError when the consequential class has NO context (not a false strategy)", async () => {
    const emptySources: ContextSources = { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [fakeGoalSource("other")] };
    const llm = new StubLlm(() => { throw new Error("model must NOT be called on empty context"); });
    const port = new ContextAwareReasoningPort(new ReasoningPort(router, llm), emptySources);

    await expect(formStrategy("plan with no context", CTX, port)).rejects.toBeInstanceOf(ContextRequiredError);
  });
});

// ── (d) the golden suite gates through the eval harness ────────────────────────────────────────────────────

describe("STRATEGY golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite covering commit / clarify under ARCH_REVIEW", () => {
    const v = validateEvalSuite(STRATEGY_SUITE);
    expect(v.class).toBe("ARCH_REVIEW");
    expect(v.cases.length).toBeGreaterThanOrEqual(10);
    const commit = v.cases.filter((c) => (c.expected as { needs_clarification?: boolean }).needs_clarification === false);
    const clarify = v.cases.filter((c) => (c.expected as { needs_clarification?: boolean }).needs_clarification === true);
    expect(commit.length).toBeGreaterThanOrEqual(4);
    expect(clarify.length).toBeGreaterThanOrEqual(4);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    const report = await runSuite(STRATEGY_SUITE, { models: ["stub-strategy"], llm: scriptedLlm() });
    const row = modelResult(report, "stub-strategy")!;
    expect(row.failures).toEqual([]);
    expect(row.passRate).toBe(1);
    expect(passesGate(report, "stub-strategy")).toBe(true);
  });

  it("a model that ALWAYS commits (never clarifies) FAILS the gate (fail-closed accounting)", async () => {
    const overcommit = new StubLlm(() => JSON.stringify({ approach: "just do it", rationale: "why not", risks: [], alternativesConsidered: [], confidence: 0.99, needs_clarification: false }));
    const report = await runSuite(STRATEGY_SUITE, { models: ["overcommit"], llm: overcommit });
    expect(passesGate(report, "overcommit")).toBe(false);
  });
});
