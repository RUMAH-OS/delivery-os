// Governance Engine — Goal-Intake (C1 front door) REGRESSION self-test, ported VERBATIM from the VERIFIED admin
// harness (`rumah-admin/scripts/goal-intake-c1.ts --self-test`) and run against the INVERTED organ + the
// IN-MEMORY ports (zero Postgres).
//
// THE PROOF THIS FILE EXISTS TO MAKE: the IDENTITY-BINDING fail-closed logic + the FAP-approval replay/forge
// guards + the §15-preserving resume are BYTE-FOR-BYTE preserved after (1) the `process.env.RUNTIME_FOUNDER_ID`
// read became the injected binding, (2) the DB `readContract` default became an injected reader, and (3) the free
// `applyReconcilePlan` became the reconciler-instance door. Cases (A)-(H) are copied verbatim; the ONLY edits are
// the import paths, supplying `runLifecycle` (the controller bound to in-memory ports) on the submit ctx + a
// `reconciler` on the approval ctx, and the §15 scan retargeted to the package file. Same inputs ⇒ same verdicts.
//
// Run:  tsx goal-intake-self-test.ts   ·   exit 0 = the inverted logic matches the verified logic · 1 = drift.

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
} from "../goal-intake.js";
import { ProbeRegistry, type MetricProbe } from "../metric-probe.js";
import type { PreflightContext, ReachabilitySource } from "../preflight.js";
import type { ReachabilityVerdict } from "../reachability-evaluator.js";
import type { AcceptanceShape, ProgressPoint } from "../goal-supervisor.js";
import type { ObservedTickInput } from "../po-autoloop.js";
import { createGoalLifecycleController } from "../po-autoloop.js";
import { createReconciler } from "../reconciler.js";
import { createGoalContractOrgan } from "../goal-contract.js";
import { createInMemoryGoalContractStore, createInMemoryRuntimeStores } from "./in-memory-store.js";
import type { GoalContractRow } from "../ports.js";

const cases: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean) => cases.push({ name, ok });
const L = (s = "") => process.stdout.write(s + "\n");

const FOUNDER_ID = "U-FOUNDER-RUMAH";
const ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
const BUDGET = { max_turns: 100, max_cost_cents: 10000 };

// the controller bound to in-memory ports — the port-bound runLifecycle the intake's submitGoal drives.
const controller = createGoalLifecycleController({
  contract: createGoalContractOrgan(createInMemoryGoalContractStore()),
  store: createInMemoryRuntimeStores(),
});
// a throwaway reconciler for the SHADOW approval path (applyReconcilePlan in SHADOW never touches the port).
const shadowReconciler = createReconciler(createGoalContractOrgan(createInMemoryGoalContractStore()));

function founderBinding(): FounderBinding {
  return resolveFounderBinding({ founderId: FOUNDER_ID, source: "test fixture" });
}
function founderIdentity(): VerifiedIdentity {
  return { subjectId: FOUNDER_ID, verified: true, method: "request-signature (fixture)", display: "Founder" };
}
function nonFounderIdentity(): VerifiedIdentity {
  return { subjectId: "U-RANDOM-STAFFER", verified: true, method: "request-signature (fixture)", display: "Staffer" };
}
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

const REACHABLE: ReachabilityVerdict = { reachable: true, confidence: 0.95, evidence: "100% delivery coverage is reachable." };
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

function wellFormedSubmission(goalId = "submit-fixture"): RawGoalSubmission {
  return {
    goalId,
    objective: "reach 100% invoice delivery coverage",
    acceptance: { probeId: "invoice-delivery-coverage", probeVersion: 1, op: ">=", target: 1.0, direction: "increase", metric: "delivered_invoice_ratio" },
    budget: { ...BUDGET },
    requiredConfigKeys: [],
  };
}

function trajectory(points: Array<{ value: number | null; attempts: number; cost: number; fixRef?: string }>, startCycle: number) {
  return async (_goalId: string, tickIndex: number): Promise<ObservedTickInput> => {
    const p = points[Math.min(tickIndex, points.length - 1)]!;
    return { cycle: startCycle + tickIndex, metricValue: p.value, attempts: p.attempts, cumulativeCostCents: p.cost, fixRef: p.fixRef ?? null };
  };
}

function happySeams(reprobeValue = 1.0): IntakeLifecycleSeams {
  return {
    seedProgress: [{ cycle: 0, value: 0.3 }, { cycle: 1, value: 0.5 }, { cycle: 2, value: 0.7 }, { cycle: 3, value: 0.9 }] as ProgressPoint[],
    observe: trajectory([{ value: 1.0, attempts: 60, cost: 6000 }, { value: 1.0, attempts: 62, cost: 6200 }], 4),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: reprobeValue, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
}

function submitContext(seams = happySeams(), enforce = false): SubmitContext {
  return { ...intakeContext(), lifecycle: seams, runLifecycle: controller.runGoalLifecycle, enforce };
}

function haltedFixtureContract(goalId: string): GoalContractRow {
  const now = new Date();
  return {
    goalId, objective: "reach 100% invoice delivery coverage", acceptanceMetric: "delivered_invoice_ratio",
    metricSourceProbeId: "invoice-delivery-coverage", metricSourceVersion: 1, dataClass: "CONFIDENTIAL",
    budgetCap: { ...BUDGET }, goalDeltaLedgerRef: goalId, state: "HALTED", prevState: "REVIEWING", createdAt: now, updatedAt: now,
  };
}

const mkApprovalCtx = (faps: OpenFap[], contract: GoalContractRow | null): ApprovalContext => ({
  founder: founderBinding(), fapStore: inMemoryFapStore(faps), readContract: async () => contract, reconciler: shadowReconciler,
});

async function main() {
  L("governance-engine C1 goal-intake self-test — identity-binding + FAP-approval guards + §15 resume, in-memory ports\n");

  // ── (A) FOUNDER + WELL-FORMED SUBMIT → ADMITTED (through the controller; a contract drafted) ──
  const admit = await submitGoal(wellFormedSubmission("happy"), founderIdentity(), submitContext());
  check("SUBMIT/ADMIT: the founder submission is accepted by the intake", admit.accepted === true && admit.parse.ok === true);
  check("SUBMIT/ADMIT: the controller ADMITTED it at the pre-flight gate (a contract drafted)", admit.lifecycle?.phase === "ADMITTED" && admit.lifecycle?.preflight.admit === true && admit.lifecycle?.contract !== null);
  check("SUBMIT/ADMIT: the goal walked the lifecycle to DONE in SHADOW (drafted, executed:false)", admit.lifecycle?.finalState === "DONE" && admit.lifecycle!.ticks.every((t) => t.execution.executed === false));
  check("SUBMIT/ADMIT: the frozen acceptance was derived from the submission (>= 1)", admit.parse.acceptance?.op === ">=" && admit.parse.acceptance?.target === 1.0);

  // ── (B) MALFORMED SUBMITS → REJECTED fail-closed, with the SPECIFIC reason ──
  const noMetric = await submitGoal({ objective: "win", acceptance: { op: ">=", target: 1 }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  check("REJECT/no-metric: rejected with no-acceptance-metric (unmeasurable)", noMetric.accepted === false && noMetric.parse.rejections.some((r) => r.code === "no-acceptance-metric"));
  check("REJECT/no-metric: NO contract / NO lifecycle ran (refused at the front door)", noMetric.lifecycle === null);

  const noBudget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: 1 }, budget: {} }, founderIdentity(), submitContext());
  check("REJECT/no-budget: rejected with malformed-budget", noBudget.accepted === false && noBudget.parse.rejections.some((r) => r.code === "malformed-budget"));

  const zeroBudget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: 1 }, budget: { max_turns: 0, max_cost_cents: 0 } }, founderIdentity(), submitContext());
  check("REJECT/zero-budget: a ≤0 budget on every axis is malformed-budget", zeroBudget.accepted === false && zeroBudget.parse.rejections.some((r) => r.code === "malformed-budget"));

  const nonFinite = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage", op: ">=", target: Number.POSITIVE_INFINITY }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  check("REJECT/non-finite: a non-finite target is rejected with non-finite-target", nonFinite.accepted === false && nonFinite.parse.rejections.some((r) => r.code === "non-finite-target"));

  const noTarget = await submitGoal({ objective: "win", acceptance: { probeId: "invoice-delivery-coverage" }, budget: { ...BUDGET } }, founderIdentity(), submitContext());
  check("REJECT/no-target: a missing op/target is rejected with no-acceptance-target", noTarget.accepted === false && noTarget.parse.rejections.some((r) => r.code === "no-acceptance-target"));

  // ── (C) IDENTITY-BINDING — non-founder / unverified / absent / unbound → REJECTED (no contract) ──
  const nonFounder = await submitGoal(wellFormedSubmission("nf"), nonFounderIdentity(), submitContext());
  check("IDENTITY: a verified NON-founder is rejected (identity-not-founder), NO contract", nonFounder.accepted === false && nonFounder.parse.rejections.some((r) => r.code === "identity-not-founder") && nonFounder.lifecycle === null);

  const forged = await submitGoal(wellFormedSubmission("forged"), forgedFounderIdentity(), submitContext());
  check("IDENTITY: a forged/self-asserted identity (verified:false) is rejected (identity-unverified)", forged.accepted === false && forged.parse.rejections.some((r) => r.code === "identity-unverified") && forged.lifecycle === null);

  const absent = await submitGoal(wellFormedSubmission("absent"), null, submitContext());
  check("IDENTITY: an absent identity is rejected (identity-absent)", absent.accepted === false && absent.parse.rejections.some((r) => r.code === "identity-absent"));

  // unbound founder binding → fail-closed for EVERYONE (even a 'founder' subject id). RESIDENCY: null binding,
  // not an UNSET env read.
  const unboundCtx: SubmitContext = { ...submitContext(), founder: resolveFounderBinding({ founderId: null }) };
  const unbound = await submitGoal(wellFormedSubmission("unbound"), founderIdentity(), unboundCtx);
  check("IDENTITY: an UNSET founder binding fails closed for everyone (founder-binding-unset)", unbound.accepted === false && unbound.parse.rejections.some((r) => r.code === "founder-binding-unset"));
  // and with NO override at all, resolveFounderBinding() is fail-closed (no process.env read in the package).
  check("RESIDENCY: resolveFounderBinding() with no override is fail-closed null (no process.env read)", resolveFounderBinding().founderId === null);

  const parseNF: ParseResult = parseGoalSubmission(wellFormedSubmission("p"), nonFounderIdentity(), intakeContext());
  check("IDENTITY (parse): parseGoalSubmission alone rejects the non-founder with no submission", parseNF.ok === false && parseNF.submission === undefined);

  // ── (D) FAP APPROVAL — founder APPROVE/MODIFY/ABORT resumes the lifecycle (shadow, §15-preserving) ──
  const open: OpenFap = { fapId: "FAP-approve", goalId: "g-halted", boundaryClass: "feasibility/strategy", source: "goal-supervisor-c7", status: "open" };

  const approve = await approveFap({ fapId: "FAP-approve", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  check("APPROVE: the founder APPROVE resumes the lifecycle HALTED→REVIEWING (shadow, drafted)", approve.ok === true && approve.resume?.edge.to === "REVIEWING" && approve.resume?.execution.executed === false);

  const modify = await approveFap({ fapId: "FAP-mod", goalId: "g-halted", decision: "MODIFY" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-mod" }], haltedFixtureContract("g-halted")));
  check("APPROVE/MODIFY: a MODIFY resumes HALTED→PLANNING (redirect)", modify.ok === true && modify.resume?.edge.to === "PLANNING");

  const abort = await approveFap({ fapId: "FAP-abort", goalId: "g-halted", decision: "ABORT" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-abort" }], haltedFixtureContract("g-halted")));
  check("APPROVE/ABORT: an ABORT resumes HALTED→CLOSED (kill)", abort.ok === true && abort.resume?.edge.to === "CLOSED");

  // ── (E) FAP APPROVAL — REJECTIONS (non-founder, unknown, expired, already-resolved, mismatch, not-resumable) ──
  const nfApprove = await approveFap({ fapId: "FAP-approve", goalId: "g-halted", decision: "APPROVE" }, nonFounderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: a NON-founder approval is rejected (identity-not-founder), NO resume", nfApprove.ok === false && nfApprove.rejection?.code === "identity-not-founder" && nfApprove.resume === undefined);

  const unknownFap = await approveFap({ fapId: "FAP-nope", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([open], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: an UNKNOWN FAP id is rejected (unknown-fap), NO resume", unknownFap.ok === false && unknownFap.rejection?.code === "unknown-fap");

  const expiredFap = await approveFap({ fapId: "FAP-old", goalId: "g-halted", decision: "APPROVE" }, founderIdentity(), mkApprovalCtx([{ ...open, fapId: "FAP-old", status: "expired" }], haltedFixtureContract("g-halted")));
  check("APPROVE/reject: an EXPIRED FAP is rejected (expired-fap)", expiredFap.ok === false && expiredFap.rejection?.code === "expired-fap");

  // already-resolved: approve once, then replay the SAME fap → idempotency rejects the second.
  const replayStore = inMemoryFapStore([{ ...open, fapId: "FAP-once" }]);
  const replayCtx: ApprovalContext = { founder: founderBinding(), fapStore: replayStore, readContract: async () => haltedFixtureContract("g-halted"), reconciler: shadowReconciler };
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
  const stallSeams: IntakeLifecycleSeams = {
    seedProgress: [{ cycle: 0, value: 0.42, fixRef: "retry" }, { cycle: 1, value: 0.42, fixRef: "retry" }, { cycle: 2, value: 0.42, fixRef: "retry" }] as ProgressPoint[],
    observe: trajectory([{ value: 0.42, attempts: 80, cost: 9000, fixRef: "retry" }, { value: 0.42, attempts: 82, cost: 9100, fixRef: "retry" }], 3),
    review: { acceptance: ACCEPTANCE, reprobe: async () => ({ value: 0.42, note: "independent re-probe (injected fixture)" }) },
    maxTicks: 6,
  };
  const stall = await submitGoal(wellFormedSubmission("stall-e2e"), founderIdentity(), { ...intakeContext(), lifecycle: stallSeams, runLifecycle: controller.runGoalLifecycle });
  const summon = stall.lifecycle!.summons[0]!;
  const openFromSummon = openFapFromSummon(summon, "FAP-from-summon");
  const e2eStore = inMemoryFapStore([openFromSummon]);
  const e2eApprove = await approveFap({ fapId: "FAP-from-summon", goalId: openFromSummon.goalId, decision: "MODIFY" }, founderIdentity(), { founder: founderBinding(), fapStore: e2eStore, readContract: async () => haltedFixtureContract(openFromSummon.goalId), reconciler: shadowReconciler });
  check("E2E: the stall submission delivered exactly one feasibility/strategy summon (not dropped)", stall.lifecycle!.summons.length === 1 && summon.boundary_class === "feasibility/strategy" && summon.dropped === false);
  check("E2E: the delivered summon registers as an open FAP that the founder then resumes", e2eApprove.ok === true && e2eApprove.resume?.edge.to === "PLANNING" && e2eApprove.goalId === openFromSummon.goalId);

  // ── (G) THE SIGNED TRANSPORT STAYS DEFERRED — no real channel is ever callable in this slice ──
  let verifyThrew = false, submitThrew = false, approveThrew = false;
  try { await realSlackTransport.verifyIdentity({}); } catch (e) { verifyThrew = /DEFERRED/.test((e as Error).message); }
  try { await realSlackTransport.receiveGoalSubmission({}); } catch (e) { submitThrew = /DEFERRED/.test((e as Error).message); }
  try { await realSlackTransport.receiveFapResponse({}); } catch (e) { approveThrew = /DEFERRED/.test((e as Error).message); }
  check("DEFERRED: realSlackTransport.verifyIdentity throws DEFERRED (no real channel call)", verifyThrew);
  check("DEFERRED: realSlackTransport.receiveGoalSubmission throws DEFERRED", submitThrew);
  check("DEFERRED: realSlackTransport.receiveFapResponse throws DEFERRED", approveThrew);

  // ── (H) NO SECOND MUTATOR (§15, structural) — goal-intake.ts NEVER imports/calls a transition() ──
  {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const here = dirname(fileURLToPath(import.meta.url));
    const srcPath = resolve(here, "..", "goal-intake.ts");
    const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const importsTransition = (code: string): boolean => /import\s*(?:type\s*)?\{[^}]*\btransition\b[^}]*\}\s*from\s*["'][^"']*(?:goal-contract|ports)(?:\.js)?["']/.test(code);
    const stripImports = (code: string): string => code.replace(/import\s*(?:type\s*)?\{[^}]*\}\s*from\s*["'][^"']+["'];?/g, "");
    const stripStrings = (c: string) => c.replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``").replace(/'(?:\\.|[^'\\])*'/g, "''").replace(/"(?:\\.|[^"\\])*"/g, '""');
    const callsTransition = (code: string): number => (stripStrings(code).match(/(?:^|[^.\w])transition\s*\(|\.\s*transition\s*\(/g) ?? []).length;
    const intakeCode = stripComments(readFileSync(srcPath, "utf8"));
    L("── (H) no-second-mutator scan: does goal-intake.ts import/call a transition()? ──");
    L(`  imports transition: ${importsTransition(intakeCode)} · calls transition(): ${callsTransition(stripImports(intakeCode))}`);
    L("");
    check("NO-SECOND-MUTATOR: the intake does NOT import a transition value (§15)", importsTransition(intakeCode) === false);
    check("NO-SECOND-MUTATOR: the intake calls transition() ZERO times (mutation only via applyReconcilePlan)", callsTransition(stripImports(intakeCode)) === 0);
    check("NO-SECOND-MUTATOR: the resume routes through applyReconcilePlan (the reconciler's sole-mutator door)", /applyReconcilePlan\s*\(/.test(stripImports(intakeCode)));
  }

  // ── tally ──
  const failed = cases.filter((c) => !c.ok);
  for (const c of cases) L(`${c.ok ? "PASS" : "FAIL"}  ${c.name}`);
  L(`\ngovernance-engine C1 goal-intake self-test (verbatim identity-binding + FAP guards + §15 resume): ${cases.length - failed.length}/${cases.length} passed.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
