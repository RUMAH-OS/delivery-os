// =============================================================================
// INTAKE-CLASSIFIER ORGAN PROOF (P2 slice 3, roadmap G-20; I17 "intelligence measured, never assumed").
// =============================================================================
// Proves the OS's first real judgment organ END-TO-END for free (no real model, no network, no DB):
//   (a) the parser / fail-closed logic — canned JSON in, typed classification out; unparseable / off-enum /
//       model-flagged / under-confidence outputs REFUSE (needs_clarification) instead of fabricating a label;
//   (b) the organ + golden suite + eval harness COMPOSE — the frozen CLASSIFY suite, replayed through
//       runSuite with a StubLlm scripted to the expected outputs, passes the gate (passesGate === true);
//   (c) the organ, driven through a REAL ReasoningPort (real Model Router over a StubLlm), produces the
//       suite's expected classification for every golden — the organ consumes the same goldens the gate scores.
// Real-model scoring runs when a model is provisioned; this proves the MACHINERY + the fail-closed contract.

import { describe, it, expect } from "vitest";
import { StubLlm } from "../src/core/llm.js";
import {
  classify,
  parseClassifierOutput,
  INTAKE_CLASSIFIER_PROMPT,
  CLASSIFY_CONFIDENCE_FLOOR,
  type ClassifyReasoner,
  type IntakeClassification,
} from "../src/reasoning/organs/intake-classifier.js";
import { CLASSIFY_SUITE } from "../src/reasoning/eval/suites/classify.suite.js";
import { validateEvalSuite } from "../src/reasoning/eval/eval-case.js";
import { runSuite, modelResult } from "../src/reasoning/eval/eval-runner.js";
import { passesGate } from "../src/reasoning/eval/eval-gate.js";
import { ReasoningPort } from "../src/reasoning/reasoning-port.js";
import { ModelRouter } from "../src/reasoning/model-router.js";
import { loadRoutingConfig } from "../src/reasoning/routing-config.js";

// ── The scripted model: for each golden utterance, the FULL JSON envelope a good model would emit. ───────
// The suite scores only the EXPECTED subset of fields (json-field-match); these full envelopes also parse
// cleanly through the organ so the organ-over-suite proof (c) can assert every field the organ derives.
const RESPONSES: Record<string, string> = {
  // build lane
  "build a new billing module": j({ intent: "create_goal", lane: "build", consequentiality: "medium", reversibility: "reversible", confidence: 0.9 }),
  "create a goal to ship the invoicing feature": j({ intent: "create_goal", lane: "build", consequentiality: "medium", reversibility: "reversible", confidence: 0.95 }),
  "add a dark-mode toggle to the settings page": j({ intent: "create_goal", lane: "build", consequentiality: "low", reversibility: "reversible", confidence: 0.9 }),
  // investigate lane
  "why is CI slow": j({ intent: "unknown", lane: "investigate", consequentiality: "low", reversibility: "reversible", confidence: 0.85 }),
  "show me the blockers": j({ intent: "show_blockers", lane: "investigate", consequentiality: "low", reversibility: "reversible", confidence: 0.95 }),
  "investigate the flaky payment test": j({ intent: "unknown", lane: "investigate", consequentiality: "low", reversibility: "reversible", confidence: 0.85 }),
  // operate lane
  "create an invoice for Mercury": j({ intent: "unknown", lane: "operate", consequentiality: "medium", reversibility: "reversible", confidence: 0.85 }),
  "review all open PRs": j({ intent: "review_open_prs", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.95 }),
  "summarize company health": j({ intent: "company_health", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.95 }),
  "good morning": j({ intent: "morning_digest", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.9 }),
  // consequentiality / reversibility isolated
  "delete the production database": j({ intent: "unknown", lane: "operate", consequentiality: "high", reversibility: "irreversible", confidence: 0.95 }),
  "approve the production deploy": j({ intent: "approve", lane: "operate", consequentiality: "high", reversibility: "irreversible", confidence: 0.95 }),
  "fix a typo in the README": j({ intent: "unknown", lane: "build", consequentiality: "low", reversibility: "reversible", confidence: 0.9 }),
  "send the Q3 investor update email now": j({ intent: "unknown", lane: "operate", consequentiality: "high", reversibility: "irreversible", confidence: 0.9 }),
  // ambiguous → the model refuses (needs_clarification:true)
  "do the thing": j({ intent: "unknown", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.2, needs_clarification: true }),
  "handle it": j({ intent: "unknown", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.2, needs_clarification: true }),
  "you know what to do": j({ intent: "unknown", lane: "operate", consequentiality: "low", reversibility: "reversible", confidence: 0.1, needs_clarification: true }),
};

/** Build a full CLASSIFY JSON envelope (needs_clarification defaults false). */
function j(o: {
  intent: string;
  lane: string;
  consequentiality: string;
  reversibility: string;
  confidence: number;
  needs_clarification?: boolean;
}): string {
  return JSON.stringify({ needs_clarification: false, ...o });
}

/**
 * A StubLlm scripted from RESPONSES. It keys on the UTTERANCE: the eval runner sends the raw utterance as the
 * prompt (reasonForced), while the organ sends its built prompt with the utterance fenced as <<<…>>> — this
 * responder recovers the utterance from either form, so the SAME script drives both paths deterministically.
 */
function scriptedLlm(): StubLlm {
  return new StubLlm((prompt) => {
    const fenced = prompt.match(/<<<([\s\S]*)>>>/);
    const key = fenced ? fenced[1]! : prompt;
    const out = RESPONSES[key];
    if (out === undefined) throw new Error(`no canned response for utterance: ${JSON.stringify(key)}`);
    return out;
  });
}

const CTX = { requestId: "test-req-1" };

/** A minimal ClassifyReasoner that returns a fixed model text (for isolated parse/fail-closed proofs). */
function reasonerReturning(text: string): ClassifyReasoner {
  return {
    async reason() {
      return { text, binding: { model: "stub", params: { thinking: "off" }, bindingId: "CLASSIFY:primary:stub" } };
    },
  };
}

// ── (a) parser / fail-closed unit tests ─────────────────────────────────────────────────────────────────

describe("parseClassifierOutput — typed parse + FAIL-CLOSED (never a fabricated label)", () => {
  it("parses a well-formed, confident envelope into the typed classification", () => {
    const c = parseClassifierOutput(RESPONSES["approve the production deploy"]!);
    expect(c).toMatchObject({
      intent: "approve",
      lane: "operate",
      consequentiality: "high",
      reversibility: "irreversible",
      needs_clarification: false,
      via: "reasoning",
    });
    expect(c.confidence).toBeCloseTo(0.95);
    expect(c.seamVersion).toBe(INTAKE_CLASSIFIER_PROMPT.seam_version);
    expect(c.reason).toBeUndefined();
  });

  it("recovers a JSON object wrapped in prose (model ignored the one-line instruction)", () => {
    const c = parseClassifierOutput('Sure! Here you go: {"intent":"review_open_prs","lane":"operate","consequentiality":"low","reversibility":"reversible","confidence":0.9,"needs_clarification":false} — done.');
    expect(c.via).toBe("reasoning");
    expect(c.intent).toBe("review_open_prs");
  });

  it("FAILS CLOSED on unparseable output (no JSON) — refuses, does not guess", () => {
    const c = parseClassifierOutput("I think you want to deploy something?");
    expect(c).toMatchObject({ intent: "unknown", lane: null, consequentiality: null, reversibility: null, needs_clarification: true, via: "fail-closed", reason: "unparseable-output", confidence: 0 });
  });

  it("FAILS CLOSED on an off-enum intent (a fabricated label is refused)", () => {
    const c = parseClassifierOutput('{"intent":"launch_rockets","lane":"operate","consequentiality":"low","reversibility":"reversible","confidence":0.9}');
    expect(c).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "intent-off-enum", intent: "unknown", lane: null });
  });

  it("FAILS CLOSED on an off-enum lane", () => {
    const c = parseClassifierOutput('{"intent":"unknown","lane":"teleport","consequentiality":"low","reversibility":"reversible","confidence":0.9}');
    expect(c).toMatchObject({ needs_clarification: true, reason: "lane-off-enum" });
  });

  it("FAILS CLOSED on off-enum consequentiality and reversibility", () => {
    expect(parseClassifierOutput('{"intent":"unknown","lane":"operate","consequentiality":"nuclear","reversibility":"reversible","confidence":0.9}').reason).toBe("consequentiality-off-enum");
    expect(parseClassifierOutput('{"intent":"unknown","lane":"operate","consequentiality":"low","reversibility":"maybe","confidence":0.9}').reason).toBe("reversibility-off-enum");
  });

  it("FAILS CLOSED on a missing required field (absent ⇒ off-enum, never defaulted)", () => {
    const c = parseClassifierOutput('{"intent":"approve","consequentiality":"high","reversibility":"irreversible","confidence":0.9}');
    expect(c).toMatchObject({ needs_clarification: true, reason: "lane-off-enum" });
  });

  it("HONORS a model-flagged ambiguity (needs_clarification:true) and carries the model's low confidence", () => {
    const c = parseClassifierOutput(RESPONSES["do the thing"]!);
    expect(c).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "model-flagged-ambiguous", intent: "unknown", lane: null });
    expect(c.confidence).toBeCloseTo(0.2);
  });

  it("FAILS CLOSED below the confidence floor even when every field is on-enum (ambiguous ⇒ refuse)", () => {
    const under = CLASSIFY_CONFIDENCE_FLOOR - 0.1;
    const c = parseClassifierOutput(`{"intent":"approve","lane":"operate","consequentiality":"high","reversibility":"irreversible","confidence":${under},"needs_clarification":false}`);
    expect(c).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "below-confidence-floor" });
    expect(c.confidence).toBeCloseTo(under);
  });

  it("accepts exactly at the confidence floor (>= floor is confident)", () => {
    const c = parseClassifierOutput(`{"intent":"approve","lane":"operate","consequentiality":"high","reversibility":"irreversible","confidence":${CLASSIFY_CONFIDENCE_FLOOR},"needs_clarification":false}`);
    expect(c.via).toBe("reasoning");
    expect(c.needs_clarification).toBe(false);
  });
});

describe("classify() — builds the versioned prompt, reasons, parses fail-closed", () => {
  it("builds a prompt that fences the utterance and names the class (not a model)", () => {
    const prompt = INTAKE_CLASSIFIER_PROMPT.build("review all open PRs");
    expect(prompt).toContain("<<<review all open PRs>>>");
    expect(prompt).toContain("needs_clarification");
    expect(INTAKE_CLASSIFIER_PROMPT.seam_version).toBe("intake-classifier/v1");
  });

  it("returns a typed classification from a confident model output", async () => {
    const c = await classify("approve the production deploy", CTX, reasonerReturning(RESPONSES["approve the production deploy"]!));
    expect(c).toMatchObject({ intent: "approve", consequentiality: "high", via: "reasoning" });
  });

  it("fails closed (needs_clarification) when the model returns garbage — never fabricates", async () => {
    const c = await classify("do something", CTX, reasonerReturning("¯\\_(ツ)_/¯ no idea"));
    expect(c).toMatchObject({ needs_clarification: true, via: "fail-closed", reason: "unparseable-output", intent: "unknown" });
  });

  it("propagates a model INVOCATION error (a step failure is not 'please clarify')", async () => {
    const failing: ClassifyReasoner = { async reason() { throw new Error("model_down"); } };
    await expect(classify("anything", CTX, failing)).rejects.toThrow("model_down");
  });
});

// ── (b) the golden suite gates through the eval harness ──────────────────────────────────────────────────

describe("CLASSIFY golden suite — composes with the eval harness and GATES", () => {
  it("is a valid, frozen suite with ambiguous coverage", () => {
    const v = validateEvalSuite(CLASSIFY_SUITE);
    expect(v.class).toBe("CLASSIFY");
    expect(v.cases.length).toBeGreaterThanOrEqual(12);
    const ambiguous = v.cases.filter((c) => (c.expected as { needs_clarification?: boolean }).needs_clarification === true);
    expect(ambiguous.length).toBeGreaterThanOrEqual(3);
  });

  it("runs the suite through runSuite with a scripted StubLlm and passes the gate", async () => {
    const report = await runSuite(CLASSIFY_SUITE, { models: ["stub-classify"], llm: scriptedLlm() });
    const row = modelResult(report, "stub-classify")!;
    expect(row.failures).toEqual([]); // every golden matched its expected subset
    expect(row.passRate).toBe(1);
    expect(passesGate(report, "stub-classify")).toBe(true); // green on the frozen suite ⇒ adoptable
  });

  it("a model that fabricates an off-enum label FAILS the gate (fail-closed accounting)", async () => {
    // A wrong model that always emits an off-enum lane never matches → passRate 0 → gate red.
    const wrong = new StubLlm(() => '{"intent":"unknown","lane":"nonsense","consequentiality":"low","reversibility":"reversible","confidence":0.9,"needs_clarification":false}');
    const report = await runSuite(CLASSIFY_SUITE, { models: ["wrong"], llm: wrong });
    expect(passesGate(report, "wrong")).toBe(false);
  });
});

// ── (c) the organ, through a REAL ReasoningPort, consumes the same goldens ───────────────────────────────

describe("intake-classifier organ — through a REAL ReasoningPort over the real Model Router", () => {
  it("classifies every golden utterance to its expected fields (organ + suite compose)", async () => {
    const router = new ModelRouter(loadRoutingConfig()); // real CLASSIFY routing, default availability
    const port = new ReasoningPort(router, scriptedLlm()); // real port; StubLlm stands in for the model
    for (const c of CLASSIFY_SUITE.cases) {
      const got = await classify(c.input, { requestId: c.id }, port);
      const expected = c.expected as Partial<IntakeClassification>;
      for (const [field, want] of Object.entries(expected)) {
        expect(got[field as keyof IntakeClassification], `${c.id}.${field}`).toBe(want);
      }
    }
  });
});
