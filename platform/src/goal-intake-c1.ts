// =============================================================================
// The Goal-Intake (C1 front door) — the founder's SUBMIT + the FAP APPROVAL (RS-DOS-v1 C1 / §3 / §3.1 /
// §15 / §20 J1·J4·J5 · MMB Sprint 5.3, first slice). The FRONT DOOR into the now-built goal-lifecycle
// controller (po-autoloop-c2). This completes the autonomous loop: a goal can be SUBMITTED and a summon
// can be APPROVED — by the FOUNDER, fail-closed against everyone else.
// =============================================================================
// THIS SLICE BUILDS THE TWO INBOUND C1 SURFACES and COMPOSES the now-built organs (it re-implements NONE):
//
//   SUBMIT  (J1)  parseGoalSubmission(raw, identity, ctx) → { ok, submission?, rejections[] }, then
//                 submitGoal hands a VALID submission to the controller's runGoalLifecycle (SHADOW). The
//                 controller's PreflightGoal/GoalSubmission shape is matched EXACTLY (src/po-autoloop-c2.ts).
//   APPROVE (J4/J5) approveFap(response, identity, ctx) → a structured {APPROVE|MODIFY|ABORT} decision that
//                 RESUMES the lifecycle via the §4.3 founder-decision edges — through applyReconcilePlan (the
//                 reconciler's SOLE-MUTATOR door, §15). This module NEVER calls goal-contract.transition()
//                 and is NEVER a second state mutator.
//
// ── FAIL-CLOSED admission validation (composes C9's spirit at the front door) ──
//   A goal you cannot MEASURE or BOUND is the unreachable-goal incident class. BEFORE the submission ever
//   reaches the controller's pre-flight gate (C9), the intake refuses, with a SPECIFIC reason:
//     · objective blank                                  → objective-blank
//     · no measurable acceptance (no probe id)           → no-acceptance-metric
//     · no comparable target (no op / no target)         → no-acceptance-target
//     · a non-finite target                              → non-finite-target
//     · a malformed / ≤0 budget (no positive axis)       → malformed-budget
//   This is DEFENSE-IN-DEPTH, not a re-implementation: a well-formed submission STILL runs the full C9 gate
//   inside the controller (evaluatePreflight re-checks measurable/well-formed/budget/capability/reachability).
//   The intake just refuses the obviously-unadmissible at hour 0 with a front-door reason the founder reads.
//
// ── IDENTITY-BINDING (load-bearing — §3.1 "approvals are identity-bound, not channel membership") ──
//   ONLY the founder may submit a goal or approve a FAP. The founder identity is a VERIFIED field produced by
//   the signed control path (the Slack request-signature transport) — NOT a self-asserted string the caller
//   can spoof. The intake binds to a CONFIGURED founder id (resolveFounderBinding ← env RUNTIME_FOUNDER_ID)
//   and FAILS CLOSED if it is unset (no configured founder ⇒ nobody can be verified ⇒ refuse everyone). A
//   non-founder, an absent, or a forged/unverified identity is REJECTED — no contract, no resume, no action.
//
//   The chain that makes "verified, not self-asserted" structural: in production the ONLY producer of a
//   VerifiedIdentity{verified:true} is the signed Slack transport (realSlackTransport.verifyIdentity), which
//   is the DEFERRED seam below. With no real transport wired, identity verification FAILS CLOSED — exactly
//   like the §36.3 deferred reachability evaluator. A message body that merely CLAIMS to be the founder
//   arrives unsigned ⇒ verified:false ⇒ inert (the prompt-injection guard, §3.3).
//
// ── SHADOW posture (this slice) ──
//   DEFAULT = SHADOW: the intake PARSES fixture submissions/approvals (the verified identity is injected,
//   simulating what the signed transport WOULD produce) and drives the controller in SHADOW (executed:false,
//   no DB, no live goal). It reports the would-admit / would-resume, calls NO real Slack, and touches no live
//   goal. `--enforce` proves the capability against TEST-DB fixtures only, behind the founder-★ + "real Slack
//   app = the enforce-flip" banner.
//
//   The REAL Slack transport — the /goal slash-command, the interactive approval buttons, the Slack app +
//   credentials, and the request-signature verification — is a DEFERRED seam (realSlackTransport throws
//   "DEFERRED", modeled on §36.3). It is the enforce-flip; this slice calls no real Slack.
//
// OUT OF SCOPE (named): the real Slack app + slash-command registration + interactive-message transport +
//   credentials (the enforce-flip); driving a LIVE goal (founder ★); rendering the literal Slack single-screen
//   / Block-Kit UI (this builds the STRUCTURE + validation, not the Block Kit); summon-storm triage (§3.3/§13).
// =============================================================================

import type {
  PreflightGoal,
  PreflightContext,
  AcceptanceCriterion,
  AcceptanceOp,
  ConfigReadinessFn,
  ReachabilitySource,
} from "./preflight-gate-c9.js";
import type { BudgetCap, GoalContractRow, GoalState } from "./goal-contract.js";
import { readContract as dbReadContract } from "./goal-contract.js";
import type { AcceptanceShape } from "./goal-supervisor-c7.js";
import {
  runGoalLifecycle,
  type GoalSubmission,
  type LifecycleContext,
  type LifecycleResult,
} from "./po-autoloop-c2.js";
import {
  applyReconcilePlan,
  reconcile,
  type ReconcilePlan,
  type ReconcileExecution,
  type LegalEdge,
  type ReconcileDecision,
  type ObservedState,
} from "./po-reconciler-c2.js";
import type { SummonResult, BoundaryClass, FapSource } from "./founder-summon-c1.js";

// =============================================================================
// IDENTITY — the VERIFIED founder identity + the configured binding (§3.1).
// =============================================================================

/** A VERIFIED identity produced by the SIGNED control path (the Slack request-signature transport). The
 *  `verified` flag is set by the transport ONLY — never by the caller. A self-asserted message body that
 *  merely claims a subject id arrives with verified:false (it is not from the signed path) and is inert. */
export interface VerifiedIdentity {
  /** the verified subject id (e.g. the Slack user id) the signed transport authenticated. */
  subjectId: string;
  /** did the signed control path verify this identity? Forged / self-asserted / unsigned ⇒ false. */
  verified: boolean;
  /** how it was verified (provenance) — e.g. "slack-request-signature". */
  method?: string;
  /** human label (display only — never used for authorization). */
  display?: string;
}

/** The configured founder binding. `founderId` is the single subject id authorized to submit/approve. A null
 *  founderId means UNSET ⇒ fail-closed (nobody can be verified as the founder). */
export interface FounderBinding {
  founderId: string | null;
  source: string;
}

/** Resolve the founder binding from the environment (RUNTIME_FOUNDER_ID), overridable for tests. Fail-closed
 *  by construction: an unset env var yields founderId:null, which rejects EVERY submission/approval. */
export function resolveFounderBinding(over?: Partial<FounderBinding>): FounderBinding {
  if (over && over.founderId !== undefined) {
    return { founderId: over.founderId, source: over.source ?? "injected (test/override)" };
  }
  const env = process.env.RUNTIME_FOUNDER_ID?.trim();
  return {
    founderId: env && env.length > 0 ? env : null,
    source: env ? "env RUNTIME_FOUNDER_ID" : "env RUNTIME_FOUNDER_ID (UNSET — fail-closed: no founder configured)",
  };
}

export type IdentityRejectionCode =
  | "founder-binding-unset" //   no configured founder id ⇒ cannot verify anyone ⇒ refuse everyone (fail-closed)
  | "identity-absent" //         no identity supplied at all
  | "identity-unverified" //     identity.verified !== true (self-asserted / forged / unsigned — not the signed path)
  | "identity-not-founder"; //   verified, but subjectId !== the configured founder id

export interface IdentityRejection {
  code: IdentityRejectionCode;
  detail: string;
}

export interface IdentityCheck {
  ok: boolean;
  /** the verified founder subject id, present iff ok. */
  founderSubjectId?: string;
  rejection?: IdentityRejection;
}

/** The single identity gate both surfaces use. FAIL-CLOSED at every branch: an unset binding, an absent
 *  identity, an unverified (self-asserted/forged) identity, or a verified-but-not-the-founder identity all
 *  REJECT. Only a verified identity whose subjectId equals the configured founder id passes. */
export function checkFounderIdentity(identity: VerifiedIdentity | null | undefined, binding: FounderBinding): IdentityCheck {
  if (!binding.founderId) {
    return {
      ok: false,
      rejection: {
        code: "founder-binding-unset",
        detail: `no founder is configured (${binding.source}) — the front door fails closed: with no bound founder id, nobody can be authorized to submit or approve.`,
      },
    };
  }
  if (!identity) {
    return { ok: false, rejection: { code: "identity-absent", detail: "no identity supplied — the submit/approve is anonymous and refused (§3.1: approvals are identity-bound)." } };
  }
  if (identity.verified !== true) {
    return {
      ok: false,
      rejection: {
        code: "identity-unverified",
        detail: `identity '${identity.subjectId}' is NOT verified by the signed control path (verified=${String(identity.verified)}) — a self-asserted / forged / unsigned identity is inert (only the Slack request-signature transport sets verified:true).`,
      },
    };
  }
  if (identity.subjectId !== binding.founderId) {
    return {
      ok: false,
      rejection: {
        code: "identity-not-founder",
        detail: `verified identity '${identity.subjectId}' is NOT the configured founder ('${binding.founderId}', ${binding.source}) — only the founder may submit or approve.`,
      },
    };
  }
  return { ok: true, founderSubjectId: identity.subjectId };
}

// =============================================================================
// SUBMIT — parse a /goal submission into the controller's GoalSubmission, fail-closed.
// =============================================================================

/** The acceptance block of a /goal submission: the probe id (measurability), the comparator + target, and the
 *  direction. {probe id, target, op, direction} — exactly the acceptance the C9 gate + the GS + C6 consume. */
export interface RawAcceptance {
  /** the registered MetricProbe id (acceptance.metric_source). ABSENT ⇒ unmeasurable ⇒ refused. */
  probeId?: string;
  /** the PINNED probe version (default 1 — version-pinned resolution, no latest-fallback). */
  probeVersion?: number;
  /** the comparator (>=, <=, >, <, ==). ABSENT ⇒ no comparable target ⇒ refused. */
  op?: AcceptanceOp;
  /** the numeric target. ABSENT / non-finite ⇒ refused. */
  target?: number;
  /** the intended movement direction (must not contradict op). */
  direction?: "increase" | "decrease";
  /** a human metric label (defaults to the probe id when omitted). */
  metric?: string;
}

/** The raw /goal submission the founder types (single-screen: objective + measurable acceptance + budget). */
export interface RawGoalSubmission {
  /** the objective (what the founder asks for, in their own words). BLANK ⇒ refused. */
  objective?: string;
  /** the measurable acceptance criterion. */
  acceptance?: RawAcceptance;
  /** the H1 budget envelope ({max_turns, max_cost_cents, …}). No positive axis ⇒ refused. */
  budget?: BudgetCap;
  /** optional config/secret keys the goal's capabilities require (the C9 capability-readiness check). */
  requiredConfigKeys?: string[];
  /** an explicit goal id (else the DB generates one in ENFORCE; the fixture id in SHADOW). */
  goalId?: string;
}

export type SubmissionRejectionCode =
  | IdentityRejectionCode
  | "objective-blank"
  | "no-acceptance-metric" //   no probe id — the acceptance is not measurable (the unreachable-goal class)
  | "no-acceptance-target" //   no op / no target — nothing the probe can compare against
  | "non-finite-target" //      target is NaN / ±Infinity — not a reachable, comparable target
  | "malformed-budget"; //      budget has no positive axis — a zero/absent budget can make no progress

export interface SubmissionRejection {
  code: SubmissionRejectionCode;
  detail: string;
}

/** The runtime wiring the intake needs to build a controller GoalSubmission (the founder types CONTENT; these
 *  are the SEAMS — the probe registry, config oracle, reachability source, target env — supplied by the host). */
export interface IntakeContext {
  /** the configured founder binding (default = resolveFounderBinding() ← env, fail-closed if unset). */
  founder?: FounderBinding;
  /** the env the goal would run in (local | dev | QA | staging | prod | test). */
  targetEnv: string;
  /** probe registry to resolve metric_source in the controller's pre-flight (default = the process-wide one). */
  probeRegistry?: PreflightContext["probeRegistry"];
  /** config/secret readiness oracle for the pre-flight capability check. */
  configReadiness?: ConfigReadinessFn;
  /** reachability verdict source for the pre-flight (default = the DEFERRED evaluator → fail-closed). */
  reachability?: ReachabilitySource;
}

export interface ParseResult {
  ok: boolean;
  /** the controller's GoalSubmission — present IFF ok (identity passed AND the content is well-formed). */
  submission?: GoalSubmission;
  /** the derived frozen acceptance {op,target,direction} (consumed by the GS/C6/reconciler), iff ok. */
  acceptance?: AcceptanceShape;
  /** the derived H1 budget cap, iff ok. */
  budgetCap?: BudgetCap;
  /** EVERY rejection reason (identity OR content) — not short-circuited within content. */
  rejections: SubmissionRejection[];
  /** the identity outcome (the verified founder subject id, or the identity rejection). */
  identity: { accepted: boolean; founderSubjectId?: string };
}

/** Validate the CONTENT of a submission (the C9-spirit front-door checks). Collected, not short-circuited. */
function validateContent(raw: RawGoalSubmission): SubmissionRejection[] {
  const rejections: SubmissionRejection[] = [];
  const a = raw.acceptance;

  if (!raw.objective || raw.objective.trim() === "") {
    rejections.push({ code: "objective-blank", detail: "the objective is blank — there is nothing to pursue." });
  }
  if (!a || !a.probeId || a.probeId.trim() === "") {
    rejections.push({
      code: "no-acceptance-metric",
      detail: "no acceptance metric probe id — the goal is UNMEASURABLE; a goal whose progress cannot be independently re-read can never be confirmed reached (the unreachable-goal incident class).",
    });
  }
  if (!a || a.op === undefined || a.target === undefined) {
    // op or target missing → no comparable target.
    rejections.push({
      code: "no-acceptance-target",
      detail: "no comparable acceptance target — supply both an op (>=, <=, >, <, ==) and a numeric target the probe can compare against.",
    });
  }
  if (a && a.target !== undefined && (typeof a.target !== "number" || !Number.isFinite(a.target))) {
    rejections.push({
      code: "non-finite-target",
      detail: `the acceptance target is not a finite number (got ${String(a.target)}) — a non-finite target is not a reachable, comparable bound.`,
    });
  }
  if (!hasPositiveBudgetAxis(raw.budget)) {
    rejections.push({
      code: "malformed-budget",
      detail: "the budget has no positive axis — a zero / absent / ≤0 budget (max_turns / max_cost_cents / max_wallclock_seconds) can make no progress and cannot bound the run (fail-closed).",
    });
  }
  return rejections;
}

/** A budget is admissible iff at least one axis is a finite number > 0. */
export function hasPositiveBudgetAxis(b: BudgetCap | undefined): boolean {
  if (!b) return false;
  const axes = [b.max_turns, b.max_cost_cents, b.max_wallclock_seconds];
  return axes.some((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
}

/** Derive the frozen structured acceptance {op,target,direction} from the submission's acceptance block. */
export function deriveAcceptanceShape(a: RawAcceptance | undefined): AcceptanceShape {
  return { op: a?.op, target: a?.target, direction: a?.direction };
}

/**
 * Parse a /goal submission into the controller's GoalSubmission. FAIL-CLOSED:
 *   1. IDENTITY first — only the verified founder may submit; non-founder/absent/forged ⇒ rejected, no submission.
 *   2. CONTENT — measurable acceptance + a comparable, finite target + a positive budget; else rejected.
 * A well-formed founder submission yields { ok:true, submission } ready for runGoalLifecycle (which runs the
 * full C9 pre-flight gate inside the controller — defense in depth).
 */
export function parseGoalSubmission(raw: RawGoalSubmission, identity: VerifiedIdentity | null | undefined, ctx: IntakeContext): ParseResult {
  const binding = ctx.founder ?? resolveFounderBinding();
  const idCheck = checkFounderIdentity(identity, binding);
  if (!idCheck.ok) {
    return {
      ok: false,
      rejections: [{ code: idCheck.rejection!.code, detail: idCheck.rejection!.detail }],
      identity: { accepted: false },
    };
  }

  const content = validateContent(raw);
  if (content.length > 0) {
    return { ok: false, rejections: content, identity: { accepted: true, founderSubjectId: idCheck.founderSubjectId } };
  }

  // Well-formed → build the PreflightGoal + the controller GoalSubmission (shape-exact to po-autoloop-c2).
  const a = raw.acceptance!;
  const metricLabel = a.metric && a.metric.trim() !== "" ? a.metric : a.probeId!;
  const acceptanceCriterion: AcceptanceCriterion = { metric: metricLabel, op: a.op, target: a.target, direction: a.direction };
  const goal: PreflightGoal = {
    goalId: raw.goalId,
    objective: raw.objective!.trim(),
    acceptanceMetric: metricLabel,
    metricSourceProbeId: a.probeId!,
    metricSourceVersion: a.probeVersion ?? 1,
    budgetCap: raw.budget!,
    acceptance: acceptanceCriterion,
    requiredConfigKeys: raw.requiredConfigKeys,
  };
  const preflightCtx: PreflightContext = {
    targetEnv: ctx.targetEnv,
    probeRegistry: ctx.probeRegistry,
    configReadiness: ctx.configReadiness,
    reachability: ctx.reachability,
  };
  const submission: GoalSubmission = { goal, preflightCtx };

  return {
    ok: true,
    submission,
    acceptance: deriveAcceptanceShape(a),
    budgetCap: raw.budget!,
    rejections: [],
    identity: { accepted: true, founderSubjectId: idCheck.founderSubjectId },
  };
}

// =============================================================================
// submitGoal — parse + (if admitted) drive the controller in SHADOW. The full SUBMIT surface.
// =============================================================================

/** The lifecycle seams the host supplies for the controller (the observe + review fixtures in SHADOW; in the
 *  built runtime these are the GS re-probe + the C6 independent re-probe). The intake fills `acceptance` and
 *  `budgetCap` from the PARSED submission (the founder's frozen acceptance/budget), so they are never guessed. */
export type IntakeLifecycleSeams = Omit<LifecycleContext, "acceptance" | "budgetCap">;

export interface SubmitContext extends IntakeContext {
  /** the lifecycle seams (observe + review + summon options + maxTicks …) the controller needs. */
  lifecycle: IntakeLifecycleSeams;
  /** ENFORCE: drive REAL §4.3 transitions (TEST-DB fixtures ONLY — never a live goal). Default SHADOW. */
  enforce?: boolean;
}

export interface SubmitResult {
  accepted: boolean;
  posture: "SHADOW" | "ENFORCE";
  parse: ParseResult;
  /** the controller lifecycle result — present IFF the submission was admitted by the intake. */
  lifecycle: LifecycleResult | null;
}

export async function submitGoal(raw: RawGoalSubmission, identity: VerifiedIdentity | null | undefined, ctx: SubmitContext): Promise<SubmitResult> {
  const enforce = ctx.enforce === true;
  const posture: "SHADOW" | "ENFORCE" = enforce ? "ENFORCE" : "SHADOW";
  const parse = parseGoalSubmission(raw, identity, ctx);
  if (!parse.ok) {
    return { accepted: false, posture, parse, lifecycle: null };
  }
  const lifecycleCtx: LifecycleContext = {
    ...ctx.lifecycle,
    acceptance: parse.acceptance!, //   the FROZEN acceptance derived from the founder's submission
    budgetCap: parse.budgetCap!, //     the FROZEN H1 budget from the founder's submission
    enforce,
  };
  const lifecycle = await runGoalLifecycle(parse.submission!, lifecycleCtx);
  return { accepted: true, posture, parse, lifecycle };
}

// =============================================================================
// APPROVE — the FAP-approval handler. The founder's response to a delivered summon → a §4.3 resume.
// =============================================================================

/** The founder's structured decision on a delivered FAP. Mapped to the §4.3 HALTED founder-decision edges:
 *    APPROVE → accept-lower-bar → HALTED→REVIEWING   (accept the current independently-measured state)
 *    MODIFY  → redirect         → HALTED→PLANNING    (amend the objective / give a new lever, re-plan)
 *    ABORT   → kill             → HALTED→CLOSED      (withdraw the goal — stop spending) */
export type FapDecision = "APPROVE" | "MODIFY" | "ABORT";

export interface FapResponse {
  /** the id of the delivered FAP being responded to (the summon's correlation id). */
  fapId: string;
  /** the goal the FAP concerns (cross-checked against the FAP store). */
  goalId: string;
  decision: FapDecision;
  /** the founder's redirect note (MODIFY) / accept rationale — carried for audit, never executes anything. */
  note?: string;
}

/** A delivered, OPEN FAP awaiting the founder's response — the registry the approval handler consults so an
 *  unknown / already-resolved / expired FAP id triggers NO silent action. In the built runtime this is the
 *  durable founder-audit sink (the summon's durable record); here it is an injectable store. */
export interface OpenFap {
  fapId: string;
  goalId: string;
  boundaryClass: BoundaryClass;
  source: FapSource;
  status: "open" | "resolved" | "expired";
}

export interface FapStore {
  /** resolve a FAP id → its open record (null if never delivered / unknown). */
  lookup(fapId: string): Promise<OpenFap | null>;
  /** mark a FAP resolved by the founder's decision (idempotency: a second response is then "resolved"). */
  resolve(fapId: string, decision: FapDecision): Promise<void>;
}

/** An in-memory FAP store (SHADOW / tests). The built runtime backs this with the durable founder-audit sink. */
export function inMemoryFapStore(initial: OpenFap[] = []): FapStore & { add(fap: OpenFap): void; all(): OpenFap[] } {
  const byId = new Map<string, OpenFap>(initial.map((f) => [f.fapId, { ...f }]));
  return {
    add(fap: OpenFap) { byId.set(fap.fapId, { ...fap }); },
    all() { return [...byId.values()]; },
    async lookup(fapId: string) { return byId.get(fapId) ?? null; },
    async resolve(fapId: string, _decision: FapDecision) {
      const f = byId.get(fapId);
      if (f) f.status = "resolved";
    },
  };
}

/** Derive an OpenFap from a delivered SummonResult so the approval handler can later match the founder's
 *  response to the exact summon that was delivered. The fapId defaults to a stable, deterministic correlation
 *  key (goal_id + boundary_class) when none is supplied. */
export function openFapFromSummon(summon: SummonResult, fapId?: string): OpenFap {
  return {
    fapId: fapId ?? `${summon.goal_id}:${summon.boundary_class}`,
    goalId: summon.goal_id,
    boundaryClass: summon.boundary_class,
    source: summon.source,
    status: "open",
  };
}

export type ApprovalRejectionCode =
  | IdentityRejectionCode
  | "no-decision" //          absent / unknown decision token
  | "unknown-fap" //          the FAP id was never delivered (no silent action on a phantom summon)
  | "fap-already-resolved" // the FAP was already responded to (idempotency — no double-resume)
  | "expired-fap" //          the FAP has expired
  | "fap-goal-mismatch" //    the FAP id maps to a DIFFERENT goal than the response claims
  | "goal-not-found" //       the contract could not be read
  | "not-resumable-state"; // the contract is not at a resumable §4.3 boundary (only HALTED resumes here)

export interface ApprovalRejection {
  code: ApprovalRejectionCode;
  detail: string;
}

/** The contract-read seam (ENFORCE = the durable readContract; SHADOW = an injected fixture contract). */
export type ContractReader = (goalId: string) => Promise<GoalContractRow | null>;

export interface ApprovalContext {
  /** the configured founder binding (default = resolveFounderBinding() ← env, fail-closed if unset). */
  founder?: FounderBinding;
  /** the delivered-FAP registry (unknown/expired/resolved ⇒ no silent action). */
  fapStore: FapStore;
  /** read the durable contract to resume (default = goal-contract.readContract). Inject a fixture in SHADOW. */
  readContract?: ContractReader;
  /** ENFORCE: apply the REAL §4.3 founder-decision edge (TEST-DB fixtures only). Default SHADOW (drafted). */
  enforce?: boolean;
}

export interface ApprovalResume {
  /** the §4.3 founder-decision edge the decision maps to. */
  edge: LegalEdge;
  /** the reconcile plan routed through the SOLE-MUTATOR door (applyReconcilePlan), §15-preserving. */
  plan: ReconcilePlan;
  /** the apply result (executed:true ONLY in ENFORCE; SHADOW drafts executed:false). */
  execution: ReconcileExecution;
  /** the resulting state (the real post-transition state in ENFORCE; the would-be state in SHADOW). */
  resultingState: GoalState | null;
}

export interface ApprovalResult {
  ok: boolean;
  posture: "SHADOW" | "ENFORCE";
  rejection?: ApprovalRejection;
  decision?: FapDecision;
  goalId?: string;
  /** the §4.3 resume — present IFF ok. */
  resume?: ApprovalResume;
  /** the verified founder subject id, present iff identity passed. */
  founderSubjectId?: string;
}

const VALID_DECISIONS: ReadonlySet<string> = new Set(["APPROVE", "MODIFY", "ABORT"]);

/** The decision → §4.3 founder-decision edge mapping (from HALTED). */
function founderDecisionEdge(decision: FapDecision): { to: GoalState; guard: string; rationale: string } {
  switch (decision) {
    case "APPROVE":
      return { to: "REVIEWING", guard: "founder-decision:accept-lower-bar", rationale: "the founder ACCEPTS the current independently-measured state — re-evaluate at REVIEWING (HALTED→REVIEWING, §4.3)." };
    case "MODIFY":
      return { to: "PLANNING", guard: "founder-decision:redirect", rationale: "the founder REDIRECTS — amend the objective / supply a new lever and re-plan the next sprint (HALTED→PLANNING, §4.3)." };
    case "ABORT":
      return { to: "CLOSED", guard: "founder-decision:kill", rationale: "the founder KILLS the goal — stop spending; the contract closes (HALTED→CLOSED, §4.3)." };
  }
}

/** Build the founder-decision ReconcilePlan whose edge is the §4.3 HALTED→{REVIEWING|PLANNING|CLOSED} the
 *  founder chose. This is a CHOICE of which LEGAL edge to ask the reconciler to drive — it is NOT a second
 *  mutator: applyReconcilePlan performs the only transition() call, and the 0053 trigger independently
 *  re-validates the edge's legality. Modeled exactly on po-autoloop-c2's c6GatedPlan. */
function founderDecisionPlan(contract: GoalContractRow, decision: FapDecision): { plan: ReconcilePlan; edge: LegalEdge } {
  const target = founderDecisionEdge(decision);
  const edge: LegalEdge = { from: "HALTED", to: target.to, guard: target.guard };
  // Reuse reconcile() over a minimal observed-state to get the observed_state summary + consumes provenance;
  // the SETTLED decision it returns for a HALTED contract is then OVERRIDDEN with the founder-decision edge.
  const observed: ObservedState = { progressSeries: [], attempts: 0, cumulativeCostCents: 0, gsVerdict: null };
  const base = reconcile(contract, observed);
  const reconcileDecision: ReconcileDecision = decision === "ABORT" ? "EXECUTE_HALT" : "CONTINUE"; // labelling only — the edge is authoritative
  const plan: ReconcilePlan = {
    ...base,
    desired_state: target.to,
    diff: `FOUNDER-DECISION resume: the founder responded ${decision} to the delivered FAP → drive the §4.3 founder-only edge HALTED→${target.to} (${target.guard}). ${target.rationale}`,
    decision: reconcileDecision,
    next_transition: edge,
    chain: [edge],
    actions: [
      `the FOUNDER owns this decision (${decision}) → ask the reconciler to drive the legal edge HALTED→${target.to} (${target.guard}); applyReconcilePlan EXECUTES it (the SOLE mutator, §15).`,
      target.rationale,
    ],
  };
  return { plan, edge };
}

/**
 * Handle the founder's response to a delivered FAP → a structured {APPROVE|MODIFY|ABORT} decision that RESUMES
 * the lifecycle via the §4.3 founder-decision edges, through applyReconcilePlan (the reconciler's sole-mutator
 * door, §15). FAIL-CLOSED at every gate:
 *   · IDENTITY-BOUND — only the verified founder may approve; non-founder / absent / forged ⇒ rejected.
 *   · the FAP id must be a KNOWN, OPEN, delivered summon for THIS goal — unknown / expired / already-resolved
 *     ⇒ rejected (no silent action on a phantom or replayed summon).
 *   · the contract must be at a RESUMABLE §4.3 boundary (HALTED) — else rejected.
 * NEVER a second mutator: this module never calls goal-contract.transition(); the only mutation door is
 * applyReconcilePlan. SHADOW drafts the resume (executed:false); ENFORCE applies it on a TEST-DB fixture only.
 */
export async function approveFap(response: FapResponse, identity: VerifiedIdentity | null | undefined, ctx: ApprovalContext): Promise<ApprovalResult> {
  const enforce = ctx.enforce === true;
  const posture: "SHADOW" | "ENFORCE" = enforce ? "ENFORCE" : "SHADOW";
  const binding = ctx.founder ?? resolveFounderBinding();

  // ── (1) IDENTITY — only the verified founder may approve. ──
  const idCheck = checkFounderIdentity(identity, binding);
  if (!idCheck.ok) {
    return { ok: false, posture, rejection: { code: idCheck.rejection!.code, detail: idCheck.rejection!.detail } };
  }

  // ── (2) DECISION — a known token. ──
  if (!response || !VALID_DECISIONS.has(response.decision)) {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "no-decision", detail: `unknown / absent decision '${response?.decision}' — must be APPROVE | MODIFY | ABORT.` } };
  }

  // ── (3) FAP lookup — the summon must be a KNOWN, OPEN, delivered FAP for THIS goal (no silent action). ──
  const open = await ctx.fapStore.lookup(response.fapId);
  if (!open) {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "unknown-fap", detail: `FAP '${response.fapId}' was never delivered (unknown) — refused; the front door takes no action on a phantom summon.` } };
  }
  if (open.status === "expired") {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "expired-fap", detail: `FAP '${response.fapId}' has expired — refused (no action on a stale summon).` } };
  }
  if (open.status === "resolved") {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "fap-already-resolved", detail: `FAP '${response.fapId}' was already responded to — refused (idempotency: no double-resume).` } };
  }
  if (open.goalId !== response.goalId) {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "fap-goal-mismatch", detail: `FAP '${response.fapId}' concerns goal '${open.goalId}', not '${response.goalId}' — refused.` } };
  }

  // ── (4) read the contract; it must be at a RESUMABLE §4.3 boundary (HALTED). ──
  const reader = ctx.readContract ?? dbReadContract;
  const contract = await reader(open.goalId);
  if (!contract) {
    return { ok: false, posture, founderSubjectId: idCheck.founderSubjectId, rejection: { code: "goal-not-found", detail: `goal_contract '${open.goalId}' not found — cannot resume.` } };
  }
  if (contract.state !== "HALTED") {
    return {
      ok: false,
      posture,
      founderSubjectId: idCheck.founderSubjectId,
      rejection: {
        code: "not-resumable-state",
        detail: `goal '${open.goalId}' is ${contract.state}, not HALTED — the founder-decision resume edges (HALTED→REVIEWING|PLANNING|CLOSED) only apply at a HALTED boundary (§4.3).`,
      },
    };
  }

  // ── (5) RESUME via the SOLE-MUTATOR door — build the founder-decision plan and apply it. ──
  const { plan, edge } = founderDecisionPlan(contract, response.decision);
  const execution = await applyReconcilePlan(plan, { enforce });

  // ── (6) mark the FAP resolved (idempotency — a replay is then "already-resolved"). ──
  await ctx.fapStore.resolve(response.fapId, response.decision);

  return {
    ok: true,
    posture,
    decision: response.decision,
    goalId: open.goalId,
    founderSubjectId: idCheck.founderSubjectId,
    resume: { edge, plan, execution, resultingState: execution.resulting_state },
  };
}

// =============================================================================
// THE DEFERRED REAL SLACK TRANSPORT (the enforce-flip) — modeled on §36.3's deferred LLM. Every method THROWS.
// =============================================================================
// The real Slack surface — the /goal slash-command, the interactive approval buttons, the Slack app +
// credentials, and the request-signature verification that produces a VerifiedIdentity — is the enforce-flip.
// It is a DEFERRED seam: each method throws "DEFERRED" so NO path silently calls real Slack. In production the
// signed transport's verifyIdentity is the ONLY producer of VerifiedIdentity{verified:true}; with it deferred,
// identity verification fails closed (no real founder can be authenticated, so nothing real is admitted). A
// later slice wires the real Slack app + credentials with ZERO changes to the intake/approval logic above.
export interface SlackTransport {
  /** verify a signed Slack request → a VerifiedIdentity (the ONLY producer of verified:true in production). */
  verifyIdentity(req: unknown): Promise<VerifiedIdentity>;
  /** receive a /goal slash-command submission (signature-verified) → { raw submission, verified identity }. */
  receiveGoalSubmission(req: unknown): Promise<{ raw: RawGoalSubmission; identity: VerifiedIdentity }>;
  /** receive an interactive approval (button click, signature-verified) → { fap response, verified identity }. */
  receiveFapResponse(req: unknown): Promise<{ response: FapResponse; identity: VerifiedIdentity }>;
}

function deferred(method: string): never {
  throw new Error(
    `goal-intake-c1: realSlackTransport.${method} is DEFERRED (the enforce-flip) — the real Slack app + ` +
      `slash-command + interactive-approval transport + credentials + request-signature verification are a ` +
      `separate, panel-gated build (Sprint 5.3 enforce-flip); SHADOW parses fixture submissions/approvals and ` +
      `calls no real Slack. Wire the real transport here to flip enforce (zero changes to the intake logic).`,
  );
}

/** The DEFERRED real Slack transport. Every method throws — no path silently calls real Slack in this slice. */
export const realSlackTransport: SlackTransport = {
  async verifyIdentity() { return deferred("verifyIdentity"); },
  async receiveGoalSubmission() { return deferred("receiveGoalSubmission"); },
  async receiveFapResponse() { return deferred("receiveFapResponse"); },
};
