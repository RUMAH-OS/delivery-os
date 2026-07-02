// =============================================================================
// REASONING PIPELINE PROOF (P2 slice 8, roadmap G-24; the PO as a THIN ORCHESTRATOR that composes organs).
// =============================================================================
// Proves the §10 reasoning loop END-TO-END for free (no real model, no network, no DB), with INJECTED stub
// organs so every branch + short-circuit is deterministic:
//   (a) SHORT-CIRCUITS on classify needs_clarification — does NOT plan on ambiguity (halts at classify);
//   (b) STOPS + narrates the CITED blockers on an unreachable goal — does NOT plan an unreachable goal (halts at reachability);
//   (c) REACHES the plan on a clear, reachable goal (runs to completion, narrates the plan);
//   (d) records a COMPLETE, CITED trace — every organ's output, in order, with timings;
//   (e) honors the planner's OWN fail-closed refusal (halts at plan) + acknowledges a non-consequential utterance;
//   (f) a model INVOCATION error inside an organ PROPAGATES (the thin orchestrator adds no judgment);
//   (g) the REAL default organs (defaultReasoningOrgans) wire through the real ports and drive the loop.
// Deliverable (e) "narrator falls back to template on empty model output" is proven in narrator-organ.test.ts.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  runReasoning,
  defaultReasoningOrgans,
  isConsequentialIntent,
  NOOP_EXECUTOR,
  type ReasoningOrgans,
} from "../src/reasoning/pipeline/reasoning-pipeline.js";
import { renderOutcomeTemplate, type ReasoningOutcome } from "../src/reasoning/organs/narrator.js";
import type {
  IntakeClassification,
  Lane,
  Consequentiality,
} from "../src/reasoning/organs/intake-classifier.js";
import type { ReachabilityVerdict } from "../src/reasoning/organs/reachability.js";
import type { PlanResult, PlanStep } from "../src/reasoning/organs/planner.js";
import { ReasoningPort } from "../src/reasoning/reasoning-port.js";
import { ModelRouter } from "../src/reasoning/model-router.js";
import { loadRoutingConfig } from "../src/reasoning/routing-config.js";
import { ContextAwareReasoningPort } from "../src/reasoning/context/context-aware-port.js";
import { EMPTY_KNOWLEDGE_PORT, type ContextSources } from "../src/reasoning/context/context-assembler.js";
import type { InvestigateSource, KnowledgeItem, KnowledgePort } from "../src/reasoning/context/context-brief.js";

const CTX = { requestId: "pipeline-test-req-1" };

// ── Typed organ-output builders (the shapes the real organs emit). ──────────────────────────────────────────

function classification(over: Partial<IntakeClassification> = {}): IntakeClassification {
  return {
    intent: "unknown",
    lane: "build" as Lane,
    consequentiality: "medium" as Consequentiality,
    reversibility: "reversible",
    confidence: 0.9,
    needs_clarification: false,
    via: "reasoning",
    seamVersion: "intake-classifier/v1",
    ...over,
  };
}
function reachable(over: Partial<ReachabilityVerdict> = {}): ReachabilityVerdict {
  return { reachable: true, confidence: 0.9, blockers: [], seamVersion: "reachability/v1", via: "reasoning", ...over };
}
const DAG: readonly PlanStep[] = [
  { id: "s1", op: ">=", target: "invoice schema", direction: "increase", dependsOn: [] },
  { id: "s2", op: ">=", target: "invoice API", direction: "increase", dependsOn: ["s1"] },
];
function plannedOk(over: Partial<PlanResult> = {}): PlanResult {
  return {
    steps: DAG,
    disjointSurfaces: ["invoice schema"],
    confidence: 0.9,
    needs_clarification: false,
    via: "reasoning",
    seamVersion: "planner/v1",
    ...over,
  };
}

/** A recording narrate stub: captures each outcome it was asked to phrase, returns the deterministic template. */
function recorder() {
  const seen: ReasoningOutcome[] = [];
  const narrate = async (outcome: ReasoningOutcome): Promise<string> => {
    seen.push(outcome);
    return renderOutcomeTemplate(outcome);
  };
  return { seen, narrate };
}

/** Assemble a stub organ set from parts, with call-counters so we can assert a downstream organ was NOT reached. */
function stubOrgans(parts: {
  classify: IntakeClassification | (() => Promise<IntakeClassification>);
  reach?: ReachabilityVerdict;
  plan?: PlanResult;
  narrate: (outcome: ReasoningOutcome) => Promise<string>;
}): { organs: ReasoningOrgans; calls: { reach: number; plan: number } } {
  const calls = { reach: 0, plan: 0 };
  const organs: ReasoningOrgans = {
    classify: async () => (typeof parts.classify === "function" ? parts.classify() : parts.classify),
    evaluateReachability: async () => {
      calls.reach++;
      return parts.reach ?? reachable();
    },
    plan: async () => {
      calls.plan++;
      return parts.plan ?? plannedOk();
    },
    narrate: (outcome) => parts.narrate(outcome),
    executor: NOOP_EXECUTOR,
  };
  return { organs, calls };
}

// ── (a) SHORT-CIRCUIT on needs_clarification — never plan on ambiguity ──────────────────────────────────────

describe("runReasoning — (a) short-circuits on classify needs_clarification (no planning on ambiguity)", () => {
  it("halts at classify, narrates a clarify reply, and NEVER calls reachability or plan", async () => {
    const rec = recorder();
    const { organs, calls } = stubOrgans({
      classify: classification({ needs_clarification: true, via: "fail-closed", reason: "below-confidence-floor", intent: "unknown", lane: null, consequentiality: null, reversibility: null, confidence: 0.3 }),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "do the thing", ctx: CTX, organs });

    expect(trace.haltedAt).toBe("classify");
    expect(trace.needsClarification).toBe(true);
    expect(calls.reach).toBe(0);
    expect(calls.plan).toBe(0);
    expect(rec.seen[0]).toMatchObject({ kind: "clarification", utterance: "do the thing", reason: "below-confidence-floor" });
    expect(trace.stages.map((s) => s.organ)).toEqual(["classify", "narrate"]);
  });
});

// ── (b) STOP + narrate blockers on an unreachable goal — never plan an unreachable goal ─────────────────────

describe("runReasoning — (b) stops + narrates cited blockers on an unreachable goal (no planning)", () => {
  it("halts at reachability, narrates the CITED blockers, and NEVER calls plan", async () => {
    const rec = recorder();
    const blockers = [{ claim: "no lever in the timebox", source: "goal_contract:levers" }];
    const { organs, calls } = stubOrgans({
      classify: classification({ lane: "build", consequentiality: "high", intent: "create_goal" }),
      reach: reachable({ reachable: false, via: "fail-closed", reason: "below-confidence-floor", blockers }),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "double revenue by tomorrow", ctx: CTX, organs });

    expect(trace.haltedAt).toBe("reachability");
    expect(trace.needsClarification).toBeUndefined();
    expect(calls.plan).toBe(0);
    expect(rec.seen[0]).toMatchObject({ kind: "blocked", goal: "double revenue by tomorrow", blockers });
    expect(trace.finalReply).toContain("no lever in the timebox"); // the cited blocker reaches the founder
    expect(trace.stages.map((s) => s.organ)).toEqual(["classify", "reachability", "narrate"]);
  });
});

// ── (c) REACH the plan on a clear, reachable goal ───────────────────────────────────────────────────────────

describe("runReasoning — (c) reaches the plan on a clear, reachable goal", () => {
  it("runs to completion (no halt), narrates the plan with its steps + surfaces", async () => {
    const rec = recorder();
    const { organs, calls } = stubOrgans({
      classify: classification({ lane: "build", consequentiality: "medium", intent: "create_goal" }),
      reach: reachable(),
      plan: plannedOk(),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "ship the invoicing feature", goalId: "g-1", ctx: CTX, organs });

    expect(trace.haltedAt).toBeUndefined(); // reached the end of the loop
    expect(trace.needsClarification).toBeUndefined();
    expect(calls.reach).toBe(1);
    expect(calls.plan).toBe(1);
    expect(rec.seen[0]).toMatchObject({
      kind: "planned",
      goal: "ship the invoicing feature",
      steps: [
        { id: "s1", target: "invoice schema" },
        { id: "s2", target: "invoice API" },
      ],
    });
    expect(trace.finalReply).toContain("invoice API");
  });
});

// ── (d) a COMPLETE, CITED trace ─────────────────────────────────────────────────────────────────────────────

describe("runReasoning — (d) records a complete, cited, inspectable trace", () => {
  it("records every organ in order with its typed output and a timing", async () => {
    const rec = recorder();
    // Deterministic clock: +1ms per read, so each stage's ms is a positive, inspectable integer.
    let t = 0;
    const now = () => (t += 1);
    const { organs } = stubOrgans({
      classify: classification({ lane: "build", consequentiality: "medium" }),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "ship it", ctx: CTX, organs, now });

    expect(trace.stages.map((s) => s.organ)).toEqual(["classify", "reachability", "plan", "narrate"]);
    // classify stage cites the classification; reachability cites the verdict; plan cites the DAG.
    expect((trace.stages[0]!.output as IntakeClassification).via).toBe("reasoning");
    expect((trace.stages[1]!.output as ReachabilityVerdict).reachable).toBe(true);
    expect((trace.stages[2]!.output as PlanResult).steps).toHaveLength(2);
    expect(trace.stages[3]!.output).toBe(trace.finalReply); // the narrate stage's output IS the final reply
    for (const s of trace.stages) expect(s.ms).toBeGreaterThan(0);
  });
});

// ── (e) planner's OWN fail-closed refusal + non-consequential acknowledgement ───────────────────────────────

describe("runReasoning — (e) honors the planner refusal + acknowledges a non-consequential utterance", () => {
  it("halts at plan (needsClarification) when the planner refuses a too-vague goal", async () => {
    const rec = recorder();
    const { organs } = stubOrgans({
      classify: classification({ lane: "build", consequentiality: "medium" }),
      reach: reachable(),
      plan: plannedOk({ steps: [], disjointSurfaces: [], needs_clarification: true, via: "fail-closed", reason: "empty-plan" }),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "make it better", ctx: CTX, organs });

    expect(trace.haltedAt).toBe("plan");
    expect(trace.needsClarification).toBe(true);
    expect(rec.seen[0]).toMatchObject({ kind: "clarification", reason: "empty-plan" });
  });

  it("acknowledges a non-consequential utterance (no reachability, no plan)", async () => {
    const rec = recorder();
    const { organs, calls } = stubOrgans({
      classify: classification({ lane: "investigate", consequentiality: "low", intent: "morning_digest" }),
      narrate: rec.narrate,
    });

    const trace = await runReasoning({ utterance: "show me a status digest", ctx: CTX, organs });

    expect(trace.haltedAt).toBeUndefined();
    expect(calls.reach).toBe(0);
    expect(calls.plan).toBe(0);
    expect(rec.seen[0]).toMatchObject({ kind: "acknowledged", intent: "morning_digest", lane: "investigate" });
    expect(trace.stages.map((s) => s.organ)).toEqual(["classify", "narrate"]);
  });

  it("isConsequentialIntent: build OR medium/high ⇒ consequential; low investigate/operate ⇒ not", () => {
    expect(isConsequentialIntent(classification({ lane: "build", consequentiality: "low" }))).toBe(true);
    expect(isConsequentialIntent(classification({ lane: "investigate", consequentiality: "high" }))).toBe(true);
    expect(isConsequentialIntent(classification({ lane: "operate", consequentiality: "medium" }))).toBe(true);
    expect(isConsequentialIntent(classification({ lane: "investigate", consequentiality: "low" }))).toBe(false);
  });
});

// ── (f) a model INVOCATION error inside an organ PROPAGATES (the thin orchestrator adds no judgment) ────────

describe("runReasoning — (f) an organ invocation error PROPAGATES (not swallowed into a decision)", () => {
  it("propagates a classify model error", async () => {
    const rec = recorder();
    const { organs } = stubOrgans({
      classify: async () => {
        throw new Error("model_down");
      },
      narrate: rec.narrate,
    });
    await expect(runReasoning({ utterance: "x", ctx: CTX, organs })).rejects.toThrow("model_down");
  });
});

// ── (g) the REAL default organs wire through the real ports and drive the loop ──────────────────────────────

describe("runReasoning — (g) defaultReasoningOrgans wires the REAL organs through the real ports", () => {
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

  /** A StubLlm scripted by INSPECTING which organ's prompt is calling (each organ's prompt is distinctive). */
  function organAwareLlm(): StubLlm {
    return new StubLlm((prompt) => {
      if (prompt.includes("intake classifier")) {
        return JSON.stringify({ intent: "create_goal", lane: "build", consequentiality: "medium", reversibility: "reversible", confidence: 0.95, needs_clarification: false });
      }
      if (prompt.includes("reachability evaluator")) {
        return JSON.stringify({ reachable: true, confidence: 0.95, uncertain: false, blockers: [] });
      }
      if (prompt.includes("Decompose the GOAL")) {
        return JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "invoice API", direction: "increase", dependsOn: [] }], disjointSurfaces: ["invoice API"], confidence: 0.95, needs_clarification: false });
      }
      // NARRATE (the narrator persona) — phrase the plan.
      return "I've planned the invoicing feature into one step.";
    });
  }

  it("drives classify → reachability → plan → narrate through the REAL organs + real ports", async () => {
    const llm = organAwareLlm();
    const reasoningPort = new ReasoningPort(router, llm);
    const contextPort = new ContextAwareReasoningPort(reasoningPort, sources());
    const organs = defaultReasoningOrgans({ reasoner: reasoningPort, contextReasoner: contextPort });

    const trace = await runReasoning({ utterance: "ship the invoicing feature", goalId: "g-1", ctx: CTX, organs });

    expect(trace.haltedAt).toBeUndefined();
    expect(trace.stages.map((s) => s.organ)).toEqual(["classify", "reachability", "plan", "narrate"]);
    expect((trace.stages[2]!.output as PlanResult).steps).toHaveLength(1);
    expect(trace.finalReply).toContain("invoicing");
  });

  it("halts at classify (real organs) when the classifier fails closed — CLASSIFY+NARRATE need no context", async () => {
    // The classifier refuses ⇒ the loop halts before any context-requiring organ, so empty sources are fine.
    const llm = new StubLlm((prompt) => {
      if (prompt.includes("intake classifier")) return JSON.stringify({ needs_clarification: true, confidence: 0.2 });
      return "Could you clarify what you'd like me to do?";
    });
    const reasoningPort = new ReasoningPort(router, llm);
    const contextPort = new ContextAwareReasoningPort(reasoningPort, { knowledge: EMPTY_KNOWLEDGE_PORT, investigators: [] });
    const organs = defaultReasoningOrgans({ reasoner: reasoningPort, contextReasoner: contextPort });

    const trace = await runReasoning({ utterance: "do the thing", ctx: CTX, organs });

    expect(trace.haltedAt).toBe("classify");
    expect(trace.needsClarification).toBe(true);
    expect(trace.finalReply.toLowerCase()).toContain("clarify");
  });
});
