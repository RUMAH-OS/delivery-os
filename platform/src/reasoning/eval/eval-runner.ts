// =============================================================================
// EVAL RUNNER — replays a frozen suite across candidate models and aggregates a report (ADR §"Eval harness hook").
// =============================================================================
// I17 — "intelligence measured, never assumed." Given a suite (one reasoning class' goldens) and a set of
// candidate models, the runner replays EVERY case under EVERY model — through the SAME reasoning path organs
// use (the forced-model seam on the ReasoningPort / llm.ts), never a second model-call path — scores each
// output, and aggregates per model: passRate, meanScore, meanLatencyMs, and the failing case ids.
//
// Deterministic + DB-free: the runner touches no database, no clock beyond an injectable `now`, and no
// network beyond whatever LlmClient the caller injects (a StubLlm makes the whole thing free + reproducible).

import type { LlmClient } from "../../core/llm.js";
import { reasonForced, ReasoningInvocationError, type ReasoningPort } from "../reasoning-port.js";
import type { ReasoningClass } from "../reasoning-class.js";
import { resolveScorer, validateEvalSuite, type EvalSuite, type Scorer } from "./eval-case.js";

/** The scored outcome of one (model, case) pair. */
export interface PerCaseResult {
  readonly caseId: string;
  readonly score: number;
  readonly pass: boolean;
  readonly latencyMs: number;
  /** Scorer note or an invocation-error message (fail-closed cases are recorded, never dropped). */
  readonly detail?: string;
}

/** The aggregate for ONE candidate model over the whole suite — the row the gate + ranking read. */
export interface PerModelResult {
  readonly model: string;
  /** Fraction of cases that passed, in [0, 1] — the gate's primary signal. */
  readonly passRate: number;
  /** Mean quality score in [0, 1] — ranking tiebreak below passRate. */
  readonly meanScore: number;
  /** Number of cases scored (= suite size). */
  readonly n: number;
  /** Mean per-case latency in ms — ranking tiebreak (a cost/latency proxy) below meanScore. */
  readonly meanLatencyMs: number;
  /** Ids of the cases this model FAILED (pass === false), in suite order. */
  readonly failures: readonly string[];
  /** Per-case detail for transparency (drives the gate/promotion decisions above pure aggregates). */
  readonly cases: readonly PerCaseResult[];
}

/** The full report: one class' suite scored across every candidate model. */
export interface EvalReport {
  readonly suiteClass: ReasoningClass;
  readonly caseCount: number;
  readonly models: readonly PerModelResult[];
}

export interface RunSuiteOptions {
  /** The candidate models to score (e.g. a class' primary ∪ challengers). Must be non-empty. */
  readonly models: readonly string[];
  /** The model client every invocation runs through (inject a StubLlm for a free, deterministic run). */
  readonly llm: LlmClient;
  /**
   * Optional ReasoningPort. When supplied, invocations go through it (so its telemetry sink observes them);
   * when omitted, the runner uses the free reasonForced() with `llm` directly (no router/port needed).
   */
  readonly port?: ReasoningPort;
  /** Caller-registered scorers, merged over the built-ins (a suite may reference an organ-specific scorer). */
  readonly scorers?: Readonly<Record<string, Scorer>>;
  /** Optional system preamble forwarded to every invocation. */
  readonly system?: string;
  /** Clock seam for deterministic latency on the error path; default Date.now. */
  readonly now?: () => number;
}

/** Thrown when the run is asked for with no candidate models (fail-closed — nothing to measure). */
export class EvalRunError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvalRunError";
  }
}

/**
 * Run a suite across candidate models and aggregate an EvalReport.
 * - Validates the suite fail-closed (a malformed suite throws before any model is billed).
 * - For each model × each case: force that model on the case's class, apply the case's scorer, record the score.
 * - A model error on a case is caught and recorded as a FAILURE (score 0, pass false) — the run continues; the
 *   harness measures, it never crashes on one bad case (and never fakes a pass).
 */
export async function runSuite(suite: EvalSuite, opts: RunSuiteOptions): Promise<EvalReport> {
  const validated = validateEvalSuite(suite); // fail-closed
  if (opts.models.length === 0) throw new EvalRunError("run_suite_no_models: at least one candidate model is required");
  const now = opts.now ?? Date.now;

  // Pre-resolve every case's scorer once (fail-closed on an unknown scorerId before any invocation).
  const scorers = validated.cases.map((c) => resolveScorer(c.scorerId, opts.scorers));

  const models: PerModelResult[] = [];
  for (const model of opts.models) {
    const cases: PerCaseResult[] = [];
    for (let i = 0; i < validated.cases.length; i++) {
      const c = validated.cases[i]!;
      const scorer = scorers[i]!;
      const started = now();
      try {
        const res = opts.port
          ? await opts.port.reasonForced({ class: c.class, prompt: c.input, model, system: opts.system })
          : await reasonForced(opts.llm, { class: c.class, prompt: c.input, model, system: opts.system }, { now });
        const verdict = scorer(res.text, c.expected);
        cases.push({
          caseId: c.id,
          score: clamp01(verdict.score),
          pass: verdict.pass,
          latencyMs: res.latencyMs,
          detail: verdict.detail,
        });
      } catch (err) {
        // Fail-closed: a model/invocation error scores 0 and fails the case; the run continues.
        const detail = err instanceof ReasoningInvocationError ? err.message : `invocation_error: ${err instanceof Error ? err.message : String(err)}`;
        cases.push({ caseId: c.id, score: 0, pass: false, latencyMs: now() - started, detail });
      }
    }
    models.push(aggregate(model, cases));
  }

  return { suiteClass: validated.class, caseCount: validated.cases.length, models };
}

/** Aggregate one model's per-case results into its report row. */
function aggregate(model: string, cases: PerCaseResult[]): PerModelResult {
  const n = cases.length;
  const passes = cases.filter((c) => c.pass).length;
  const sumScore = cases.reduce((a, c) => a + c.score, 0);
  const sumLatency = cases.reduce((a, c) => a + c.latencyMs, 0);
  return {
    model,
    passRate: n === 0 ? 0 : passes / n,
    meanScore: n === 0 ? 0 : sumScore / n,
    n,
    meanLatencyMs: n === 0 ? 0 : sumLatency / n,
    failures: cases.filter((c) => !c.pass).map((c) => c.caseId),
    cases,
  };
}

/** Defensive clamp: a misbehaving custom scorer cannot skew aggregates outside [0, 1]. */
function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Convenience lookup: the report row for a given model (undefined if it was not a candidate). */
export function modelResult(report: EvalReport, model: string): PerModelResult | undefined {
  return report.models.find((m) => m.model === model);
}
