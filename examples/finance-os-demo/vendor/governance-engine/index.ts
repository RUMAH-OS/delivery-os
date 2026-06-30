// Governance Engine — the public barrel. The CANONICAL surface an installer consumes.
//
// Home: delivery-os/templates/governance-engine/ (the single source of truth). Consumers vendor this directory
// (sha-pinned, do-NOT-hand-edit) and supply a thin store ADAPTER implementing the ports — exactly as they
// already vendor `templates/workflow-engine/` for the C11 bus.
//   SLICE 1: the §4.3 state-machine validator + `GoalContractStorePort` + the golden-master cage.
//   SLICE 2: the `RuntimeStoresPort` (the 6 C12 durable stores) + the C12 invariant cage + the FIRST inverted
//            organ — the Goal Supervisor (C7) — running on the injected ports (zero Postgres).
// The remaining organs/ports (`ProbeReaderPort`, `ConfigReadinessPort`, `createGovernanceRuntime`, …) are LATER
// slices (PLATFORM-EXTRACTION-BLUEPRINT-2026-06-29 §3).
//
// RESIDENCY INVARIANT (enforced by residency-guard.mjs): no file here imports `./db/client.js`, the `postgres`
// driver, or `execFileSync`s a relative tool. Every durable read/write crosses the injected port.

// ── §4.3 state machine (the portable, fail-closed mirror of the 0053 DB trigger) ──
export {
  GOAL_STATES,
  TERMINAL_GOAL_STATES,
  RESUMABLE_GOAL_STATES,
  FORWARD_GOAL_EDGES,
  isTerminalGoalState,
  isLegalGoalTransition,
  assertLegalGoalTransition,
  computeNextPrevState,
  enumerateLegalGoalEdges,
  IllegalGoalTransitionError,
} from "./state-machine.js";
export type { GoalState, GoalTransitionContext } from "./state-machine.js";

// ── the GoalContract store PORT + its lifted data types ──
export type {
  GoalContractStorePort,
  CreateGoalContractInput,
  GoalContractRow,
  DataClass,
  BudgetCap,
} from "./ports.js";

// ── the GoalContract ORGAN (port-injected; adds the portable TS enforcement over any adapter) ──
export { createGoalContractOrgan } from "./goal-contract.js";

// ── SLICE 2: the RuntimeStoresPort (the 6 C12 durable stores) + its lifted data types ──
export type {
  RuntimeStoresPort,
  BreakerState,
  ProgressSampleInput,
  AttemptInput,
  BreakerRow,
  DeadLetterInput,
  CostInput,
} from "./ports.js";

// ── SLICE 2: the Goal Supervisor (C7) — the first organ inverted onto the ports (liveness ≠ progress) ──
export {
  evaluateGoalSupervision,
  computeEffort,
  composeHaltAndFap,
  runGoalSupervision,
  runtimeStoresPortToSupervisionStore,
  createGoalSupervisor,
  DEFAULT_GRACE_FLOOR,
  DEFAULT_WINDOW,
  DEFAULT_EPSILON,
} from "./goal-supervisor.js";
export type {
  GoalVerdict,
  ProgressPoint,
  ExternalReprobe,
  EffortFacts,
  GraceFloor,
  AcceptanceShape,
  GoalSupervisionFacts,
  EffortBreakdown,
  LoopFingerprint,
  GoalSupervisionVerdict,
  GoalDeltaVerdictSignal,
  FounderActionPackage,
  HaltAndFap,
  ComposeHaltOptions,
  SupervisionConfig,
  SupervisionStore,
  RunGoalSupervisionInput,
  RunGoalSupervisionResult,
  GoalSupervisorPorts,
  SuperviseGoalInput,
  GoalSupervisor,
} from "./goal-supervisor.js";

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE 3 — the 4 remaining ports + the 5 inverted loop-core organs.
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ── the 4 remaining PORT types ──
export type {
  ProbeReaderPort,
  CredentialResolver,
  ReadinessState,
  KeyReadiness,
  ConfigReadinessFn,
  ConfigReadinessPort,
  NotifierChannelRef,
  NotifierPort,
  FounderBinding,
  FounderBindingPort,
} from "./ports.js";

// ── MetricProbe substrate (ProbeReaderPort + CredentialResolver) — no driver import ──
export {
  ProbeRegistry,
  defaultProbeRegistry,
  assertReadOnlyTarget,
  invokeProbe,
} from "./metric-probe.js";
export type {
  MetricKind,
  ProbeType,
  MetricProbe,
  ProbeReader,
  ProbeResult,
} from "./metric-probe.js";

// ── Pre-flight reachability evaluator (§36.3 deterministic fail-closed rule — pure, zero-dep) ──
export {
  decideReachability,
  evaluateReachability,
} from "./reachability-evaluator.js";
export type {
  ReachabilityInput,
  ReachabilityVerdict,
  ReachabilityDecision,
} from "./reachability-evaluator.js";

// ── The C9 Pre-flight Feasibility Gate (ConfigReadinessPort + the metric registry) ──
export {
  evaluatePreflight,
  defaultReachabilityInput,
} from "./preflight.js";
export type {
  BlockerCode,
  Blocker,
  CheckResult,
  PreflightVerdict,
  AcceptanceOp,
  AcceptanceCriterion,
  PreflightGoal,
  ReachabilitySource,
  PreflightContext,
} from "./preflight.js";

// ── The PO reconciler (C2-LOOP) — the SOLE mutator, on GoalContractStorePort ──
export {
  reconcile,
  acceptanceMet,
  createReconciler,
} from "./reconciler.js";
export type {
  ReconcileDecision,
  LegalEdge,
  ObservedState,
  ObservedSummary,
  ReconcilePlan,
  ReconcileExecution,
  ApplyOptions,
  ReconcileTickResult,
  ReconcileToSettledResult,
  Reconciler,
} from "./reconciler.js";

// ── The Completion Review (C6) — the fail-closed DONE-gate, on ProbeReaderPort + goal-contract ──
export {
  reviewCompletion,
  makeProbeReprobe,
} from "./completion-review.js";
export type {
  CompletionVerdict,
  ReviewReprobe,
  CompletionEvidence,
  CompletionReview,
  CompletionReviewContext,
} from "./completion-review.js";

// ── The Sprint Engine (C10) — the cap-fail-closed executor, on RuntimeStoresPort + GoalContractStorePort ──
export {
  runSprint,
  makeStubSpawner,
  realWorkerQueueSpawn,
  runtimeStoresPortToSprintStores,
  createSprintEngine,
  asControllerHook,
} from "./sprint-engine.js";
export type {
  SpawnInput,
  SpawnOutput,
  Spawner,
  Reprobe,
  SprintStores,
  SprintContext,
  StepEvidence,
  SprintResultKind,
  SprintEvidence,
  SprintEnginePorts,
  SprintEngine,
  ControllerHookOptions,
} from "./sprint-engine.js";

// ════════════════════════════════════════════════════════════════════════════════════════════════════════════
// SLICE 4 — the 4 remaining inverted organs (founder-summon · goal-intake · boundary-plan · the controller) +
//   `createGovernanceRuntime` (the package's PUBLIC vendoring surface).
// ════════════════════════════════════════════════════════════════════════════════════════════════════════════

// ── The Founder Summon Delivery (C1) — guaranteed-reachability FAP delivery, on NotifierPort (never dropped) ──
export {
  summon,
  defaultChannelChain,
  ensureDurableTerminal,
  defaultProbe,
  fapFromGoalSupervisorHalt,
  fapFromPreflightRefusal,
  fapFromCompletionReview,
} from "./founder-summon.js";
export type {
  BoundaryClass,
  FapSource,
  SummonFap,
  ChannelKind,
  ChannelAvailability,
  ChannelProbe,
  ChannelSeam,
  AttemptOutcome,
  SummonAttempt,
  DurableEscalationRecord,
  SummonResult,
  Posture,
  SendSeam,
  SummonOptions,
} from "./founder-summon.js";

// ── Boundary next-sprint planning (C2-MIND structure) — deterministic skeleton; the LLM planner DEFERRED ──
export {
  decideNextBoundary,
  computeBoundaryPlan,
  planNextSprint,
} from "./boundary-plan.js";
export type {
  NextBoundary,
  RemainingWork,
  NextSprintInput,
  NextSprintPlan,
  BoundaryPlan,
  ComputeBoundaryPlanOptions,
} from "./boundary-plan.js";

// ── The PO auto-loop / goal-lifecycle controller (C2) — the level-triggered §4.3 loop; C6 gates DONE (B1 fix) ──
export {
  isSettled,
  DEFERRED_EXECUTOR,
  createGoalLifecycleController,
  createInputFromGoal,
  fixtureContractFromGoal,
} from "./po-autoloop.js";
export type {
  RunSprintInput,
  SprintExecutor,
  ObservedTickInput,
  ObservedProvider,
  LifecycleContext,
  // NOTE: po-autoloop's `ObservedSummary` (TickRecord.observed) is intentionally NOT re-exported here — the
  // barrel already exports the reconciler's `ObservedSummary`; consumers reach the controller's via TickRecord.
  TickRecord,
  LifecyclePhase,
  LifecycleResult,
  GovernanceControllerPorts,
  GoalLifecycleController,
  GoalSubmission,
} from "./po-autoloop.js";

// ── The Goal-Intake (C1 front door) — SUBMIT + APPROVE, identity-bound + fail-closed, on FounderBindingPort ──
export {
  resolveFounderBinding,
  resolveFounderBindingFromPort,
  checkFounderIdentity,
  hasPositiveBudgetAxis,
  deriveAcceptanceShape,
  parseGoalSubmission,
  submitGoal,
  approveFap,
  inMemoryFapStore,
  openFapFromSummon,
  realSlackTransport,
} from "./goal-intake.js";
export type {
  VerifiedIdentity,
  IdentityRejectionCode,
  IdentityRejection,
  IdentityCheck,
  RawAcceptance,
  RawGoalSubmission,
  SubmissionRejectionCode,
  SubmissionRejection,
  IntakeContext,
  ParseResult,
  IntakeLifecycleSeams,
  RunGoalLifecycle,
  SubmitContext,
  SubmitResult,
  FapDecision,
  FapResponse,
  OpenFap,
  FapStore,
  ApprovalRejectionCode,
  ApprovalRejection,
  ContractReader,
  ApprovalContext,
  ApprovalResume,
  ApprovalResult,
  SignedTransport,
} from "./goal-intake.js";

// ── createGovernanceRuntime — the package's PUBLIC vendoring surface (the single bootstrap a consumer calls) ──
export { createGovernanceRuntime } from "./runtime.js";
export type { GovernanceRuntimePorts, GovernanceRuntime } from "./runtime.js";
