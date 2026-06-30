// =============================================================================
// The Goal-Intake (C1 front door) — the founder's SUBMIT + the FAP APPROVAL (RS-DOS-v1 C1 / §3 / §3.1 /
// §15 / §20 J1·J4·J5). The FRONT DOOR into the goal-lifecycle controller (po-autoloop): a goal can be SUBMITTED
// and a summon can be APPROVED — by the FOUNDER, fail-closed against everyone else.
// =============================================================================
// PLATFORM EXTRACTION SLICE 4 — the port-injected mirror of `rumah-admin/src/goal-intake-c1.ts`. It COMPOSES the
// now-inverted organs (it re-implements NONE):
//   SUBMIT  (J1)  parseGoalSubmission(raw, identity, ctx) → { ok, submission?, rejections[] }, then submitGoal
//                 hands a VALID submission to the controller's `runLifecycle` (the port-bound runGoalLifecycle).
//   APPROVE (J4/J5) approveFap(response, identity, ctx) → a structured {APPROVE|MODIFY|ABORT} decision that
//                 RESUMES the lifecycle via the §4.3 founder-decision edges, through the reconciler's SOLE-MUTATOR
//                 door (`applyReconcilePlan`, §15). This module NEVER calls `transition()` and is NEVER a second
//                 state mutator.
//
// WHAT CHANGED vs admin (and ONLY this): the residency couplings. Admin (1) read the founder id straight from
// `process.env.RUNTIME_FOUNDER_ID` (`resolveFounderBinding`), (2) imported the DB `readContract` value
// (`dbReadContract`) as the approval reader default, and (3) called the free `applyReconcilePlan` value. THIS
// module reads NO `process.env` — the founder binding is supplied via the injected `FounderBindingPort` (or an
// explicit `ctx.founder`); the approval reader + the reconciler (the sole-mutator door) are INJECTED (`ctx.contract`
// / `ctx.reconciler`), with NO DB default; and `applyReconcilePlan` is the reconciler-instance method. The
// IDENTITY-BINDING fail-closed logic, the FAP-approval replay/forge guards, the content validation, and the §15-
// preserving resume are BYTE-FOR-BYTE the verified admin logic. Residency is enforced by `residency-guard.mjs`.
//
// ── IDENTITY-BINDING (load-bearing — §3.1 "approvals are identity-bound, not channel membership") ──
//   ONLY the founder may submit a goal or approve a FAP. The founder identity is a VERIFIED field produced by a
//   signed control path (the request-signature transport) — NOT a self-asserted string the caller can spoof. The
//   intake binds to a CONFIGURED founder id and FAILS CLOSED if it is UNSET (no configured founder ⇒ nobody can
//   be verified ⇒ refuse everyone). A non-founder, an absent, or a forged/unverified identity is REJECTED — no
//   contract, no resume, no action. With the FounderBindingPort returning founderId:null, every submit/approve
//   is rejected (the fail-closed default).
//
// ── SHADOW posture (unchanged) ──
//   DEFAULT = SHADOW: parse fixture submissions/approvals (the verified identity is injected, simulating the
//   signed transport) and drive the controller in SHADOW (executed:false, no DB, no live goal). ENFORCE proves
//   the capability against in-memory / TEST-DB fixtures only. The REAL signed transport is a DEFERRED seam
//   (realSlackTransport throws "DEFERRED") — no path silently calls a real channel.
// =============================================================================

import type {
  PreflightGoal,
  PreflightContext,
  AcceptanceCriterion,
  AcceptanceOp,
  ReachabilitySource,
} from "./preflight.js";
import type {
  BudgetCap,
  GoalContractRow,
  GoalState,
  ConfigReadinessFn,
  FounderBinding,
  FounderBindingPort,
  GoalContractStorePort,
} from "./ports.js";
import type { AcceptanceShape } from "./goal-supervisor.js";
import {
  type GoalSubmission,
  type LifecycleContext,
  type LifecycleResult,
} from "./po-autoloop.js";
import {
  reconcile,
  createReconciler,
  type Reconciler,
  type ReconcilePlan,
  type ReconcileExecution,
  type LegalEdge,
  type ReconcileDecision,
  type ObservedState,
} from "./reconciler.js";
import type { SummonResult, BoundaryClass, FapSource } from "./founder-summon.js";

// Re-export the FounderBinding type (lifted to ports.js in slice 3) under the intake's original name so a
// consumer/organ that imports it from "./goal-intake.js" keeps the identical import shape after extraction.
export type { FounderBinding, FounderBindingPort } from "./ports.js";

// =============================================================================
// IDENTITY — the VERIFIED founder identity + the configured binding (§3.1).
// =============================================================================

/** A VERIFIED identity produced by the SIGNED control path (the request-signature transport). The `verified`
 *  flag is set by the transport ONLY — never by the caller. A self-asserted message body that merely claims a
 *  subject id arrives with verified:false (it is not from the signed path) and is inert. */
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

/** Resolve the founder binding from an explicit override (test/injection) — RESIDENCY-CLEAN: it reads NO
 *  `process.env`. With no override it returns the FAIL-CLOSED default (founderId:null ⇒ reject everyone). In
 *  production the binding comes from the injected `FounderBindingPort` (`resolveFounderBindingFromPort`); a
 *  null founderId is the fail-closed default exactly as admin's UNSET env was. */
export function resolveFounderBinding(over?: Partial<FounderBinding>): FounderBinding {
  if (over && over.founderId !== undefined) {
    return { founderId: over.founderId, source: over.source ?? "injected (test/override)" };
  }
  return {
    founderId: null,
    source: "no FounderBindingPort / override supplied (UNSET — fail-closed: no founder configured)",
  };
}

/** Resolve the founder binding from the INJECTED `FounderBindingPort` (the consumer's config registry — NEVER a
 *  raw `process.env` read in the package). A null founderId is the fail-closed default. */
export async function resolveFounderBindingFromPort(port: FounderBindingPort): Promise<FounderBinding> {
  return port.resolveFounderBinding();
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
        detail: `identity '${identity.subjectId}' is NOT verified by the signed control path (verified=${String(identity.verified)}) — a self-asserted / forged / unsigned identity is inert (only the request-signature transport sets verified:true).`,
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
  /** the configured founder binding (default = resolveFounderBinding() ← fail-closed if unset). */
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
 * A well-formed founder submission yields { ok:true, submission } ready for runLifecycle (which runs the full
 * C9 pre-flight gate inside the controller — defense in depth).
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

  // Well-formed → build the PreflightGoal + the controller GoalSubmission (shape-exact to po-autoloop).
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

/** The port-bound controller entry — `createGoalLifecycleController(ports).runGoalLifecycle`. INJECTED (the
 *  package has no DB default; the controller is composed onto the consumer's store ports). */
export type RunGoalLifecycle = (submission: GoalSubmission, ctx: LifecycleContext) => Promise<LifecycleResult>;

export interface SubmitContext extends IntakeContext {
  /** the lifecycle seams (observe + review + summon options + maxTicks …) the controller needs. */
  lifecycle: IntakeLifecycleSeams;
  /** the port-bound controller entry (createGoalLifecycleController(ports).runGoalLifecycle). REQUIRED. */
  runLifecycle: RunGoalLifecycle;
  /** ENFORCE: drive REAL §4.3 transitions (in-memory / TEST-DB fixtures ONLY — never a live goal). Default SHADOW. */
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
  const lifecycle = await ctx.runLifecycle(parse.submission!, lifecycleCtx);
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
  /** the configured founder binding (default = resolveFounderBinding() ← fail-closed if unset). */
  founder?: FounderBinding;
  /** the delivered-FAP registry (unknown/expired/resolved ⇒ no silent action). */
  fapStore: FapStore;
  /** read the durable contract to resume. Inject a fixture in SHADOW, or supply `contract` (the port) below.
   *  RESIDENCY: there is NO DB default — one of `readContract` / `contract` MUST be supplied. */
  readContract?: ContractReader;
  /** the contract store port — derives the reader AND the reconciler (the sole-mutator door) if not given. */
  contract?: GoalContractStorePort;
  /** the reconciler (the sole-mutator door). Default = createReconciler(ctx.contract). One of `reconciler` /
   *  `contract` MUST be supplied (no DB default — the package never instantiates a store itself). */
  reconciler?: Reconciler;
  /** ENFORCE: apply the REAL §4.3 founder-decision edge (in-memory / TEST-DB fixtures only). Default SHADOW. */
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
 *  re-validates the edge's legality. Modeled exactly on po-autoloop's c6GatedPlan. (PURE — `reconcile` only.) */
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
 * NEVER a second mutator: this module never calls transition(); the only mutation door is applyReconcilePlan.
 * SHADOW drafts the resume (executed:false); ENFORCE applies it on an in-memory / TEST-DB fixture only.
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
  // RESIDENCY: the reader is INJECTED — `ctx.readContract` or derived from the injected contract port. No DB default.
  const reader: ContractReader | undefined = ctx.readContract ?? (ctx.contract ? (id: string) => ctx.contract!.readContract(id) : undefined);
  if (!reader) {
    throw new Error("goal-intake: approveFap needs a contract reader — supply ctx.readContract or ctx.contract (the package has no DB default; residency invariant)");
  }
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

  // ── (5) RESUME via the SOLE-MUTATOR door — build the founder-decision plan and apply it through the reconciler. ──
  // RESIDENCY: the reconciler (the sole-mutator door) is INJECTED — `ctx.reconciler` or derived from the contract port.
  const reconciler: Reconciler | undefined = ctx.reconciler ?? (ctx.contract ? createReconciler(ctx.contract) : undefined);
  if (!reconciler) {
    throw new Error("goal-intake: approveFap needs the reconciler (the sole-mutator door) — supply ctx.reconciler or ctx.contract (no DB default; §15 + residency)");
  }
  const { plan, edge } = founderDecisionPlan(contract, response.decision);
  const execution = await reconciler.applyReconcilePlan(plan, { enforce });

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
// THE DEFERRED REAL SIGNED TRANSPORT (the enforce-flip) — modeled on §36.3's deferred LLM. Every method THROWS.
// =============================================================================
// The real signed surface — the slash-command, the interactive approval buttons, the app + credentials, and the
// request-signature verification that produces a VerifiedIdentity — is the enforce-flip. It is a DEFERRED seam:
// each method throws "DEFERRED" so NO path silently calls a real channel. In production the signed transport's
// verifyIdentity is the ONLY producer of VerifiedIdentity{verified:true}; with it deferred, identity verification
// fails closed (no real founder can be authenticated, so nothing real is admitted). A later slice wires the real
// transport with ZERO changes to the intake/approval logic above.
export interface SignedTransport {
  /** verify a signed request → a VerifiedIdentity (the ONLY producer of verified:true in production). */
  verifyIdentity(req: unknown): Promise<VerifiedIdentity>;
  /** receive a /goal submission (signature-verified) → { raw submission, verified identity }. */
  receiveGoalSubmission(req: unknown): Promise<{ raw: RawGoalSubmission; identity: VerifiedIdentity }>;
  /** receive an interactive approval (button click, signature-verified) → { fap response, verified identity }. */
  receiveFapResponse(req: unknown): Promise<{ response: FapResponse; identity: VerifiedIdentity }>;
}

function deferred(method: string): never {
  throw new Error(
    `goal-intake: realSignedTransport.${method} is DEFERRED (the enforce-flip) — the real app + slash-command + ` +
      `interactive-approval transport + credentials + request-signature verification are a separate, ` +
      `panel-gated build; SHADOW parses fixture submissions/approvals and calls no real channel. Wire the real ` +
      `transport here to flip enforce (zero changes to the intake logic).`,
  );
}

/** The DEFERRED real signed transport. Every method throws — no path silently calls a real channel in this slice. */
export const realSlackTransport: SignedTransport = {
  async verifyIdentity() { return deferred("verifyIdentity"); },
  async receiveGoalSubmission() { return deferred("receiveGoalSubmission"); },
  async receiveFapResponse() { return deferred("receiveFapResponse"); },
};
