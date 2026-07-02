// =============================================================================
// EVAL-CASE SCHEMA + SCORERS — the frozen golden unit the harness scores (ADR §"Eval harness hook").
// =============================================================================
// I17 — "intelligence measured, never assumed." A reasoning class is scored on a FROZEN set of golden
// cases; a case is (input → expected) plus the id of the SCORER that judges the model's output against
// `expected`. This module owns:
//   - the EvalCase / EvalSuite shapes + their zod schemas (fail-closed: a malformed suite throws, it never
//     silently scores a degenerate set);
//   - a small registry of built-in, deterministic scorers (exact-match, json-field-match, contains).
// It names NO model — a suite is model-agnostic; the runner replays it across candidate models. Model IDs
// live only in the config registry (test/no-model-id-literals.test.ts scans this file too).

import { z } from "zod";
import { REASONING_CLASSES, type ReasoningClass } from "../reasoning-class.js";

// ── The score a scorer returns for one (output, expected) pair. ──────────────────────────────────────────

/** A scorer's verdict on a single case: a normalized quality score, a hard pass/fail, and an optional note. */
export interface ScoreResult {
  /** Quality in [0, 1] (1 = perfect). Aggregated into meanScore; ranking uses it as a tiebreak. */
  readonly score: number;
  /** The hard verdict for pass-rate / gate accounting. Usually score === 1, but a scorer may set its own bar. */
  readonly pass: boolean;
  /** Optional human-readable reason (why it failed, what mismatched) — surfaced in reports, never scored. */
  readonly detail?: string;
}

/** A scorer: pure function from (model output, expected) → verdict. Deterministic; no I/O, no model, no DB. */
export type Scorer = (output: string, expected: unknown) => ScoreResult;

// ── The golden case + suite shapes. ─────────────────────────────────────────────────────────────────────

/** One frozen golden: an input for a reasoning CLASS, the expected answer, and which scorer judges it. */
export interface EvalCase {
  /** Stable id (appears in a report's `failures` list). */
  readonly id: string;
  /** The reasoning class this case exercises (must match its suite's class). */
  readonly class: ReasoningClass;
  /** The prompt/input handed to the reasoning call. */
  readonly input: string;
  /** The expected answer, shape depends on the scorer (a string for exact-match, an object for json-field-match). */
  readonly expected: unknown;
  /** The id of the scorer (built-in or caller-registered) that judges this case. */
  readonly scorerId: string;
}

/** A frozen golden set for ONE reasoning class. The harness replays it across candidate models. */
export interface EvalSuite {
  readonly class: ReasoningClass;
  readonly cases: readonly EvalCase[];
}

// ── zod schemas — fail-closed validation (a malformed suite throws, never scores a degenerate set). ──────

const reasoningClassSchema = z.enum(REASONING_CLASSES);

export const evalCaseSchema = z
  .object({
    id: z.string().min(1),
    class: reasoningClassSchema,
    input: z.string().min(1),
    expected: z.unknown(),
    scorerId: z.string().min(1),
  })
  .strict();

export const evalSuiteSchema = z
  .object({
    class: reasoningClassSchema,
    cases: z.array(evalCaseSchema).min(1),
  })
  .strict()
  .superRefine((suite, ctx) => {
    // Every case must belong to the suite's class, and ids must be unique (a report keys failures by id).
    const seen = new Set<string>();
    suite.cases.forEach((c, i) => {
      if (c.class !== suite.class) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `case ${c.id} has class ${c.class}, but its suite is ${suite.class}`,
          path: ["cases", i, "class"],
        });
      }
      if (seen.has(c.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate case id: ${c.id}`, path: ["cases", i, "id"] });
      }
      seen.add(c.id);
    });
  });

/** Typed, fail-closed validation error (distinct from a routing/model fault). */
export class EvalSuiteError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "EvalSuiteError";
  }
}

/** Validate an in-memory suite object. FAIL-CLOSED: any shape/consistency fault throws EvalSuiteError. */
export function validateEvalSuite(obj: unknown): EvalSuite {
  const result = evalSuiteSchema.safeParse(obj);
  if (!result.success) {
    throw new EvalSuiteError(
      `eval_suite_invalid: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      result.error,
    );
  }
  return result.data as EvalSuite;
}

// ── Built-in scorers — deterministic, side-effect-free. ─────────────────────────────────────────────────

/** Structural equality via canonical JSON (ordering-insensitive for primitives/arrays as authored). */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** exact-match — output (trimmed) equals the expected string (trimmed). The strictest text scorer. */
const exactMatch: Scorer = (output, expected) => {
  const want = String(expected).trim();
  const got = output.trim();
  const pass = got === want;
  return { score: pass ? 1 : 0, pass, detail: pass ? undefined : `expected "${want}", got "${got}"` };
};

/** contains — output contains the expected substring (case-sensitive). Lenient text scorer. */
const contains: Scorer = (output, expected) => {
  const needle = String(expected);
  const pass = output.includes(needle);
  return { score: pass ? 1 : 0, pass, detail: pass ? undefined : `output does not contain "${needle}"` };
};

/**
 * json-field-match — for STRUCTURED outputs (e.g. CLASSIFY's `{intent, lane, ...}`). `expected` is an object;
 * the output is parsed as JSON and each expected field is compared. score = matched/total; pass = all match
 * (and the output parsed). A non-object expected or unparseable output fails closed (score 0, pass false).
 */
const jsonFieldMatch: Scorer = (output, expected) => {
  if (expected === null || typeof expected !== "object" || Array.isArray(expected)) {
    return { score: 0, pass: false, detail: "json-field-match expects an object `expected`" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(output);
  } catch {
    return { score: 0, pass: false, detail: `output is not valid JSON: "${output.slice(0, 80)}"` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { score: 0, pass: false, detail: "output JSON is not an object" };
  }
  const want = expected as Record<string, unknown>;
  const got = parsed as Record<string, unknown>;
  const fields = Object.keys(want);
  if (fields.length === 0) return { score: 1, pass: true };
  const mismatches: string[] = [];
  let matched = 0;
  for (const f of fields) {
    if (deepEqual(got[f], want[f])) matched++;
    else mismatches.push(`${f}: expected ${JSON.stringify(want[f])}, got ${JSON.stringify(got[f])}`);
  }
  const score = matched / fields.length;
  return { score, pass: matched === fields.length, detail: mismatches.length ? mismatches.join("; ") : undefined };
};

/** The built-in scorer registry. Suites reference these by id; callers may extend via runSuite's `scorers`. */
export const BUILTIN_SCORERS: Readonly<Record<string, Scorer>> = Object.freeze({
  "exact-match": exactMatch,
  "contains": contains,
  "json-field-match": jsonFieldMatch,
});

/** Thrown when a case names a scorerId that is neither built-in nor caller-registered (fail-closed). */
export class UnknownScorerError extends Error {
  constructor(readonly scorerId: string) {
    super(`unknown_scorer: ${scorerId}`);
    this.name = "UnknownScorerError";
  }
}

/**
 * Resolve a scorer id to a Scorer. Caller-supplied `extra` scorers override/augment the built-ins.
 * @throws UnknownScorerError if the id resolves to nothing (fail-closed — a suite cannot score with no scorer).
 */
export function resolveScorer(scorerId: string, extra?: Readonly<Record<string, Scorer>>): Scorer {
  const scorer = extra?.[scorerId] ?? BUILTIN_SCORERS[scorerId];
  if (!scorer) throw new UnknownScorerError(scorerId);
  return scorer;
}
