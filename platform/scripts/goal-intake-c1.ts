#!/usr/bin/env tsx
// =============================================================================
// The Goal-Intake (C1 front door) — CLI (RS-DOS-v1 C1 / §3 / §3.1 / §15 / §20 J1·J4·J5 · MMB Sprint 5.3).
// =============================================================================
// SHADOW posture by default: parses FIXTURE /goal submissions + FAP approvals, drives the controller in SHADOW
// (no DB, no live goal), prints the would-admit / would-resume, calls NO real Slack, and EXITS 0. The real Slack
// transport (the slash-command + interactive approval + the Slack app/credentials + signature verification) is
// the DEFERRED enforce-flip.
//
//   (default)       SHADOW: walk the submit (admit / reject / non-founder) + approve (resume / reject) fixtures.
//   --self-test     PURE, OFFLINE proof: a founder submit → ADMITTED (through the controller, a contract
//                   drafted); a malformed submit (no metric / no budget / non-finite target) → REJECTED with
//                   the reason; a NON-FOUNDER / unverified / unbound identity → REJECTED (no contract); a
//                   founder FAP APPROVE → lifecycle resumes (shadow); a non-founder / unknown / expired FAP →
//                   REJECTED; the Slack transport stays DEFERRED (no real call). No DB.
//   --db-self-test  drives REAL §4.3 transitions against TEST-DB FIXTURE goals (RUMAH_ENV=test forced): a
//                   founder submit → ADMITTED + the durable contract; a HALTED contract + a founder APPROVE →
//                   a REAL HALTED→REVIEWING resume. This is the --enforce capability — TEST-DB only, no live goal.
//   --facts <file>  run a supplied {raw, identity, …} submit fixture in SHADOW (report-only).
//
//   --enforce  proves the real-capability. OFF by default behind a loud banner: the enforce-flip that takes a
//              real Slack submission / approval and runs a LIVE goal is a FOUNDER ★ decision + the real Slack
//              app (Sprint 5.3). Even with --enforce this CLI operates on a TEST-DB fixture goal — NEVER prod.
// =============================================================================

import { readFileSync } from "node:fs";
import {
  parseGoalSubmission,
  submitGoal,
  approveFap,
  resolveFounderBinding,
  inMemoryFapStore,
  openFapFromSummon,
  realSlackTransport,
  type RawGoalSubmission,
  type VerifiedIdentity,
  type FounderBinding,
  type IntakeContext,
  type SubmitContext,
  type IntakeLifecycleSeams,
  type ApprovalContext,
  type SubmitResult,
  type ParseResult,
  type ApprovalResult,
  type FapDecision,
  type OpenFap,
} from "../src/goal-intake-c1.js";
import { ProbeRegistry, type MetricProbe } from "../src/metric-probe.js";
import type { PreflightContext, ReachabilitySource } from "../src/preflight-gate-c9.js";
import type { ReachabilityVerdict } from "../src/reachability-evaluator.js";
import type { AcceptanceShape, ProgressPoint } from "../src/goal-supervisor-c7.js";
import type { ObservedTickInput, LifecycleResult } from "../src/po-autoloop-c2.js";
import type { GoalContractRow } from "../src/goal-contract.js";

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opts = { selfTest: false, dbSelfTest: false, enforce: false, facts: null as string | null, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--self-test") opts.selfTest = true;
  else if (a === "--db-self-test") { opts.dbSelfTest = true; opts.enforce = true; }
  else if (a === "--enforce") opts.enforce = true;
  else if (a === "--facts") opts.facts = String(argv[++i]);
  else if (a === "--json") opts.json = true;
  else if (a === "-h" || a === "--help") { process.stdout.write(usage()); process.exit(0); }
  else { process.stderr.write(`goal-intake-c1: unknown flag "${a}" (try --help)\n`); process.exit(2); }
}

function usage(): string {
  return (
    "C1 goal-intake front door (RS-DOS §3/§3.1/§15). SHADOW/report-only by default (exit 0). Calls no real Slack.\n" +
    "The founder SUBMITs a goal + APPROVEs a summon; identity-bound; fail-closed; the controller runs in SHADOW.\n\n" +
    "  tsx scripts/goal-intake-c1.ts                      # SHADOW: walk the submit + approve fixtures (exit 0)\n" +
    "  tsx scripts/goal-intake-c1.ts --self-test          # pure offline: admit/reject/identity + approve/resume + DEFERRED\n" +
    "  tsx scripts/goal-intake-c1.ts --db-self-test       # real §4.3 submit+resume on TEST-DB fixtures (founder ★)\n" +
    "  tsx scripts/goal-intake-c1.ts --facts <file.json>  # run a supplied submit fixture in SHADOW\n"
  );
}

function enforceBanner(): void {
  const L = (s = "") => process.stderr.write(s + "\n");
  L("");
  L("============================================================================");
  L("  !! --enforce / --db-self-test — REAL CAPABILITY (intake + §4.3 resume) !!");
  L("  The enforce-flip that takes a REAL Slack /goal submission or interactive");
  L("  approval and runs a LIVE goal is a FOUNDER ★ decision and needs the real");
  L("  Slack app + slash-command + signature verification (Sprint 5.3). This run");
  L("  operates ONLY on TEST-DB FIXTURE goals (RUMAH_ENV=test) — NO production goal");
  L("  is transitioned, and NO real Slack is ever called.");
  L("============================================================================");
  L("");
}

// =============================================================================
// Fixtures — a registered probe, the founder binding, identities, the submit context, the lifecycle seams.
// =============================================================================
const FOUNDER_ID = "U-FOUNDER-RUMAH";
const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };

function founderBinding(): FounderBinding {
  return resolveFounderBinding({ founderId: FOUNDER_ID, source: "test fixture" });
}

/** A VERIFIED founder identity (the signed transport WOULD produce this). */
function founderIdentity(): VerifiedIdentity {
  return { subjectId: FOUNDER_ID, verified: true, method: "slack-request-signature (fixture)", display: "Founder" };
}
/** A VERIFIED but NON-founder identity (a real Slack user who is not the founder). */
function nonFounderIdentity(): VerifiedIdentity {
  return { subjectId: "U-RANDOM-STAFFER", verified: true, method: "slack-request-signature (fixture)", display: "Staffer" };
}
/** A FORGED / self-asserted identity claiming to be the founder but NOT from the signed path (verified:false). */
function forgedFounderIdentity(): VerifiedIdentity {
  return { subjectId: FOUNDER_ID, verified: false, method: "(unsigned message body — self-asserted)", display: "Imposter" };
}

function probeRegistry(): ProbeRegistry {
  const registry = new ProbeRegistry();
  const probe: MetricProbe = {
    probe_id: "invoice-delivery-coverage", version: 1, metric_kind: "ratio", type: "sql",
    target: "SELECT 1.0::numeric AS value", expected_shape: "1 row, col value::numeric",
    credential_ref: "PROBE_RO_URL", extract: (rows) => Number((rows[0] as any)?.value ?? null),
  };
  registry.register(probe);
  return registry;
}

const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "100% delivery coverage is reachable; the delivery engine exists." };
const ALL_CONFIG_PRESENT = async () => [];

function intakeContext(): IntakeContext {
  return {
    founder: founderBinding(),
    targetEnv: "test",
    probeRegistry: probeRegistry(),
    configReadiness: ALL_CONFIG_PRESENT,
    reachability: { kind: "verdict", verdict: REACHABLE } as ReachabilitySource,
  };
}

/** A well-formed founder /goal submission: objective + measurable acceptance {probe id, target, op, direction}
 *  + a budget {max_turns, max_cost_cents}. */
function wellFormedSubmission(goalId = "submit-fixture"): RawGoalSubmission {
  return {
    goalId,
    objective: "reach 100% invoice delivery coverage",
    acceptance: { probeId: "invoice-delivery-coverage", probeVersion: 1, op: ">=", target: 1.0, direction: "increase", metric: "delivered_invoice_ratio" },
    budget: { ...BUDGET },
    requiredConfigKeys: [],
  };
}

/** An observe trajectory (the GS external re-read per tick — the executor that WOULD produce it is deferred). */
function trajectory(points: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>, startCycle: number) {
  return async (_goalId: string, tickIndex: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(tickIndex, points.length - 1)]!;
    return { cycle: startCycle + tickIndex, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost, fixRef: p.fixRef ?? null };
  };
}

/** The lifecycle seams (observe + review fixtures) — the intake fills acceptance/budget from the submission. */
function happySeams(reprobeValue = 1.0): IntakeLifecycleSeams {
  return {
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }] as ProgressPoint[],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobeValue, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}

function submitContext(seams = happySeams(), enforce = false): SubmitContext {
  return { ...intakeContext(), lifecycle: seams, enforce };
}

// =============================================================================
// Report
// =============================================================================
function printSubmit(r: SubmitResult, label?: string): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  if (label) L(`──────── ${label} ────────`);
  L(`accepted:   ${r.accepted}   posture ${r.posture}`);
  L(`identity:   accepted=${r.parse.identity.accepted}${r.parse.identity.founderSubjectId ? ` · founder ${r.parse.identity.founderSubjectId}` : ""}`);
  if (r.parse.rejections.length) {
    L(`rejections: ${r.parse.rejections.length}`);
    for (const rej of r.parse.rejections) L(`   · [${rej.code}] ${rej.detail}`);
  }
  if (r.lifecycle) {
    const lc = r.lifecycle;
    L(`lifecycle:  phase ${lc.phase} · pre-flight admit=${lc.preflight.admit}${lc.preflight.blockers.length ? ` (blockers: ${lc.preflight.blockers.map((b) => b.code).join(", ")})` : ""}`);
    if (lc.statePath.length) L(`state path: ${lc.statePath.join(" → ")}${lc.finalState ? `   (final: ${lc.finalState})` : ""}`);
    if (lc.summons.length) for (const s of lc.summons) L(`   SUMMON [${s.boundary_class}] ${s.source} → ${s.delivered_via} (dropped=${s.dropped})`);
  }
  L("");
}

function printApproval(r: ApprovalResult, label?: string): void {
  const L = (s = "") => process.stdout.write(s + "\n");
  if (label) L(`──────── ${label} ────────`);
  L(`ok:         ${r.ok}   posture ${r.posture}${r.decision ? ` · decision ${r.decision}` : ""}`);
  if (r.founderSubjectId) L(`founder:    ${r.founderSubjectId}`);
  if (r.rejection) L(`rejection:  [${r.rejection.code}] ${r.rejection.detail}`);
  if (r.resume) {
    L(`resume:     ${r.resume.edge.from}→${r.resume.edge.to} (${r.resume.edge.guard})  executed=${r.resume.execution.executed} → ${r.resume.resultingState}`);
  }
  L("");
}

// =============================================================================
// default — SHADOW: walk the submit + approve fixtures (report-only, exit 0).
// =============================================================================
async function shadowDemo(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  L("C1 goal-intake — SHADOW front-door walk (no DB, no live goal, no real Slack).\n");

  const admit = await submitGoal(wellFormedSubmission("happy"), founderIdentity(), submitContext());
  printSubmit(admit, "SUBMIT — founder + well-formed → ADMITTED (through the controller, a contract drafted)");

  const malformed = await submitGoal({ objective: "do something good", acceptance: {}, budget: {} }, founderIdentity(), submitContext());
  printSubmit(malformed, "SUBMIT — malformed (no metric / no target / no budget) → REJECTED fail-closed");

  const nonFounder = await submitGoal(wellFormedSubmission("nf"), nonFounderIdentity(), submitContext());
  printSubmit(nonFounder, "SUBMIT — verified NON-founder → REJECTED (no contract)");

  // APPROVE: a HALTED fixture contract + a delivered feasibility FAP → the founder resumes it.
  const halted = haltedFixtureContract("halted-goal");
  const store = inMemoryFapStore([{ fapId: "FAP-1", goalId: "halted-goal", boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" }]);
  const approveCtx: ApprovalContext = { founder: founderBinding(), fapStore: store, readContract: async () => halted };
  const approve = await approveFap({ fapId: "FAP-1", goalId: "halted-goal", decision: "MODIFY", note: "narrow the objective to the top 20 billers" }, founderIdentity(), approveCtx);
  printApproval(approve, "APPROVE — founder MODIFY on a HALTED feasibility FAP → resume HALTED→PLANNING (shadow)");

  L("SHADOW walk complete — exit 0 (drafted only; mutated nothing; called no real Slack).");
  process.exit(0);
}

/** A HALTED fixture GoalContractRow (no DB) — the resumable §4.3 boundary the approval handler reads. */
function haltedFixtureContract(goalId: string): GoalContractRow {
  const now = new Date();
  return {
    goalId, objective: "reach 100% invoice delivery coverage", acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL",
    budgetCap: { ...BUDGET }, goalDeltaLedgerRef: goalId, state: "HALTED", prevState: "REVIEWING", createdAt: now, updatedAt: now,
  };
}

// =============================================================================
// --self-test — PURE, OFFLINE. Real output. No DB.
// =============================================================================
async function selfTest(): Promise<void> {
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  // ── (A) FOUNDER + WELL-FORMED SUBMIT → ADMITTED (through the controller; a contract drafted) ──
  const admit = await submitGoal(wellFormedSubmission("happy"), founderIdentity(), submitContext());
  printSubmit(admit, "(A) SUBMIT — founder + well-formed → ADMITTED");
  check("SUBMIT/ADMIT: the founder submission is accepted by the intake", admit.accepted === true && admit.parse.ok === true);
  check("SUBMIT/ADMIT: the controller ADMITTED it at the pre-flight gate (a contract drafted)", admit.lifecycle?.phase === "ADMITTED" && admit.lifecycle?.preflight.admit === true && admit.lifecycle?.contract !== null);
  check("SUBMIT/ADMIT: the goal walked the lifecycle to DONE in SHADOW (drafted, executed:false)", admit.lifecycle?.finalState === "DONE" && admit.lifecycle!.ticks.every((t) => t.execution.executed === false));
  check("SUBMIT/ADMIT: the frozen acceptance was derived from the submission (>= 1)", admit.parse.acceptance?.op === ">=" && admit.parse.acceptance?.target === 1.0);

  // ── (B) MALFORMED SUBMITS → REJECTED fail-closed, with the SPECIFIC reason ──
  const noMetric = await submitGoal({ objective: "win", acceptance: { op: ">=", target: 1 }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  printSubmit(noMetric, "(B1) SUBMIT — no measurable acceptance (no probe id) → REJECTED");
  check("REJECT/no-metric: rejected with no-acceptance-metric (unmeasurable)", noMetric.accepted === false && noMetric.parse.rejections.some((r) => r.code === "no-acceptance-metric"));
  check("REJECT/no-metric: NO contract / NO lifecycle ran (refused at the front door)", noMetric.lifecycle === null);

  const noBudget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: 1 }, budget: {} }, founderIdentity(), submitContext());
  check("REJECT/no-budget: rejected with malformed-budget", noBudget.accepted === false && noBudget.parse.rejections.some((r) => r.code === "malformed-budget"));

  const zeroBudget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: 1 }, budget: { max_turns: 0, max_cost_cents: 0 } }, founderIdentity(), submitContext());
  check("REJECT/zero-budget: a ≤0 budget on every axis is malformed-budget", zeroBudget.accepted === false && zeroBudget.parse.rejections.some((r) => r.code === "malformed-budget"));

  const nonFinite = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: Number.POSITIVE_INFINITY }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  printSubmit(nonFinite, "(B2) SUBMIT — non-finite target → REJECTED");
  check("REJECT/non-finite: a non-finite target is rejected with non-finite-target", nonFinite.accepted === false && nonFinite.parse.rejections.some((r) => r.code === "non-finite-target"));

  const noTarget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage" }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  check("REJECT/no-target: a missing op/target is rejected with no-acceptance-target", noTarget.accepted === false && noTarget.parse.rejections.some((r) => r.code === "no-acceptance-target"));

  // ── (C) IDENTITY-BINDING — non-founder / unverified / absent / unbound → REJECTED (no contract) ──
  const nonFounder = await submitGoal(wellFormedSubmission("nf"), nonFounderIdentity(), submitContext());
  printSubmit(nonFounder, "(C1) SUBMIT — verified NON-founder → REJECTED");
  check("IDENTITY: a verified NON-founder is rejected (identity-not-founder), NO contract", nonFounder.accepted === false && nonFounder.parse.rejections.some((r) => r.code === "identity-not-founder") && nonFounder.lifecycle === null);

  const forged = await submitGoal(wellFormedSubmission("forged"), forgedFounderIdentity(), submitContext());
  printSubmit(forged, "(C2) SUBMIT — FORGED/self-asserted founder (verified:false) → REJECTED");
  check("IDENTITY: a forged/self-asserted identity (verified:false) is rejected (identity-unverified)", forged.accepted === false && forged.parse.rejections.some((r) => r.code === "identity-unverified") && forged.lifecycle === null);

  const absent = await submitGoal(wellFormedSubmission("absent"), null, submitContext());
  check("IDENTITY: an absent identity is rejected (identity-absent)", absent.accepted === false && absent.parse.rejections.some((r) => r.code === "identity-absent"));

  // unbound founder binding → fail-closed for EVERYONE (even a 'founder' subject id).
  const unboundCtx: SubmitContext = { ...submitContext(), founder: resolveFounderBinding({ founderId: null }) };
  const unbound = await submitGoal(wellFormedSubmission("unbound"), founderIdentity(), unboundCtx);
  check("IDENTITY: an UNSET founder binding fails closed for everyone (founder-binding-unset)", unbound.accepted === false && unbound.parse.rejections.some((r) => r.code === "founder-binding-unset"));

  // a pure parse (no controller) also rejects the non-founder identically.
  const parseNF: ParseResult = parseGoalSubmission(wellFormedSubmission("p"), nonFounderIdentity(), intakeContext());
  check("IDENTITY (parse): parseGoalSubmission alone rejects the non-founder with no submission", parseNF.ok === false && parseNF.submission === undefined);

  // ── (D) FAP APPROVAL — founder APPROVE/MODIFY/ABORT resumes the lifecycle (shadow, §15-preserving) ──
  const open: OpenFap = { fapId: "FAP-approve", goalId: "g-halted", boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" };
  const mkApprovalCtx = (faps: OpenFap[], contract: GoalContractRow | null): ApprovalContext => ({ founder: founderBinding(), fapStore: inMemoryFapStore(faps), readContract: async () => contract });

  const approve = await approveFap({ fapId: "FAP-approve", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  printApproval(approve, "(D1) APPROVE — founder APPROVE → resume HALTED→REVIEWING (accept-lower-bar)");
  check("APPROVE: the founder APPROVE resumes the lifecycle HALTED→REVIEWING (shadow, drafted)", approve.ok === true && approve.resume?.edge.to === "REVIEWING" && approve.resume?.execution.executed === false);

  const modify = await approveFap({ fapId: "FAP-mod", goalId: "g-halted", decision: "MODIFY" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-mod" }], haltedFixtureContract("g-halted")));
  check("APPROVE/MODIFY: a MODIFY resumes HALTED→PLANNING (redirect)", modify.ok === true && modify.resume?.edge.to === "PLANNING");

  const abort = await approveFap({ fapId: "FAP-abort", goalId: "g-halted", decision: "ABORT" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-abort" }], haltedFixtureContract("g-halted")));
  check("APPROVE/ABORT: an ABORT resumes HALTED→CLOSED (kill)", abort.ok === true && abort.resume?.edge.to === "CLOSED");

  // ── (E) FAP APPROVAL — REJECTIONS (non-founder, unknown, expired, already-resolved, mismatch, not-resumable) ──
  const nfApprove = await approveFap({ fapId: "FAP-approve", goalId: "g-halted", decision: "APPROVE" }, nonFounderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  printApproval(nfApprove, "(E1) APPROVE — NON-founder → REJECTED (no resume)");
  check("APPROVE/reject: a NON-founder approval is rejected (identity-not-founder), NO resume", nfApprove.ok === false && nfApprove.rejection?.code === "identity-not-founder" && nfApprove.resume === undefined);

  const unknownFap = await approveFap({ fapId: "FAP-nope", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  printApproval(unknownFap, "(E2) APPROVE — UNKNOWN FAP id → REJECTED (no silent action)");
  check("APPROVE/reject: an UNKNOWN FAP id is rejected (unknown-fap), NO resume", unknownFap.ok === false && unknownFap.rejection?.code === "unknown-fap");

  const expiredFap = await approveFap({ fapId: "FAP-old", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-old", status: "expired" }], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: an EXPIRED FAP is rejected (expired-fap)", expiredFap.ok === false && expiredFap.rejection?.code === "expired-fap");

  // already-resolved: approve once, then replay the SAME fap → idempotency rejects the second.
  const replayStore = inMemoryFapStore([{ ...open, fapId: "FAP-once" }]);
  const replayCtx: ApprovalContext = { founder: founderBinding(), fapStore: replayStore, readContract: async () => haltedFixtureContract("g-halted") };
  const first = await approveFap({ fapId: "FAP-once", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), replayCtx);
  const replay = await approveFap({ fapId: "FAP-once", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), replayCtx);
  check("APPROVE/idempotency: a REPLAYED FAP (already resolved) is rejected (fap-already-resolved)", first.ok === true && replay.ok === false && replay.rejection?.code === "fap-already-resolved");

  const mismatch = await approveFap({ fapId: "FAP-approve", goalId: "OTHER-goal", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: a FAP whose goal mismatches the response is rejected (fap-goal-mismatch)", mismatch.ok === false && mismatch.rejection?.code === "fap-goal-mismatch");

  const notHalted = await approveFap({ fapId: "FAP-exec", goalId: "g-exec", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-exec", goalId: "g-exec" }], { ...haltedFixtureContract("g-exec"), state: "EXECUTING" }));
  check("APPROVE/reject: a non-HALTED contract is not resumable (not-resumable-state)", notHalted.ok === false && notHalted.rejection?.code === "not-resumable-state");

  const badDecision = await approveFap({ fapId: "FAP-approve", goalId: "g-halted", decision: "YOLO" as FapDecision }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: an unknown decision token is rejected (no-decision)", badDecision.ok === false && badDecision.rejection?.code === "no-decision");

  // ── (F) the end-to-end SUBMIT→summon→APPROVE wiring: a delivered summon registers as an open FAP ──
  // Drive a STALL submission so the controller delivers a feasibility summon, register it, then the founder approves it.
  const stallSeams: IntakeLifecycleSeams = {
    seedProgress: [{ cycle: 0, value: 0.42, fixRef: "retry" }, { cycle: 1, value: 0.42, fixRef: "retry" }, { cycle: 2, value: 0.42, fixRef: "retry" }] as ProgressPoint[],
    observe: trajectory([{ value: 0.42, attempts: 80, cost: 9000, fixRef: "retry" }, { value: 0.42, attempts: 82, cost: 9100, fixRef: "retry" }], 3),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
  const stall = await submitGoal(wellFormedSubmission("stall-e2e"), founderIdentity(), { ...intakeContext(), lifecycle: stallSeams });
  printSubmit(stall, "(F) SUBMIT — stall → controller delivers a feasibility summon");
  const summon = stall.lifecycle!.summons[0]!;
  const openFromSummon = openFapFromSummon(summon, "FAP-from-summon");
  const e2eStore = inMemoryFapStore([openFromSummon]);
  const e2eApprove = await approveFap({ fapId: "FAP-from-summon", goalId: openFromSummon.goalId, decision: "MODIFY" }, founderIdentity(), { founder: founderBinding(), fapStore: e2eStore, readContract: async () => haltedFixtureContract(openFromSummon.goalId) });
  printApproval(e2eApprove, "(F) APPROVE — the delivered summon's FAP, resumed by the founder");
  check("E2E: the stall submission delivered exactly one feasibility/strategy summon (not dropped)", stall.lifecycle!.summons.length === 1 && summon.boundary_class === "feasibility/strategy" && summon.dropped === false);
  check("E2E: the delivered summon registers as an open FAP that the founder then resumes", e2eApprove.ok === true && e2eApprove.resume?.edge.to === "PLANNING" && e2eApprove.goalId === openFromSummon.goalId);

  // ── (G) THE SLACK TRANSPORT STAYS DEFERRED — no real Slack is ever callable in this slice ──
  let verifyThrew = false, submitThrew = false, approveThrew = false;
  try { await realSlackTransport.verifyIdentity({}); } catch (e) { verifyThrew = /DEFERRED/.test((e as Error).message); }
  try { await realSlackTransport.receiveGoalSubmission({}); } catch (e) { submitThrew = /DEFERRED/.test((e as Error).message); }
  try { await realSlackTransport.receiveFapResponse({}); } catch (e) { approveThrew = /DEFERRED/.test((e as Error).message); }
  L("── (G) the real Slack transport seam ──");
  L(`  verifyIdentity DEFERRED: ${verifyThrew} · receiveGoalSubmission DEFERRED: ${submitThrew} · receiveFapResponse DEFERRED: ${approveThrew}`);
  L("");
  check("DEFERRED: realSlackTransport.verifyIdentity throws DEFERRED (no real Slack call)", verifyThrew);
  check("DEFERRED: realSlackTransport.receiveGoalSubmission throws DEFERRED", submitThrew);
  check("DEFERRED: realSlackTransport.receiveFapResponse throws DEFERRED", approveThrew);

  // ── (H) NO SECOND MUTATOR (§15, structural) — src/goal-intake-c1.ts NEVER imports/calls goal-contract.transition() ──
  const { readFileSync: rf } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  const srcPath = resolve(here, "../src/goal-intake-c1.ts");
  const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const importsTransition = (code: string): boolean => /import\s*(?:type\s*)?\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*goal-contract(?:\.js)?["']/.test(code);
  const stripImports = (code: string): string => code.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
  const callsTransition = (code: string): number => (code.match(/(?:^|[^.\w])transition\s*\(/g) ?? []).length;
  const intakeCode = stripComments(rf(srcPath, "utf8"));
  L("── (H) no-second-mutator scan: does src/goal-intake-c1.ts import/call goal-contract.transition()? ──");
  L(`  imports transition: ${importsTransition(intakeCode)} · calls transition(): ${callsTransition(stripImports(intakeCode))}`);
  L("");
  check("NO-SECOND-MUTATOR: the intake does NOT import goal-contract.transition (§15)", importsTransition(intakeCode) === false);
  check("NO-SECOND-MUTATOR: the intake calls transition() ZERO times (mutation only via applyReconcilePlan)", callsTransition(stripImports(intakeCode)) === 0);
  check("NO-SECOND-MUTATOR: the resume routes through applyReconcilePlan (the reconciler's sole-mutator door)", /applyReconcilePlan\s*\(/.test(stripImports(intakeCode)));

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC1 goal-intake self-test: ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// --db-self-test — REAL §4.3 transitions against TEST-DB FIXTURE goals (the --enforce capability).
// =============================================================================
async function dbSelfTest(): Promise<void> {
  enforceBanner();
  process.env.RUMAH_ENV = "test"; // NEVER prod — force the test env loader
  const L = (s = "") => process.stdout.write(s + "\n");
  const cases: Array<{ name: string; ok: boolean }> = [];
  const check = (name: string, ok: boolean) => cases.push({ name, ok });

  const { sql } = await import("../src/db/client.js");
  const { readContract, transition, createContract } = await import("../src/goal-contract.js");

  const [reg] = await sql`SELECT to_regclass('public.goal_contract') AS gc, to_regclass('public.goal_delta_ledger') AS gd`;
  if (!reg?.gc || !reg?.gd) { process.stderr.write("0052/0053 not applied — run `npm run db:test:migrate`\n"); process.exit(2); }

  const STAMP = `intake-${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  // ── (1) FOUNDER SUBMIT → ADMITTED + a durable contract (real createContract, real pre-flight) ──
  // The CREATED→EXECUTING ramp (the C2-MIND planner) is deferred; we drive the legal-edge ramp as fixture setup
  // (exactly as the autoloop db-self-test does), so the controller governs to DONE. The intake itself never
  // transitions — it hands the parsed submission to the controller.
  {
    const ramp = async (goalId: string) => { for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING"] as const) await transition(goalId, to); };
    const seams: IntakeLifecycleSeams = {
      ...happySeams(1.0),
      executor: { admitToExecuting: async (c) => { await ramp(c.goalId); return { state: "EXECUTING", transitions: ["CREATED→…→EXECUTING"], note: "fixture legal-edge ramp (C2-MIND deferred)" }; }, runSprint: async () => { throw new Error("runSprint DEFERRED"); } },
      persistProgress: true,
    };
    const raw = { ...wellFormedSubmission("db-submit"), objective: `${STAMP} — db-submit` };
    const ctx: SubmitContext = { founder: founderBinding(), targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE }, lifecycle: seams, enforce: true };
    const r: SubmitResult = await submitGoal(raw, founderIdentity(), ctx);
    printSubmit(r, "(1) DB SUBMIT — founder + well-formed → ADMITTED + durable contract → DONE");
    const after = r.lifecycle?.goalId ? await readContract(r.lifecycle.goalId) : null;
    check("DB SUBMIT: the founder submission was ADMITTED by the controller", r.accepted === true && r.lifecycle?.phase === "ADMITTED" && r.lifecycle?.preflight.admit === true);
    check("DB SUBMIT: a durable contract was created and reached DONE (real §4.3 transitions)", after?.state === "DONE" && r.lifecycle?.finalState === "DONE");
    check("DB SUBMIT: a real transition executed (executed:true)", r.lifecycle!.ticks.some((t) => t.execution.executed === true));
  }

  // ── (2) NON-FOUNDER SUBMIT → REJECTED, NO contract created (identity-bound at the front door) ──
  {
    const before = (await sql`SELECT count(*)::int AS n FROM goal_contract WHERE objective LIKE ${STAMP + " — nf%"}`)[0]!.n;
    const ctx: SubmitContext = { founder: founderBinding(), targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE }, lifecycle: happySeams(), enforce: true };
    const r = await submitGoal({ ...wellFormedSubmission("nf"), objective: `${STAMP} — nf` }, nonFounderIdentity(), ctx);
    const after = (await sql`SELECT count(*)::int AS n FROM goal_contract WHERE objective LIKE ${STAMP + " — nf%"}`)[0]!.n;
    check("DB IDENTITY: the NON-founder submission was rejected (identity-not-founder)", r.accepted === false && r.parse.rejections.some((x) => x.code === "identity-not-founder"));
    check("DB IDENTITY: NO contract was created for the non-founder (count unchanged)", before === 0 && after === 0 && r.lifecycle === null);
  }

  // ── (3) FOUNDER FAP APPROVE → a REAL HALTED→REVIEWING resume (the sole-mutator door applies it) ──
  {
    // create a contract and drive it to HALTED (fixture setup), then the founder APPROVE resumes it.
    const c = await createContract({ objective: `${STAMP} — resume`, acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET });
    for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING", "REVIEWING", "HALTED"] as const) await transition(c.goalId, to);
    const store = inMemoryFapStore([{ fapId: "FAP-db", goalId: c.goalId, boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" }]);
    const ctx: ApprovalContext = { founder: founderBinding(), fapStore: store, readContract, enforce: true };
    const r = await approveFap({ fapId: "FAP-db", goalId: c.goalId, decision: "APPROVE" }, founderIdentity(), ctx);
    printApproval(r, "(3) DB APPROVE — founder APPROVE on a HALTED goal → REAL HALTED→REVIEWING");
    const after = await readContract(c.goalId);
    check("DB APPROVE: the founder APPROVE executed a REAL HALTED→REVIEWING transition", r.ok === true && r.resume?.execution.executed === true && r.resume?.edge.to === "REVIEWING");
    check("DB APPROVE: the durable contract is now REVIEWING (the §4.3 founder-decision edge applied)", after?.state === "REVIEWING");

    // a non-founder cannot resume; the contract stays put.
    const c2 = await createContract({ objective: `${STAMP} — resume2`, acceptanceMetric: "delivered_invoice_ratio", metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL", budgetCap: BUDGET });
    for (const to of ["FEASIBILITY", "ACTIVE", "PLANNING", "EXECUTING", "REVIEWING", "HALTED"] as const) await transition(c2.goalId, to);
    const store2 = inMemoryFapStore([{ fapId: "FAP-db2", goalId: c2.goalId, boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" }]);
    const nf = await approveFap({ fapId: "FAP-db2", goalId: c2.goalId, decision: "APPROVE" }, nonFounderIdentity(), { founder: founderBinding(), fapStore: store2, readContract, enforce: true });
    const after2 = await readContract(c2.goalId);
    check("DB APPROVE: a NON-founder resume is rejected and the contract stays HALTED", nf.ok === false && nf.rejection?.code === "identity-not-founder" && after2?.state === "HALTED");
  }

  await sql.end();
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\nC1 goal-intake DB self-test: ${cases.length - failed.length}/${cases.length} passed (TEST-DB fixtures; no live goal; no real Slack).`);
  process.exit(failed.length === 0 ? 0 : 1);
}

// =============================================================================
// --facts — run a supplied submit fixture in SHADOW.
// =============================================================================
async function runFacts(path: string): Promise<void> {
  if (opts.enforce) enforceBanner();
  const raw = JSON.parse(readFileSync(path, "utf8")) as {
    raw: RawGoalSubmission; identity: VerifiedIdentity | null; founderId?: string;
    seedProgress?: ProgressPoint[]; observe?: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>; startCycle?: number; reprobe?: number;
  };
  const seams: IntakeLifecycleSeams = {
    seedProgress: raw.seedProgress ?? [],
    observe: raw.observe ? trajectory(raw.observe, raw.startCycle ?? 0) : trajectory([{ value: 1.0, attempts: 60, cost: 6000 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: raw.reprobe ?? null, note: "injected fixture re-probe" }) },
    maxTicks: 8,
  };
  const ctx: SubmitContext = { founder: resolveFounderBinding({ founderId: raw.founderId ?? FOUNDER_ID, source: "facts fixture" }), targetEnv: "test", probeRegistry: probeRegistry(), configReadiness: ALL_CONFIG_PRESENT, reachability: { kind: "verdict", verdict: REACHABLE }, lifecycle: seams };
  const r = await submitGoal(raw.raw, raw.identity, ctx);
  if (opts.json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else printSubmit(r);
  process.exit(0);
}

// ── entrypoint ─────────────────────────────────────────────────────────────────
if (opts.selfTest) {
  selfTest().catch((e) => { process.stderr.write(`goal-intake-c1: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.dbSelfTest) {
  dbSelfTest().catch((e) => { process.stderr.write(`goal-intake-c1: ${e?.stack ?? e}\n`); process.exit(2); });
} else if (opts.facts) {
  runFacts(opts.facts).catch((e) => { process.stderr.write(`goal-intake-c1: ${(e as Error)?.stack ?? e}\n`); process.exit(2); });
} else {
  shadowDemo().catch((e) => { process.stderr.write(`goal-intake-c1: ${e?.stack ?? e}\n`); process.exit(2); });
}
