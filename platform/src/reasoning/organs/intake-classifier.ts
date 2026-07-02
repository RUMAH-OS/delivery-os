// =============================================================================
// THE INTAKE CLASSIFIER ORGAN — the OS's first REAL judgment organ (P2 slice 3, roadmap G-20).
// =============================================================================
// It turns a founder utterance into a STRUCTURED classification — {intent, lane, consequentiality,
// reversibility, confidence} — by REASONING through the ReasoningPort (class CLASSIFY). It replaces the
// STUB/keyword intent judgment (src/core/intent.ts) with a real model call for the judgment dimensions,
// while KEEPING the deterministic founder-identity/admission gate (src/goal-intake-c1.ts) in front of it.
// Spec: ADR-reasoning-model-routing.md + Frozen §10 (O1 intent).
//
// SEPARATION OF POWERS (load-bearing):
//   · The organ CLASSIFIES. It does NOT authorize. It answers "what KIND of thing is this utterance?"
//     Only the deterministic gate in goal-intake-c1 (checkFounderIdentity + validateContent) decides
//     whether the request may PROCEED. A confident, well-formed classification is not an admission.
//   · The organ names a CLASS ("CLASSIFY"), never a model. Which model serves CLASSIFY is config
//     (reasoning-routing.config.json), resolved by the Model Router behind the ReasoningPort.
//
// FAIL-CLOSED (the honesty invariant — the model narrates, it never invents; a judgment organ refuses
// rather than fabricate a label):
//   The organ returns a needs_clarification result — NOT a guessed classification — whenever the model's
//   output is unusable as a decision:
//     · the output does not contain parseable JSON;
//     · a REQUIRED field (intent / lane / consequentiality / reversibility) is absent or OFF-ENUM;
//     · the model itself flags needs_clarification (it judged the utterance ambiguous);
//     · the model's confidence is below the refusal threshold (ambiguous ⇒ refuse, don't guess).
//   In every fail-closed case the label fields are set to their "unknown"/null sinks and a `reason` is
//   attached for the audit. A confident, fabricated label is never returned.
//
//   A model INVOCATION error (the model is down / the router resolves nothing) is a DIFFERENT failure: it
//   is a step failure, not "the founder was ambiguous." It PROPAGATES (ReasoningInvocationError /
//   UnknownReasoningClassError / NoAvailableModelError) exactly as the ReasoningPort raises it — conflating
//   "I can't reach a model" with "please clarify" would itself be a lie. The caller decides how to degrade.

import type { ReasonRequest, ReasonResult } from "../reasoning-port.js";
import type { ResolveContext } from "../model-router.js";
import { INTENTS, type Intent } from "../../core/intent.js";

// ── Allowed values for each judgment field (the enums the model is constrained to). ──────────────────────

/** The lane: what KIND of work the utterance asks for. build = author/create; investigate = diagnose/
 *  understand; operate = run a business/ops action. */
export const LANES = ["build", "investigate", "operate"] as const;
export type Lane = (typeof LANES)[number];

/** How consequential acting on the utterance is (blast radius if it goes wrong). */
export const CONSEQUENTIALITIES = ["low", "medium", "high"] as const;
export type Consequentiality = (typeof CONSEQUENTIALITIES)[number];

/** Whether acting on the utterance can be cleanly undone. */
export const REVERSIBILITIES = ["reversible", "irreversible"] as const;
export type Reversibility = (typeof REVERSIBILITIES)[number];

/** The refusal threshold: a model confidence strictly below this is treated as ambiguous ⇒ needs
 *  clarification (refuse, don't guess). Kept as a named constant so the bar is a rollback-able asset. */
export const CLASSIFY_CONFIDENCE_FLOOR = 0.5;

// ── The organ's output — the typed classification the front door consumes. ──────────────────────────────

/** Why the organ fell closed (attached to a needs_clarification result for the audit; never scored). */
export type FailClosedReason =
  | "unparseable-output" //   the model output had no parseable JSON object
  | "intent-off-enum" //      intent absent / not one of INTENTS
  | "lane-off-enum" //        lane absent / not one of LANES
  | "consequentiality-off-enum" // consequentiality absent / not one of CONSEQUENTIALITIES
  | "reversibility-off-enum" //    reversibility absent / not one of REVERSIBILITIES
  | "model-flagged-ambiguous" //   the model set needs_clarification:true itself
  | "below-confidence-floor"; //   confidence < CLASSIFY_CONFIDENCE_FLOOR (ambiguous ⇒ refuse)

/**
 * The structured classification of a founder utterance. On a CONFIDENT, well-formed judgment, every label
 * field is a valid enum value, `needs_clarification` is false, and `via` is "reasoning". On a FAIL-CLOSED
 * judgment, `intent` is the "unknown" sink, the other label fields are null, `needs_clarification` is true,
 * `via` is "fail-closed", and `reason` records why — the organ REFUSED rather than fabricate a label.
 */
export interface IntakeClassification {
  readonly intent: Intent;
  readonly lane: Lane | null;
  readonly consequentiality: Consequentiality | null;
  readonly reversibility: Reversibility | null;
  /** The model's confidence in [0, 1] (0 on a fail-closed / unparseable result). */
  readonly confidence: number;
  /** True iff the organ refuses to commit to a label (ambiguous / unparseable / off-enum). */
  readonly needs_clarification: boolean;
  /** How the classification was reached. */
  readonly via: "reasoning" | "fail-closed";
  /** Present iff needs_clarification — the fail-closed reason (audit only). */
  readonly reason?: FailClosedReason;
  /** The prompt-asset version that produced this classification (rollback provenance). */
  readonly seamVersion: string;
}

// ── The VERSIONED prompt/persona — a rollback-able asset (seam_version pins it). ─────────────────────────
// Changing the wording is a versioned change: bump seam_version so a classification's provenance is exact
// and a regression can be rolled back to a known-good prompt. The persona constrains the model to the
// enums and to a STRICT JSON envelope, and tells it — explicitly — to refuse (needs_clarification) rather
// than guess. It classifies TEXT only; it has no access to live state and must invent none.

const INTENT_LINES = INTENTS.map((i) => `    - ${i}`).join("\n");

export const INTAKE_CLASSIFIER_PROMPT = Object.freeze({
  seam_version: "intake-classifier/v1",
  persona:
    "You are the intake classifier for a software company's autonomous Project Owner. You classify a " +
    "founder's utterance along four axes so the OS can route and gate it. You classify TEXT ONLY — you " +
    "have no access to live state and must invent none. When the utterance is ambiguous or under-specified, " +
    "you REFUSE by setting needs_clarification:true rather than guessing a label.",
  /** Build the concrete prompt for one utterance. The utterance is fenced so it is recoverable verbatim. */
  build(utterance: string): string {
    return [
      INTAKE_CLASSIFIER_PROMPT.persona,
      "",
      "Classify the founder utterance along these axes; use EXACTLY the allowed values:",
      "  intent (the control-surface capability, or 'unknown' if none clearly applies):",
      INTENT_LINES,
      "  lane (what KIND of work it asks for):",
      "    - build       : author / create something new (a module, feature, goal to ship)",
      "    - investigate : diagnose / understand ('why is X', 'what changed', show blockers)",
      "    - operate     : run a business / ops action (invoice, approve, digest, health, review)",
      "  consequentiality (blast radius if acting on it goes wrong): low | medium | high",
      "  reversibility (can it be cleanly undone): reversible | irreversible",
      "",
      "If the utterance is ambiguous or under-specified, DO NOT guess: set needs_clarification:true.",
      'Respond with STRICT JSON on ONE line, no prose:',
      '{"intent":"<id>","lane":"<lane>","consequentiality":"<low|medium|high>",' +
        '"reversibility":"<reversible|irreversible>","confidence":<0..1>,"needs_clarification":<true|false>}',
      "",
      `Founder utterance: <<<${utterance}>>>`,
    ].join("\n");
  },
});

// ── Parsing + fail-closed validation (pure — unit-tested directly, no model needed). ────────────────────

const INTENT_SET: ReadonlySet<string> = new Set(INTENTS);
const LANE_SET: ReadonlySet<string> = new Set(LANES);
const CONSEQ_SET: ReadonlySet<string> = new Set(CONSEQUENTIALITIES);
const REV_SET: ReadonlySet<string> = new Set(REVERSIBILITIES);

/** The needs_clarification sink for a given fail-closed reason (never fabricates a label). */
function failClosed(reason: FailClosedReason, confidence = 0): IntakeClassification {
  return {
    intent: "unknown",
    lane: null,
    consequentiality: null,
    reversibility: null,
    confidence,
    needs_clarification: true,
    via: "fail-closed",
    reason,
    seamVersion: INTAKE_CLASSIFIER_PROMPT.seam_version,
  };
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

/**
 * Parse a model's raw CLASSIFY output into a typed IntakeClassification, FAIL-CLOSED. Pure: no I/O, no model.
 * Returns a needs_clarification result (never a fabricated label) whenever the output is unusable — no JSON,
 * an off-enum required field, a model-flagged ambiguity, or confidence below the floor.
 */
export function parseClassifierOutput(raw: string): IntakeClassification {
  const obj = extractJsonObject(raw);
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return failClosed("unparseable-output");
  }
  const o = obj as Record<string, unknown>;

  // confidence is read early so a fail-closed result can still carry the model's own (low) confidence.
  const confidence = typeof o.confidence === "number" && Number.isFinite(o.confidence)
    ? Math.max(0, Math.min(1, o.confidence))
    : 0;

  // The model may refuse on its own — honor it (it judged the utterance ambiguous).
  if (o.needs_clarification === true) return failClosed("model-flagged-ambiguous", confidence);

  // Every required label field must be present AND on-enum, else refuse (no guessing).
  if (typeof o.intent !== "string" || !INTENT_SET.has(o.intent)) return failClosed("intent-off-enum", confidence);
  if (typeof o.lane !== "string" || !LANE_SET.has(o.lane)) return failClosed("lane-off-enum", confidence);
  if (typeof o.consequentiality !== "string" || !CONSEQ_SET.has(o.consequentiality)) {
    return failClosed("consequentiality-off-enum", confidence);
  }
  if (typeof o.reversibility !== "string" || !REV_SET.has(o.reversibility)) {
    return failClosed("reversibility-off-enum", confidence);
  }

  // Well-formed BUT under-confident ⇒ ambiguous ⇒ refuse (don't ship a low-confidence label as a decision).
  if (confidence < CLASSIFY_CONFIDENCE_FLOOR) return failClosed("below-confidence-floor", confidence);

  return {
    intent: o.intent as Intent,
    lane: o.lane as Lane,
    consequentiality: o.consequentiality as Consequentiality,
    reversibility: o.reversibility as Reversibility,
    confidence,
    needs_clarification: false,
    via: "reasoning",
    seamVersion: INTAKE_CLASSIFIER_PROMPT.seam_version,
  };
}

// ── The organ entrypoint — reason through the port, parse fail-closed. ───────────────────────────────────

/** The narrow reasoning seam the organ depends on: `reason` with a CLASS. `ReasoningPort` satisfies this
 *  structurally, so the organ names a class and never a model, and tests can inject a lightweight double. */
export interface ClassifyReasoner {
  reason(req: ReasonRequest): Promise<ReasonResult>;
}

/**
 * Classify a founder utterance through the ReasoningPort (class CLASSIFY). Builds the VERSIONED prompt,
 * reasons, and parses the model's JSON into the typed structure FAIL-CLOSED (see parseClassifierOutput).
 *
 * This is JUDGMENT, not authorization: the deterministic founder-identity/admission gate (goal-intake-c1)
 * stays in front — a confident classification is not an admission.
 *
 * @throws ReasoningInvocationError / UnknownReasoningClassError / NoAvailableModelError — a model/router
 *   failure PROPAGATES (a step failure is not "please clarify"). Output-level problems fail closed to a
 *   needs_clarification result instead.
 */
export async function classify(
  utterance: string,
  ctx: ResolveContext,
  reasoner: ClassifyReasoner,
): Promise<IntakeClassification> {
  const prompt = INTAKE_CLASSIFIER_PROMPT.build(utterance);
  const result = await reasoner.reason({
    class: "CLASSIFY",
    prompt,
    ctx,
    system: INTAKE_CLASSIFIER_PROMPT.persona,
  });
  return parseClassifierOutput(result.text);
}
