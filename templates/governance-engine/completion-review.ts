// =============================================================================
// The Completion Review (C6) — the DONE-VERDICT OWNER (RS-DOS-v1 §6 C6 / §9.2 / §15 / §4.3).
// =============================================================================
// PLATFORM EXTRACTION SLICE 3 — the port-injected mirror of `rumah-admin/src/completion-review-c6.ts`. A goal
// does NOT self-declare done. §15: "sprint completion verdict — OWNER: C6 independent review; NEVER the PO."
// This module is that independent review: it does NOT trust the loop's claim, NOT the worker's self-report, NOT
// even the value the reconciler routed on. It RE-PROBES the acceptance metric a SECOND time, INDEPENDENTLY,
// under its own least-privilege identity (the MetricProbe substrate — now the package's `./metric-probe.js` over
// an injected `ProbeReaderPort`/`CredentialResolver`), and only a sound, finite, independently-confirmed metric
// that meets the frozen acceptance target yields COMPLETE.
//
// WHAT CHANGED vs admin (and ONLY this): the IMPORT residency. Admin pulled `GoalContractRow` from
// `./goal-contract.js`, `AcceptanceShape` from `./goal-supervisor-c7.js`, `acceptanceMet` from
// `./po-reconciler-c2.js`, and the probe substrate (`invokeProbe`/`CredentialResolver`) from `./metric-probe.js`
// — all DB-coupled in admin. THIS module imports the contract row TYPE from `./ports.js`, the same reused
// `acceptanceMet` from the inverted `./reconciler.js`, and the driver-free `./metric-probe.js` invokeProbe. The
// adjudication logic — `acceptanceWellFormed`, the soundness gates, the ONE positively-proven COMPLETE state —
// is BYTE-FOR-BYTE the verified admin logic.
//
// ── FAIL-CLOSED by construction (author≠verifier at the goal level), PRESERVED ──
//   INCOMPLETE is the DEFAULT. The review returns COMPLETE in EXACTLY ONE positively-proven state:
//   (well-formed acceptance) AND (the independent re-probe SUCCEEDED) AND (its value is finite) AND
//   (that value MEETS the frozen target under the strict, finite-guarded comparator). EVERY other state yields
//   INCOMPLETE. "Cannot independently confirm done" is itself INCOMPLETE, never a silent COMPLETE. This module
//   calls NO `transition()` — it is pure adjudication; the reconciler (the sole mutator, §15) consumes the verdict.
// =============================================================================

import type { GoalContractRow } from "./ports.js";
import type { AcceptanceShape } from "./goal-supervisor.js";
import { acceptanceMet } from "./reconciler.js"; // REUSED strict, finite-guarded value-at-target predicate
import { invokeProbe, defaultProbeRegistry } from "./metric-probe.js";
import type { ProbeRegistry, CredentialResolver } from "./metric-probe.js";

// ── Verdict + types ──────────────────────────────────────────────────────────────────────────────────
export type CompletionVerdict = "COMPLETE" | "INCOMPLETE";

/** The independent re-read C6 performs under its OWN identity (never the loop's self-report). Mirrors the
 *  GS's ExternalReprobe shape — the same "ok / value / note" envelope, so a failed probe is a TYPED state,
 *  not an exception that could be swallowed into a silent pass. */
export interface ReviewReprobe {
  /** true = the independent re-read succeeded; false = the canonical source was unreadable / the probe threw. */
  ok: boolean;
  /** the review's typed reading of the acceptance metric (null when the probe yielded no value). */
  value: number | null;
  probeId: string;
  version: number;
  note: string;
}

export interface CompletionEvidence {
  acceptanceMetric: string;
  /** the frozen structured acceptance the verdict is adjudicated against. */
  acceptance: AcceptanceShape;
  op: string | null;
  target: number | null;
  /** C6's OWN independent re-read (the load-bearing independence: re-probed, not trusted). */
  reprobe: ReviewReprobe;
  /** acceptance well-formed (op valid + finite target + non-contradictory direction)? */
  acceptanceWellFormed: boolean;
  /** the re-read is readable AND finite? */
  reprobeSound: boolean;
  /** the strict, finite-guarded value-at-target comparison (reused from the reconciler). */
  met: boolean;
  /** marker: this verdict was produced from an INDEPENDENT re-probe, not the loop's/PO's claim. */
  independent: true;
}

export interface CompletionReview {
  goalId: string;
  /** complete === (verdict === "COMPLETE"). The reconciler consumes THIS to drive REVIEWING→DONE. */
  complete: boolean;
  verdict: CompletionVerdict;
  evidence: CompletionEvidence;
  /** human-legible reasons. On INCOMPLETE: every blocking reason (NOT short-circuited). On COMPLETE: the
   *  single positive proof. The verdict is COMPLETE iff there are ZERO blocking reasons. */
  reasons: string[];
}

// ── The context (the re-probe mechanism + the frozen acceptance) ───────────────────────────────────────
export interface CompletionReviewContext {
  /** §4.1 structured acceptance {op,target,direction} (C2-MIND-derived). The frozen criterion the verdict is
   *  adjudicated against — supplied because the built GoalContract row stores only the metric TEXT + probe ref. */
  acceptance: AcceptanceShape;
  /** The INDEPENDENT re-probe mechanism (C6's own identity, least-privilege). Inject a fake for offline tests;
   *  the default wires metric-probe.invokeProbe over `resolver`+`registry` using the contract's PINNED probe. */
  reprobe?: () => Promise<{ value: number | null; note?: string }>;
  /** Least-privilege, read-only `CredentialResolver` (→ `ProbeReaderPort`) for the default invokeProbe binding (§36.2). */
  resolver?: CredentialResolver;
  /** Probe registry for the default binding (default: the process-wide defaultProbeRegistry). */
  registry?: ProbeRegistry;
}

const VALID_OPS = [">=", "<=", ">", "<", "=="] as const;

/** Strict, finite-guarded acceptance well-formedness — mirrors the C9/GS shape: a valid op, a FINITE target,
 *  and a direction that does NOT contradict the op (so `op:"<=" + direction:"increase"` is malformed, never
 *  read as a reachable target). A malformed acceptance can never be "met" — fail-closed to INCOMPLETE. */
function acceptanceWellFormed(a?: AcceptanceShape): boolean {
  if (!a || !a.op || !VALID_OPS.includes(a.op)) return false;
  if (typeof a.target !== "number" || !Number.isFinite(a.target)) return false;
  // direction/op contradiction guard (same shape as the GS's movementTowardTarget guard).
  const opDir = a.op === ">=" || a.op === ">" ? "increase" : a.op === "<=" || a.op === "<" ? "decrease" : null;
  if (a.direction && (opDir === "increase" || opDir === "decrease") && a.direction !== opDir) return false;
  return true;
}

/** Build the default INDEPENDENT re-probe: invokeProbe under least-privilege read-only credentials, using the
 *  contract's PINNED (probe_id, version). This is the §6/§36.2 "re-probe under its own identity" mechanism. */
function defaultReprobe(contract: GoalContractRow, ctx: CompletionReviewContext): () => Promise<{ value: number | null; note?: string }> {
  return async () => {
    if (!ctx.resolver) {
      throw new Error(
        "completion-review-c6: no independent re-probe wired — supply ctx.reprobe (a fake/real re-read) or " +
          "ctx.resolver (a least-privilege read-only CredentialResolver for the default invokeProbe binding)",
      );
    }
    const r = await invokeProbe(contract.metricSourceProbeId, contract.metricSourceVersion, ctx.resolver, ctx.registry ?? defaultProbeRegistry);
    return { value: r.value, note: `independent re-probe ${r.probe_id}@${r.version} (least-privilege, read-only)` };
  };
}

// =============================================================================
// reviewCompletion — the independent DONE-verdict adjudication. FAIL-CLOSED. Pure: mutates/transitions NOTHING.
// =============================================================================
export async function reviewCompletion(contract: GoalContractRow, ctx: CompletionReviewContext): Promise<CompletionReview> {
  const acceptance = ctx.acceptance;
  const reprobeFn = ctx.reprobe ?? defaultReprobe(contract, ctx);

  // 1) INDEPENDENT re-read of the acceptance metric — under the review's OWN identity, not the loop's claim.
  let reprobe: ReviewReprobe;
  try {
    const r = await reprobeFn();
    reprobe = {
      ok: true,
      value: r.value,
      probeId: contract.metricSourceProbeId,
      version: contract.metricSourceVersion,
      note: r.note ?? "independent re-read ok",
    };
  } catch (e) {
    // A failed/unreadable re-probe is NOT an error to swallow — it is an UNCONFIRMABLE state → fail-closed.
    reprobe = {
      ok: false,
      value: null,
      probeId: contract.metricSourceProbeId,
      version: contract.metricSourceVersion,
      note: `independent re-probe FAILED: ${(e as Error).message}`,
    };
  }

  // 2) Soundness gates (collected, NOT short-circuited — every blocking reason is reported for one verdict).
  const reasons: string[] = [];
  const wellFormed = acceptanceWellFormed(acceptance);
  if (!wellFormed) {
    reasons.push(
      `malformed acceptance: '${contract.acceptanceMetric} ${acceptance?.op ?? "?"} ${acceptance?.target ?? "?"}'` +
        `${acceptance?.direction ? ` (${acceptance.direction})` : ""} is not a valid, finite, non-contradictory target — ` +
        `a goal with no comparable target can never be independently confirmed done (fail-closed).`,
    );
  }
  const reprobeFinite = reprobe.value !== null && Number.isFinite(reprobe.value);
  const reprobeSound = reprobe.ok && reprobeFinite;
  if (!reprobe.ok) {
    reasons.push(`unconfirmable: the INDEPENDENT re-probe could not read the metric (${reprobe.note}) — done cannot be confirmed (fail-closed).`);
  } else if (!reprobeFinite) {
    reasons.push(`unconfirmable: the independent re-read was non-finite/null (value=${String(reprobe.value)}) — done cannot be confirmed (fail-closed).`);
  }

  // 3) The strict, finite-guarded value-at-target comparison — REUSED from the reconciler (one source of truth).
  //    acceptanceMet is itself fail-closed (null/non-finite value OR malformed acceptance → false), so this is a
  //    second, independent guard; the explicit reasons above just make the CAUSE legible.
  const met = acceptanceMet(reprobe.value, acceptance);
  if (wellFormed && reprobeSound && !met) {
    reasons.push(
      `not met: the independently re-probed value ${reprobe.value} does NOT satisfy '${contract.acceptanceMetric} ` +
        `${acceptance.op} ${acceptance.target}' — the acceptance target is not genuinely reached (the loop cannot self-certify done).`,
    );
  }

  // 4) Verdict — COMPLETE iff ZERO blocking reasons (i.e. all four positive: well-formed ∧ ok ∧ finite ∧ met).
  const complete = reasons.length === 0 && wellFormed && reprobeSound && met;
  if (complete) {
    reasons.push(
      `COMPLETE: the acceptance metric '${contract.acceptanceMetric} ${acceptance.op} ${acceptance.target}' is genuinely met — ` +
        `independently re-probed value ${reprobe.value} satisfies the frozen target (re-read under the review's own identity, ` +
        `not the loop's claim). author≠verifier at the goal level holds.`,
    );
  }

  return {
    goalId: contract.goalId,
    complete,
    verdict: complete ? "COMPLETE" : "INCOMPLETE",
    evidence: {
      acceptanceMetric: contract.acceptanceMetric,
      acceptance,
      op: acceptance?.op ?? null,
      target: acceptance?.target ?? null,
      reprobe,
      acceptanceWellFormed: wellFormed,
      reprobeSound,
      met,
      independent: true,
    },
    reasons,
  };
}

/** Convenience: wrap metric-probe.invokeProbe into the ctx.reprobe shape, binding a goal's PINNED probe to a
 *  least-privilege resolver. The real DB-backed path (TEST-DB fixtures behind the founder ★) uses this. */
export function makeProbeReprobe(
  contract: Pick<GoalContractRow, "metricSourceProbeId" | "metricSourceVersion">,
  resolver: CredentialResolver,
  registry: ProbeRegistry = defaultProbeRegistry,
): () => Promise<{ value: number | null; note?: string }> {
  return async () => {
    const r = await invokeProbe(contract.metricSourceProbeId, contract.metricSourceVersion, resolver, registry);
    return { value: r.value, note: `independent re-probe ${r.probe_id}@${r.version} (least-privilege, read-only)` };
  };
}
