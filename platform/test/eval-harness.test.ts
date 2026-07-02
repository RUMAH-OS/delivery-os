// =============================================================================
// EVAL HARNESS PROOF (ADR §"Eval harness hook"; I17 — "intelligence measured, never assumed").
// =============================================================================
// Proves the harness machinery END-TO-END for free (no real model, no network, no DB): scorers compute
// correctly; the runner replays a CLASSIFY-shaped suite across candidate models and aggregates passRate /
// meanScore / meanLatencyMs / failures; the gate is green ONLY at/above threshold; rankModels orders by
// measured quality; and proposePromotion fires ONLY when a challenger genuinely beats the primary + clears
// the gate. The organs (and their REAL per-class goldens) arrive in P2 — this proves the FRAMEWORK.
//
// Model ids here are opaque placeholders built in-memory (this test lives under test/, outside the src/**
// the model-agnostic lint scans). A fake LlmClient keys canned answers on (model, input) so a "better"
// model can be simulated deterministically; a StubLlm single-model run proves the shipped stub works too.

import { describe, it, expect } from "vitest";
import type { LlmClient, LlmCompleteOptions } from "../src/core/llm.js";
import { StubLlm } from "../src/core/llm.js";
import {
  BUILTIN_SCORERS,
  resolveScorer,
  validateEvalSuite,
  EvalSuiteError,
  UnknownScorerError,
  type EvalSuite,
} from "../src/reasoning/eval/eval-case.js";
import { runSuite, modelResult, EvalRunError, type EvalReport } from "../src/reasoning/eval/eval-runner.js";
import { passesGate, rankModels, proposePromotion } from "../src/reasoning/eval/eval-gate.js";
import type { ClassBinding } from "../src/reasoning/routing-config.js";

// ── A CLASSIFY-shaped golden suite: structured {intent} outputs + text scorers. ─────────────────────────

const SUITE: EvalSuite = {
  class: "CLASSIFY",
  cases: [
    { id: "c1-deploy", class: "CLASSIFY", input: "deploy the app", expected: { intent: "deploy" }, scorerId: "json-field-match" },
    { id: "c2-status", class: "CLASSIFY", input: "check status", expected: { intent: "status" }, scorerId: "json-field-match" },
    { id: "c3-greet", class: "CLASSIFY", input: "greet me", expected: "hello", scorerId: "exact-match" },
    { id: "c4-plan", class: "CLASSIFY", input: "describe roadmap", expected: "plan", scorerId: "contains" },
  ],
};

// Canned answers keyed by (model, input). "good" nails all 4; "almost" misses only c4; "bad" misses all.
const RESPONSES: Record<string, Record<string, string>> = {
  good: {
    "deploy the app": '{"intent":"deploy","lane":"ops"}',
    "check status": '{"intent":"status"}',
    "greet me": "hello",
    "describe roadmap": "the plan is ready",
  },
  almost: {
    "deploy the app": '{"intent":"deploy"}',
    "check status": '{"intent":"status"}',
    "greet me": "hello",
    "describe roadmap": "the roadmap is ready", // no "plan" → fails the contains scorer
  },
  bad: {
    "deploy the app": '{"intent":"rollback"}',
    "check status": "not json",
    "greet me": "hi",
    "describe roadmap": "nothing here",
  },
};

/** A fake LlmClient: canned answers per (forced model, prompt). Deterministic; no network, no model. */
class FakeMultiModelLlm implements LlmClient {
  async complete(prompt: string, opts?: LlmCompleteOptions): Promise<string> {
    const model = opts?.model;
    if (!model) throw new Error("fake requires a forced model id");
    const perModel = RESPONSES[model];
    if (!perModel || !(prompt in perModel)) throw new Error(`no canned response: ${model} / ${prompt}`);
    return perModel[prompt]!;
  }
}

/** A deterministic monotonic clock so latency aggregates are reproducible (each call spends exactly 1 tick). */
function tickingClock(): () => number {
  let t = 0;
  return () => ++t;
}

async function runFake(models: string[]): Promise<EvalReport> {
  return runSuite(SUITE, { models, llm: new FakeMultiModelLlm(), now: tickingClock() });
}

// ── Scorers ─────────────────────────────────────────────────────────────────────────────────────────────

describe("scorers — compute correctly", () => {
  it("exact-match: trimmed equality", () => {
    expect(BUILTIN_SCORERS["exact-match"]!("  hello ", "hello")).toEqual({ score: 1, pass: true, detail: undefined });
    const miss = BUILTIN_SCORERS["exact-match"]!("hi", "hello");
    expect(miss.pass).toBe(false);
    expect(miss.score).toBe(0);
  });

  it("contains: substring presence", () => {
    expect(BUILTIN_SCORERS["contains"]!("the plan is ready", "plan").pass).toBe(true);
    expect(BUILTIN_SCORERS["contains"]!("no match", "plan").pass).toBe(false);
  });

  it("json-field-match: all fields → pass; partial → fractional score, fail; bad JSON → fail-closed", () => {
    const all = BUILTIN_SCORERS["json-field-match"]!('{"intent":"deploy","lane":"ops"}', { intent: "deploy", lane: "ops" });
    expect(all).toEqual({ score: 1, pass: true, detail: undefined });

    const partial = BUILTIN_SCORERS["json-field-match"]!('{"intent":"deploy","lane":"dev"}', { intent: "deploy", lane: "ops" });
    expect(partial.score).toBe(0.5);
    expect(partial.pass).toBe(false);

    const notJson = BUILTIN_SCORERS["json-field-match"]!("not json", { intent: "deploy" });
    expect(notJson).toMatchObject({ score: 0, pass: false });

    // extra output fields are ignored — only the EXPECTED fields are checked
    const extra = BUILTIN_SCORERS["json-field-match"]!('{"intent":"deploy","x":1}', { intent: "deploy" });
    expect(extra.pass).toBe(true);
  });

  it("resolveScorer: built-ins resolve; unknown id fails closed", () => {
    expect(resolveScorer("exact-match")).toBe(BUILTIN_SCORERS["exact-match"]);
    expect(() => resolveScorer("nope")).toThrow(UnknownScorerError);
  });
});

// ── Suite validation (fail-closed) ──────────────────────────────────────────────────────────────────────

describe("suite validation — fail-closed", () => {
  it("accepts a well-formed suite", () => {
    expect(validateEvalSuite(SUITE).cases).toHaveLength(4);
  });

  it("rejects a case whose class differs from its suite", () => {
    const bad = { class: "CLASSIFY", cases: [{ id: "x", class: "PLAN", input: "i", expected: "e", scorerId: "contains" }] };
    expect(() => validateEvalSuite(bad)).toThrow(EvalSuiteError);
  });

  it("rejects duplicate case ids", () => {
    const dup = {
      class: "CLASSIFY",
      cases: [
        { id: "same", class: "CLASSIFY", input: "a", expected: "a", scorerId: "contains" },
        { id: "same", class: "CLASSIFY", input: "b", expected: "b", scorerId: "contains" },
      ],
    };
    expect(() => validateEvalSuite(dup)).toThrow(EvalSuiteError);
  });

  it("rejects an empty suite", () => {
    expect(() => validateEvalSuite({ class: "CLASSIFY", cases: [] })).toThrow(EvalSuiteError);
  });
});

// ── Runner aggregation ──────────────────────────────────────────────────────────────────────────────────

describe("runSuite — aggregation across candidate models", () => {
  it("aggregates passRate / meanScore / failures / latency per model", async () => {
    const report = await runFake(["good", "almost", "bad"]);
    expect(report.suiteClass).toBe("CLASSIFY");
    expect(report.caseCount).toBe(4);

    const good = modelResult(report, "good")!;
    expect(good.passRate).toBe(1);
    expect(good.meanScore).toBe(1);
    expect(good.failures).toEqual([]);
    expect(good.meanLatencyMs).toBe(1); // ticking clock: exactly 1 tick per case

    const almost = modelResult(report, "almost")!;
    expect(almost.passRate).toBe(0.75);
    expect(almost.failures).toEqual(["c4-plan"]);

    const bad = modelResult(report, "bad")!;
    expect(bad.passRate).toBe(0);
    // "check status" → "not json" scores 0 on json-field-match; every case failed
    expect(bad.failures).toEqual(["c1-deploy", "c2-status", "c3-greet", "c4-plan"]);
  });

  it("records a model/invocation error as a case failure (fail-closed), never crashing the run", async () => {
    // "ghost" has no canned responses → every complete() throws; the run still returns a report.
    const report = await runFake(["good", "ghost"]);
    const ghost = modelResult(report, "ghost")!;
    expect(ghost.passRate).toBe(0);
    expect(ghost.failures).toHaveLength(4);
    expect(ghost.cases[0]!.detail).toContain("reasoning_invocation_failed");
  });

  it("fails closed on no candidate models", async () => {
    await expect(runSuite(SUITE, { models: [], llm: new FakeMultiModelLlm() })).rejects.toThrow(EvalRunError);
  });

  it("fails closed on an unknown scorer id (before any invocation)", async () => {
    const badSuite: EvalSuite = { class: "CLASSIFY", cases: [{ id: "z", class: "CLASSIFY", input: "i", expected: "e", scorerId: "made-up" }] };
    await expect(runSuite(badSuite, { models: ["good"], llm: new FakeMultiModelLlm() })).rejects.toThrow(UnknownScorerError);
  });

  it("works with the shipped StubLlm for a single-model run", async () => {
    // StubLlm ignores the model; return the correct canned answer for each input.
    const stub = new StubLlm((prompt) => RESPONSES.good![prompt]!);
    const report = await runSuite(SUITE, { models: ["stub-model"], llm: stub, now: tickingClock() });
    expect(modelResult(report, "stub-model")!.passRate).toBe(1);
  });
});

// ── Gate ────────────────────────────────────────────────────────────────────────────────────────────────

describe("passesGate — green ONLY at/above threshold; unmeasured never passes", () => {
  it("true when all pass, false when one fails (default 0.9)", async () => {
    const report = await runFake(["good", "almost", "bad"]);
    expect(passesGate(report, "good")).toBe(true); // 1.0 ≥ 0.9
    expect(passesGate(report, "almost")).toBe(false); // 0.75 < 0.9
    expect(passesGate(report, "bad")).toBe(false); // 0 < 0.9
  });

  it("a model never scored does NOT pass (fail-closed — cannot adopt the unmeasured)", async () => {
    const report = await runFake(["good"]);
    expect(passesGate(report, "never-ran")).toBe(false);
  });

  it("honors a custom threshold", async () => {
    const report = await runFake(["almost"]);
    expect(passesGate(report, "almost", 0.7)).toBe(true); // 0.75 ≥ 0.7
    expect(passesGate(report, "almost", 0.8)).toBe(false);
  });
});

// ── Ranking ─────────────────────────────────────────────────────────────────────────────────────────────

describe("rankModels — orders by measured quality", () => {
  it("passRate desc primary order", async () => {
    const report = await runFake(["bad", "good", "almost"]);
    expect(rankModels(report).map((r) => r.model)).toEqual(["good", "almost", "bad"]);
  });

  it("latency then id break ties at equal passRate/meanScore", () => {
    const report: EvalReport = {
      suiteClass: "CLASSIFY",
      caseCount: 1,
      models: [
        { model: "z-slow", passRate: 1, meanScore: 1, n: 1, meanLatencyMs: 50, failures: [], cases: [] },
        { model: "a-slow", passRate: 1, meanScore: 1, n: 1, meanLatencyMs: 50, failures: [], cases: [] },
        { model: "fast", passRate: 1, meanScore: 1, n: 1, meanLatencyMs: 10, failures: [], cases: [] },
      ],
    };
    // fast wins on latency; the two equal-latency models break by id (a-slow before z-slow)
    expect(rankModels(report).map((r) => r.model)).toEqual(["fast", "a-slow", "z-slow"]);
  });
});

// ── Promotion proposal ──────────────────────────────────────────────────────────────────────────────────

function classBinding(primary: string): ClassBinding {
  return { primary, challengers: [], fallback: [], params: { thinking: "off" } };
}

describe("proposePromotion — fires ONLY when a challenger genuinely wins", () => {
  it("proposes promoting the challenger that beats the primary by the margin AND clears the gate", async () => {
    const report = await runFake(["good", "almost"]);
    const proposal = proposePromotion(report, classBinding("almost")); // almost=0.75 primary, good=1.0 challenger
    expect(proposal).not.toBeNull();
    expect(proposal!.shouldPromote).toBe(true);
    expect(proposal!.challenger).toBe("good");
    expect(proposal!.configDelta).toEqual({ primary: "good" });
  });

  it("returns null when the primary is already the best (no challenger out-performs it)", async () => {
    const report = await runFake(["good", "almost"]);
    expect(proposePromotion(report, classBinding("good"))).toBeNull();
  });

  it("returns null when the primary was never measured (measured, not assumed)", async () => {
    const report = await runFake(["good", "almost"]);
    expect(proposePromotion(report, classBinding("unscored-primary"))).toBeNull();
  });

  it("holds (shouldPromote=false) when a challenger beats the primary but fails the gate", async () => {
    const report = await runFake(["bad", "almost"]); // primary bad=0; challenger almost=0.75 beats it but < 0.9 gate
    const proposal = proposePromotion(report, classBinding("bad"));
    expect(proposal).not.toBeNull();
    expect(proposal!.shouldPromote).toBe(false);
    expect(proposal!.challenger).toBe("almost");
    expect(proposal!.reason).toContain("below gate");
  });

  it("holds when the challenger clears the gate but not by the margin", async () => {
    // Synthetic: challenger 0.92 vs primary 0.90 → clears gate, but Δ=0.02 < 0.05 margin.
    const report: EvalReport = {
      suiteClass: "CLASSIFY",
      caseCount: 1,
      models: [
        { model: "prim", passRate: 0.9, meanScore: 0.9, n: 1, meanLatencyMs: 1, failures: [], cases: [] },
        { model: "chal", passRate: 0.92, meanScore: 0.92, n: 1, meanLatencyMs: 1, failures: [], cases: [] },
      ],
    };
    const proposal = proposePromotion(report, classBinding("prim"));
    expect(proposal!.shouldPromote).toBe(false);
    expect(proposal!.reason).toContain("margin not met");
  });
});
