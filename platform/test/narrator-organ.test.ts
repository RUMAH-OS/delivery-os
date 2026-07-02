// =============================================================================
// NARRATE ORGAN PROOF (P2 slice 8, roadmap G-24; O12 compose the founder-facing reply).
// =============================================================================
// Proves the OS's NARRATE organ END-TO-END for free (no real model, no network, no DB):
//   (a) the deterministic TEMPLATE FLOOR — renderOutcomeTemplate renders EACH outcome kind from its OWN fields
//       and NEVER fabricates content not in the outcome;
//   (b) narrate() through a reasoner double — a usable model reply is returned as-is (phrasing, not deciding);
//   (c) FAIL-CLOSED: on EMPTY / whitespace / degenerate model output narrate falls back to the template floor;
//   (d) FAIL-CLOSED: a model INVOCATION error also falls back to the template (never lose the decided message);
//   (e) NARRATE is a CHEAP class — the organ reasons through reasonWithContext naming the class NARRATE (never a model);
//   (f) the frozen NARRATE suite composes with the eval harness and GATES (runSuite + passesGate).
// Real-model scoring runs when a model is provisioned; this proves the MACHINERY + the fail-closed contract.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  narrate,
  renderOutcomeTemplate,
  isUsableNarration,
  NARRATOR_PROMPT,
  NARRATION_MIN_CHARS,
  type ReasoningOutcome,
  type NarrateReasoner,
} from "../src/reasoning/organs/narrator.js";
import { NARRATOR_SUITE } from "../src/reasoning/eval/suites/narrator.suite.js";
import { validateEvalSuite } from "../src/reasoning/eval/eval-case.js";
import { runSuite } from "../src/reasoning/eval/eval-runner.js";
import { passesGate } from "../src/reasoning/eval/eval-gate.js";

const CTX = { requestId: "narrator-test-req-1" };

/** A NarrateReasoner double that returns a fixed model text (for isolated organ proofs). */
function reasonerReturning(text: string): NarrateReasoner {
  return {
    async reasonWithContext(req) {
      // The organ must name the class NARRATE and never a model — assert it in-line so the contract is proven.
      expect(req.class).toBe("NARRATE");
      return { text, binding: { model: "stub", params: { thinking: "off" }, bindingId: "NARRATE:primary:stub" } };
    },
  };
}

/** A NarrateReasoner double whose model invocation always fails (proves the invocation-error fallback). */
const failingReasoner: NarrateReasoner = {
  async reasonWithContext() {
    throw new Error("model_down");
  },
};

// Representative outcomes, one per union kind.
const PLANNED: ReasoningOutcome = {
  kind: "planned",
  goal: "ship the invoicing feature",
  steps: [
    { id: "s1", target: "invoice schema", op: ">=", direction: "increase" },
    { id: "s2", target: "invoice API", op: ">=", direction: "increase" },
  ],
  disjointSurfaces: ["invoice API", "invoice schema"],
};
const BLOCKED: ReasoningOutcome = {
  kind: "blocked",
  goal: "double revenue by tomorrow",
  blockers: [{ claim: "no lever available in the timebox", source: "goal_contract:levers" }],
};
const CLARIFY: ReasoningOutcome = { kind: "clarification", utterance: "do the thing", reason: "below-confidence-floor" };
const REVIEWED: ReasoningOutcome = {
  kind: "reviewed",
  goal: "add a health endpoint",
  verdict: "needs_work",
  findings: [{ lens: "completeness-vs-acceptance", met: false, finding: "no test covers the endpoint" }],
};
const ACK: ReasoningOutcome = { kind: "acknowledged", utterance: "show me a status digest", intent: "digest", lane: "investigate" };

// ── (a) the deterministic TEMPLATE FLOOR — renders each kind from its OWN fields, fabricates nothing ─────────

describe("renderOutcomeTemplate — deterministic floor, renders ONLY the outcome's own fields", () => {
  it("planned: names the goal, the step count, the step targets, and the surfaces", () => {
    const out = renderOutcomeTemplate(PLANNED);
    expect(out).toContain("ship the invoicing feature");
    expect(out).toContain("invoice schema");
    expect(out).toContain("invoice API");
    expect(out).toContain("2 step");
  });

  it("blocked: names the goal, says NOT reachable, and lists the cited blocker", () => {
    const out = renderOutcomeTemplate(BLOCKED);
    expect(out).toContain("double revenue by tomorrow");
    expect(out).toContain("isn't reachable");
    expect(out).toContain("no lever available in the timebox");
    expect(out).toContain("goal_contract:levers");
  });

  it("clarification: echoes the utterance + reason and ASKS to clarify", () => {
    const out = renderOutcomeTemplate(CLARIFY);
    expect(out).toContain("do the thing");
    expect(out).toContain("below-confidence-floor");
    expect(out.toLowerCase()).toContain("clarify");
  });

  it("reviewed: carries the verdict and the lens finding", () => {
    const out = renderOutcomeTemplate(REVIEWED);
    expect(out).toContain("needs_work");
    expect(out).toContain("completeness-vs-acceptance");
    expect(out).toContain("NOT met");
  });

  it("acknowledged: acknowledges the utterance, intent, and lane", () => {
    const out = renderOutcomeTemplate(ACK);
    expect(out).toContain("Understood");
    expect(out).toContain("show me a status digest");
    expect(out).toContain("investigate");
  });

  it("NEVER fabricates: an empty-blockers blocked outcome does not invent a blocker", () => {
    const out = renderOutcomeTemplate({ kind: "blocked", goal: "g", blockers: [] });
    expect(out).toContain("no specific blocker was cited");
  });

  it("is deterministic (same outcome ⇒ byte-identical message)", () => {
    expect(renderOutcomeTemplate(PLANNED)).toBe(renderOutcomeTemplate(PLANNED));
  });
});

// ── (b) narrate() returns a usable model reply as-is (it PHRASES, it does not decide) ───────────────────────

describe("narrate() — reasons through the context-aware port (class NARRATE), returns usable prose", () => {
  it("seam version is pinned and the min-usable floor is a named constant", () => {
    expect(NARRATOR_PROMPT.seam_version).toBe("narrator/v1");
    expect(NARRATION_MIN_CHARS).toBe(1);
  });

  it("builds a task that carries the decided outcome and forbids invention", () => {
    const task = NARRATOR_PROMPT.build(PLANNED, true);
    expect(task).toContain("invent nothing");
    expect(task).toContain(JSON.stringify(PLANNED)); // the outcome is the ONLY set of facts the model may use
  });

  it("returns the model's reply (trimmed) when it is usable", async () => {
    const reply = await narrate({ outcome: PLANNED, ctx: CTX }, reasonerReturning("  Here's the plan for invoicing.  "));
    expect(reply).toBe("Here's the plan for invoicing.");
  });

  it("isUsableNarration rejects empty / whitespace, accepts real text", () => {
    expect(isUsableNarration("")).toBe(false);
    expect(isUsableNarration("   \n\t ")).toBe(false);
    expect(isUsableNarration("ok")).toBe(true);
  });
});

// ── (c) FAIL-CLOSED: empty / degenerate model output ⇒ the deterministic template floor ─────────────────────

describe("narrate() — FAIL-CLOSED to the template floor (never show the founder nothing)", () => {
  it("falls back to the template on EMPTY model output", async () => {
    const reply = await narrate({ outcome: BLOCKED, ctx: CTX }, reasonerReturning(""));
    expect(reply).toBe(renderOutcomeTemplate(BLOCKED)); // identical to the deterministic floor
    expect(reply).toContain("no lever available in the timebox");
  });

  it("falls back to the template on WHITESPACE-only model output", async () => {
    const reply = await narrate({ outcome: PLANNED, ctx: CTX }, reasonerReturning("   \n  "));
    expect(reply).toBe(renderOutcomeTemplate(PLANNED));
  });

  // ── (d) a model INVOCATION error ALSO falls back — a phrasing failure must not discard a decided outcome ──
  it("falls back to the template on a model INVOCATION error (decided message is never lost)", async () => {
    const reply = await narrate({ outcome: CLARIFY, ctx: CTX }, failingReasoner);
    expect(reply).toBe(renderOutcomeTemplate(CLARIFY));
    expect(reply.toLowerCase()).toContain("clarify");
  });
});

// ── (f) the golden suite gates through the eval harness ──────────────────────────────────────────────────────

describe("NARRATE golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite covering every outcome kind", () => {
    const v = validateEvalSuite(NARRATOR_SUITE);
    expect(v.class).toBe("NARRATE");
    expect(v.cases.length).toBeGreaterThanOrEqual(5);
    expect(v.cases.every((c) => c.scorerId === "contains")).toBe(true);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    // A cooperative narrator: for each golden input, emit prose that carries the load-bearing fact (the
    // `contains` expected substring). Keyed on the input so the SAME script drives every case deterministically.
    const script: Record<string, string> = {
      [NARRATOR_SUITE.cases[0]!.input]: "That was ambiguous — could you clarify what you'd like me to do?",
      [NARRATOR_SUITE.cases[1]!.input]: "That goal is not reachable right now: there's no lever in the timebox.",
      [NARRATOR_SUITE.cases[2]!.input]: "I've planned the invoicing feature into three steps.",
      [NARRATOR_SUITE.cases[3]!.input]: "The health endpoint review came back needs_work — one lens is unmet.",
      [NARRATOR_SUITE.cases[4]!.input]: "Understood — a status digest; no plan needed. Ping me to take it further.",
    };
    const llm = new StubLlm((prompt) => {
      const out = script[prompt];
      if (out === undefined) throw new Error(`no canned narration for: ${JSON.stringify(prompt)}`);
      return out;
    });
    const report = await runSuite(NARRATOR_SUITE, { models: ["stub-narrate"], llm });
    expect(passesGate(report, "stub-narrate")).toBe(true);
  });

  it("a degenerate model that emits EMPTY narration FAILS the gate (fail-closed accounting)", async () => {
    const empty = new StubLlm(() => "");
    const report = await runSuite(NARRATOR_SUITE, { models: ["empty"], llm: empty });
    expect(passesGate(report, "empty")).toBe(false);
  });
});
