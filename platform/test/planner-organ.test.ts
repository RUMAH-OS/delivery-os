// =============================================================================
// PLANNER ORGAN PROOF (P2 slice 5, roadmap G-21; I17 "intelligence measured, never assumed").
// =============================================================================
// Proves the OS's goal-decomposition organ END-TO-END for free (no real model, no network, no DB):
//   (a) the DAG VALIDATOR — accepts a valid DAG (chain, diamond, disjoint components); REJECTS a cycle, a
//       dangling dependency, and a duplicate id (never emits an invalid DAG);
//   (b) the parser / fail-closed logic — canned JSON in, typed plan out; unparseable / malformed-step /
//       op-direction-contradiction / cyclic / dangling / duplicate / empty / model-flagged / under-confidence
//       outputs REFUSE (needs_clarification, EMPTY steps) instead of emitting a broken/partial plan;
//   (c) the organ, driven through a context-aware reasoner double, plans FROM the (injected) context and
//       propagates a model INVOCATION error (a step failure is not "please clarify");
//   (d) the frozen PLAN suite + eval harness COMPOSE — replayed through runSuite with a scripted StubLlm and
//       the plan-shape scorer, a good model passes the gate (passesGate); a bad model fails it.
// Real-model scoring runs when a model is provisioned; this proves the MACHINERY + the fail-closed contract.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  plan,
  parsePlannerOutput,
  validateDag,
  computeDisjointSurfaces,
  PLANNER_PROMPT,
  PLAN_CONFIDENCE_FLOOR,
  type PlanStep,
  type PlanReasoner,
} from "../src/reasoning/organs/planner.js";
import type { ReasonWithContextResult } from "../src/reasoning/context/context-aware-port.js";
import { PLAN_SUITE, PLAN_SHAPE_SCORER } from "../src/reasoning/eval/suites/plan.suite.js";
import { validateEvalSuite } from "../src/reasoning/eval/eval-case.js";
import { runSuite, modelResult } from "../src/reasoning/eval/eval-runner.js";
import { passesGate } from "../src/reasoning/eval/eval-gate.js";

const CTX = { requestId: "planner-test-req-1" };

/** Build a step with sane defaults so a test names only the fields it cares about. */
function step(id: string, dependsOn: string[] = [], over: Partial<PlanStep> = {}): PlanStep {
  return { id, op: ">=", target: `t-${id}`, direction: "increase", dependsOn, ...over };
}

// ── (a) the DAG validator — the structural heart of "never emit an invalid DAG" ─────────────────────────

describe("validateDag — accepts valid DAGs, rejects cycles / dangling / duplicate ids", () => {
  it("accepts a single root step (no edges)", () => {
    expect(validateDag([step("s1")])).toEqual({ valid: true });
  });

  it("accepts a linear chain s1 -> s2 -> s3", () => {
    expect(validateDag([step("s1"), step("s2", ["s1"]), step("s3", ["s2"])]).valid).toBe(true);
  });

  it("accepts a diamond (fan-out + fan-in) — a real DAG, not just a chain", () => {
    const steps = [step("s1"), step("s2", ["s1"]), step("s3", ["s1"]), step("s4", ["s2", "s3"])];
    expect(validateDag(steps).valid).toBe(true);
  });

  it("accepts two DISJOINT components (independent workstreams)", () => {
    const steps = [step("a1"), step("a2", ["a1"]), step("b1"), step("b2", ["b1"])];
    expect(validateDag(steps).valid).toBe(true);
  });

  it("REJECTS a duplicate step id (a DAG node id must be unique)", () => {
    const v = validateDag([step("s1"), step("s1")]);
    expect(v.valid).toBe(false);
    expect(v.valid === false && v.reason).toBe("duplicate-step-id");
  });

  it("REJECTS a dangling dependency (an edge to an id no step defines)", () => {
    const v = validateDag([step("s1"), step("s2", ["ghost"])]);
    expect(v.valid).toBe(false);
    expect(v.valid === false && v.reason).toBe("dangling-dependency");
  });

  it("REJECTS a 2-cycle s1 <-> s2", () => {
    const v = validateDag([step("s1", ["s2"]), step("s2", ["s1"])]);
    expect(v.valid).toBe(false);
    expect(v.valid === false && v.reason).toBe("cycle");
  });

  it("REJECTS a longer cycle s1 -> s2 -> s3 -> s1", () => {
    const v = validateDag([step("s1", ["s3"]), step("s2", ["s1"]), step("s3", ["s2"])]);
    expect(v.valid === false && v.reason).toBe("cycle");
  });

  it("REJECTS a self-loop (s1 depends on itself)", () => {
    expect(validateDag([step("s1", ["s1"])]).valid).toBe(false);
  });
});

describe("computeDisjointSurfaces — weakly-connected components, deterministic", () => {
  it("one connected chain ⇒ one surface", () => {
    const s = computeDisjointSurfaces([step("s1", [], { target: "z" }), step("s2", ["s1"], { target: "a" })]);
    expect(s).toEqual(["a"]); // labelled by the lexicographically-first target in the component
  });

  it("two independent components ⇒ two surfaces, sorted + deduped", () => {
    const steps = [step("a1", [], { target: "api" }), step("a2", ["a1"], { target: "api" }), step("b1", [], { target: "email" })];
    expect(computeDisjointSurfaces(steps)).toEqual(["api", "email"]);
  });

  it("a fan-in unifies its inputs into ONE surface", () => {
    const steps = [step("s1", [], { target: "x" }), step("s2", [], { target: "y" }), step("s3", ["s1", "s2"], { target: "z" })];
    expect(computeDisjointSurfaces(steps)).toEqual(["x"]); // all one component ⇒ first target
  });
});

// ── (b) the parser / fail-closed unit tests — never emit a broken/partial plan ──────────────────────────

/** A confident, valid two-step plan envelope (a good model's output). */
const GOOD_PLAN = JSON.stringify({
  steps: [
    { id: "s1", op: ">=", target: "schema-migrated", direction: "increase", dependsOn: [] },
    { id: "s2", op: "==", target: "rows-preserved", direction: "increase", dependsOn: ["s1"] },
  ],
  disjointSurfaces: ["schema-migrated"],
  confidence: 0.9,
  needs_clarification: false,
});

describe("parsePlannerOutput — typed parse + FAIL-CLOSED (never a broken/partial DAG)", () => {
  it("parses a well-formed, confident, VALID plan into the typed DAG + derived surfaces", () => {
    const p = parsePlannerOutput(GOOD_PLAN);
    expect(p.via).toBe("reasoning");
    expect(p.needs_clarification).toBe(false);
    expect(p.steps.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(p.steps[1]!.dependsOn).toEqual(["s1"]);
    expect(p.disjointSurfaces).toEqual(["rows-preserved"]); // derived from the DAG, not the model's claim
    expect(p.confidence).toBeCloseTo(0.9);
    expect(p.seamVersion).toBe(PLANNER_PROMPT.seam_version);
    expect(p.reason).toBeUndefined();
  });

  it("recovers a JSON object wrapped in prose (model ignored the one-line instruction)", () => {
    const p = parsePlannerOutput(`Here is the plan: ${GOOD_PLAN} — hope that helps!`);
    expect(p.via).toBe("reasoning");
    expect(p.steps).toHaveLength(2);
  });

  it("treats an ABSENT dependsOn as a root step (defaults to [])", () => {
    const p = parsePlannerOutput(JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase" }], confidence: 0.9 }));
    expect(p.via).toBe("reasoning");
    expect(p.steps[0]!.dependsOn).toEqual([]);
  });

  const failCases: Array<{ name: string; raw: string; reason: string }> = [
    { name: "unparseable (no JSON)", raw: "I'd start by looking at the billing code.", reason: "unparseable-output" },
    { name: "JSON array, not an object", raw: "[1,2,3]", reason: "unparseable-output" },
    { name: "steps not an array", raw: JSON.stringify({ steps: "soon", confidence: 0.9 }), reason: "steps-not-array" },
    { name: "empty plan (confident but zero steps)", raw: JSON.stringify({ steps: [], confidence: 0.9 }), reason: "empty-plan" },
    { name: "off-enum op", raw: JSON.stringify({ steps: [{ id: "s1", op: "~=", target: "x", direction: "increase", dependsOn: [] }], confidence: 0.9 }), reason: "step-malformed" },
    { name: "off-enum direction", raw: JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "sideways", dependsOn: [] }], confidence: 0.9 }), reason: "step-malformed" },
    { name: "blank target", raw: JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "  ", direction: "increase", dependsOn: [] }], confidence: 0.9 }), reason: "step-malformed" },
    { name: "blank id", raw: JSON.stringify({ steps: [{ id: "", op: ">=", target: "x", direction: "increase", dependsOn: [] }], confidence: 0.9 }), reason: "step-malformed" },
    { name: "op/direction contradiction (<= with increase)", raw: JSON.stringify({ steps: [{ id: "s1", op: "<=", target: "x", direction: "increase", dependsOn: [] }], confidence: 0.9 }), reason: "op-direction-contradiction" },
    { name: "duplicate step id", raw: JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase", dependsOn: [] }, { id: "s1", op: ">=", target: "y", direction: "increase", dependsOn: [] }], confidence: 0.9 }), reason: "duplicate-step-id" },
    { name: "dangling dependency", raw: JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase", dependsOn: ["ghost"] }], confidence: 0.9 }), reason: "dangling-dependency" },
    { name: "cycle", raw: JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase", dependsOn: ["s2"] }, { id: "s2", op: ">=", target: "y", direction: "increase", dependsOn: ["s1"] }], confidence: 0.9 }), reason: "cycle" },
    { name: "model-flagged clarification", raw: JSON.stringify({ steps: [], confidence: 0.2, needs_clarification: true }), reason: "model-flagged-clarification" },
  ];

  for (const c of failCases) {
    it(`FAILS CLOSED on ${c.name} → refuses (empty steps), never a broken DAG`, () => {
      const p = parsePlannerOutput(c.raw);
      expect(p.needs_clarification).toBe(true);
      expect(p.via).toBe("fail-closed");
      expect(p.steps).toEqual([]);
      expect(p.disjointSurfaces).toEqual([]);
      expect(p.reason).toBe(c.reason);
    });
  }

  it("FAILS CLOSED below the confidence floor even when the DAG is valid (vague ⇒ refuse)", () => {
    const under = PLAN_CONFIDENCE_FLOOR - 0.1;
    const raw = JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase", dependsOn: [] }], confidence: under });
    const p = parsePlannerOutput(raw);
    expect(p).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "below-confidence-floor", steps: [] });
    expect(p.confidence).toBeCloseTo(under);
  });

  it("accepts exactly at the confidence floor (>= floor is confident)", () => {
    const raw = JSON.stringify({ steps: [{ id: "s1", op: ">=", target: "x", direction: "increase", dependsOn: [] }], confidence: PLAN_CONFIDENCE_FLOOR });
    expect(parsePlannerOutput(raw).via).toBe("reasoning");
  });

  it("honors op:'==' with EITHER declared direction (gap-closing is non-contradictory)", () => {
    for (const direction of ["increase", "decrease"] as const) {
      const raw = JSON.stringify({ steps: [{ id: "s1", op: "==", target: "x", direction, dependsOn: [] }], confidence: 0.9 });
      expect(parsePlannerOutput(raw).via).toBe("reasoning");
    }
  });
});

// ── (c) the organ — plans through a context-aware reasoner double; propagates invocation errors ──────────

/** A PlanReasoner double that returns fixed model text as if it had assembled+injected context. */
function reasonerReturning(text: string): PlanReasoner & { seenTask?: string } {
  const dbl: PlanReasoner & { seenTask?: string } = {
    async reasonWithContext(req): Promise<ReasonWithContextResult> {
      dbl.seenTask = req.task;
      return { text, binding: { model: "stub", params: { thinking: "high" }, bindingId: "PLAN:primary:stub" } };
    },
  };
  return dbl;
}

describe("plan() — builds the versioned task, reasons WITH context, parses fail-closed", () => {
  it("builds a task that fences the goal, enumerates the enums, and names the class (not a model)", () => {
    const task = PLANNER_PROMPT.build("ship invoicing");
    expect(task).toContain("<<<ship invoicing>>>");
    expect(task).toContain(">=");
    expect(task).toContain("increase");
    expect(task).toContain("dependsOn");
    expect(PLANNER_PROMPT.seam_version).toBe("planner/v1");
  });

  it("returns a typed VALID plan from a confident model output, passing goalId through", async () => {
    const reasoner = reasonerReturning(GOOD_PLAN);
    const p = await plan("migrate customers then verify", CTX, reasoner, "g-42");
    expect(p.via).toBe("reasoning");
    expect(p.steps).toHaveLength(2);
    expect(reasoner.seenTask).toContain("<<<migrate customers then verify>>>");
  });

  it("fails closed (needs_clarification) when the model returns garbage — never fabricates a plan", async () => {
    const p = await plan("do something", CTX, reasonerReturning("¯\\_(ツ)_/¯"));
    expect(p).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "unparseable-output", steps: [] });
  });

  it("propagates a model INVOCATION error (a step failure is not 'please clarify')", async () => {
    const failing: PlanReasoner = { async reasonWithContext() { throw new Error("model_down"); } };
    await expect(plan("anything", CTX, failing)).rejects.toThrow("model_down");
  });
});

// ── (d) the golden suite gates through the eval harness ──────────────────────────────────────────────────

const REFUSE = JSON.stringify({ steps: [], disjointSurfaces: [], confidence: 0.2, needs_clarification: true });

/** Full canned plan envelopes per golden goal — the JSON a good PLAN model would emit. Keyed by goal so the
 *  same script drives both the eval runner (raw goal prompt) and any organ path (fenced goal). */
const RESPONSES: Record<string, string> = {
  "raise unit-test coverage on the billing module to 90%": planJson([["s1", ">=", "billing-coverage", "increase", []]]),
  "ship the invoicing feature end to end": planJson([["s1", ">=", "schema", "increase", []], ["s2", ">=", "api", "increase", ["s1"]], ["s3", ">=", "ui", "increase", ["s2"]]]),
  "migrate the customers table to the new schema then verify no rows lost": planJson([["s1", ">=", "schema-migrated", "increase", []], ["s2", "==", "rows-preserved", "increase", ["s1"]]]),
  "build the API and the SPA, then wire them and deploy": planJson([["s1", ">=", "api", "increase", []], ["s2", ">=", "spa", "increase", []], ["s3", ">=", "wired", "increase", ["s1", "s2"]], ["s4", ">=", "deployed", "increase", ["s3"]]]),
  "cut over to the new payments provider with a rehearsal and a rollback path": planJson([["s1", ">=", "rehearsal", "increase", []], ["s2", ">=", "rollback-path", "increase", []], ["s3", ">=", "cutover", "increase", ["s1", "s2"]]]),
  "improve CI speed and separately reduce the onboarding email bounce rate": planJson([["s1", "<=", "ci-time", "decrease", []], ["s2", "<=", "email-bounce", "decrease", []]]),
  "bring the p95 checkout latency down below 300ms": planJson([["s1", "<", "checkout-p95", "decrease", []]]),
  "grow weekly active users above 1000": planJson([["s1", ">", "wau", "increase", []]]),
  "harden the deploy pipeline: add tests, add a canary, add rollback, and add alerting": planJson([["s1", ">=", "tests", "increase", []], ["s2", ">=", "canary", "increase", ["s1"]], ["s3", ">=", "rollback", "increase", ["s1"]], ["s4", ">=", "alerting", "increase", ["s2", "s3"]]]),
  "reduce the monthly infra bill without dropping any customer-facing SLA": planJson([["s1", "<=", "infra-bill", "decrease", []], ["s2", ">=", "sla", "increase", ["s1"]]]),
  // vague → the model refuses (needs_clarification:true, empty steps)
  "make it better": REFUSE,
  "do the needful": REFUSE,
  "fix everything that's wrong": REFUSE,
  "just sort it out": REFUSE,
};

type StepTuple = [id: string, op: string, target: string, direction: string, dependsOn: string[]];

/** Assemble a confident PLAN envelope from step tuples (disjointSurfaces is cosmetic; the organ derives its own). */
function planJson(steps: StepTuple[]): string {
  return JSON.stringify({
    steps: steps.map(([id, op, target, direction, dependsOn]) => ({ id, op, target, direction, dependsOn })),
    disjointSurfaces: [],
    confidence: 0.9,
    needs_clarification: false,
  });
}

/** A StubLlm scripted from RESPONSES. Recovers the goal from either the raw prompt (runner) or a fenced prompt. */
function scriptedLlm(): StubLlm {
  return new StubLlm((prompt) => {
    const fenced = prompt.match(/<<<([\s\S]*?)>>>/);
    const key = fenced ? fenced[1]! : prompt;
    const out = RESPONSES[key];
    if (out === undefined) throw new Error(`no canned plan for goal: ${JSON.stringify(key)}`);
    return out;
  });
}

describe("PLAN golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite with vague/refusal coverage", () => {
    const v = validateEvalSuite(PLAN_SUITE);
    expect(v.class).toBe("PLAN");
    expect(v.cases.length).toBeGreaterThanOrEqual(10);
    const vague = v.cases.filter((c) => (c.expected as { needs_clarification?: boolean }).needs_clarification === true);
    expect(vague.length).toBeGreaterThanOrEqual(3);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    const report = await runSuite(PLAN_SUITE, { models: ["stub-plan"], llm: scriptedLlm(), scorers: { "plan-shape": PLAN_SHAPE_SCORER } });
    const row = modelResult(report, "stub-plan")!;
    expect(row.failures).toEqual([]); // every golden matched its expected shape
    expect(row.passRate).toBe(1);
    expect(passesGate(report, "stub-plan")).toBe(true); // green on the frozen suite ⇒ adoptable
  });

  it("a model that emits an INVALID DAG (a cycle) FAILS the gate (fail-closed accounting)", async () => {
    // A model that always returns a 2-cycle never produces a valid DAG → validDag:false everywhere → gate red.
    const cyclic = new StubLlm(() => JSON.stringify({
      steps: [{ id: "a", op: ">=", target: "x", direction: "increase", dependsOn: ["b"] }, { id: "b", op: ">=", target: "y", direction: "increase", dependsOn: ["a"] }],
      confidence: 0.9, needs_clarification: false,
    }));
    const report = await runSuite(PLAN_SUITE, { models: ["cyclic"], llm: cyclic, scorers: { "plan-shape": PLAN_SHAPE_SCORER } });
    expect(passesGate(report, "cyclic")).toBe(false);
  });
});
