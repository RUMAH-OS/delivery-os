// =============================================================================
// createGovernanceRuntime — the PACKAGE's PUBLIC vendoring surface (the single bootstrap a consumer calls).
// =============================================================================
// PLATFORM EXTRACTION SLICE 4. The governance analogue of `templates/workflow-engine/`'s `createCapabilityRuntime`:
// it accepts the injected PORTS, WIRES every organ + the controller into one ready governance runtime, and
// returns the runnable surface (`runGoalLifecycle` + the C1 front door `submitGoal`/`approveFap`). A consumer
// vendors this directory (sha-pinned), supplies thin ADAPTERS implementing the ports (Postgres / Supabase /
// in-memory), and calls `createGovernanceRuntime(ports)` — exactly as it already vendors the workflow engine.
//
// IT WIRES (composition only — re-implements nothing):
//   1. the §4.3 GoalContract ORGAN over the injected store (`createGoalContractOrgan` — the portable TS validator
//      over the adapter, with the 0053 trigger as the owner-proof backstop on Postgres).
//   2. the RECONCILER — the SOLE mutator door (`createReconciler`, §15) — created from (1).
//   3. the GOAL SUPERVISOR (C7) + the SPRINT ENGINE (C10), composed on BOTH store ports.
//   4. the CONTROLLER (`createGoalLifecycleController`) — the level-triggered §4.3 lifecycle loop; C6 gates DONE.
//   5. the C1 FRONT DOOR — `submitGoal` (port-bound to the controller's runGoalLifecycle) + `approveFap`
//      (port-bound to the reconciler's sole-mutator door + the contract reader). The founder binding is resolved
//      from the injected `FounderBindingPort` (fail-closed when unset).
//
// RESIDENCY: this module imports NO `./db/client.js`, NO `postgres`, NO `execFileSync` — every durable read/write,
// probe read and config read crosses an injected port (enforced by `residency-guard.mjs`). The 4 plane ports
// (`CredentialResolver`, `ConfigReadinessPort`, `NotifierPort`, `FounderBindingPort`) are accepted + exposed so a
// consumer threads them into the per-lifecycle contexts (the C6 re-probe resolver, the C9 readiness oracle, the
// summon notifier, the intake binding). The two STORE ports are the only ones structurally required at construction.
// =============================================================================

import type {
  GoalContractStorePort,
  RuntimeStoresPort,
  CredentialResolver,
  ConfigReadinessPort,
  NotifierPort,
  FounderBinding,
  FounderBindingPort,
} from "./ports.js";
import { createGoalContractOrgan } from "./goal-contract.js";
import { createReconciler, type Reconciler } from "./reconciler.js";
import { createGoalSupervisor, type GoalSupervisor } from "./goal-supervisor.js";
import { createSprintEngine, type SprintEngine } from "./sprint-engine.js";
import {
  createGoalLifecycleController,
  type GoalLifecycleController,
} from "./po-autoloop.js";
import {
  submitGoal as intakeSubmitGoal,
  approveFap as intakeApproveFap,
  resolveFounderBinding,
  type SubmitContext,
  type SubmitResult,
  type ApprovalContext,
  type ApprovalResult,
  type RawGoalSubmission,
  type VerifiedIdentity,
  type FapResponse,
} from "./goal-intake.js";
import type { ProbeRegistry } from "./metric-probe.js";

/** The 6 ports the governance runtime composes (2 durable-store ports + the 4 plane ports), + an optional probe
 *  registry. The two store ports are REQUIRED; the 4 plane ports are optional at construction (a consumer threads
 *  them into the per-lifecycle contexts) and are EXPOSED on the returned runtime so they are wired once, here. */
export interface GovernanceRuntimePorts {
  /** the durable PO-contract STORAGE seam (the consumer's adapter — Postgres / Supabase / in-memory). */
  goalContractStore: GoalContractStorePort;
  /** the 6 C12 durable stores (the goal-delta ledger / attempt / cost / breaker / idempotency / dead-letter). */
  runtimeStores: RuntimeStoresPort;
  /** the MetricProbe credential resolver (→ least-privilege ProbeReaderPort) for the GS / C6 independent re-probe. */
  credentialResolver?: CredentialResolver;
  /** the I-Config readiness oracle for the C9 pre-flight capability check. */
  configReadiness?: ConfigReadinessPort;
  /** the FAP-delivery seam for the C1 founder summon (channel `isConfigured` + the real-send seam). */
  notifier?: NotifierPort;
  /** the founder-identity binding seam for the C1 intake (resolved fail-closed when unset). */
  founderBinding?: FounderBindingPort;
  /** the MetricProbe registry (default = the process-wide defaultProbeRegistry — the consumer registers probes). */
  probeRegistry?: ProbeRegistry;
}

/** The ready governance runtime — the single handle a consumer holds after installation. */
export interface GovernanceRuntime {
  /** the §4.3-enforcing GoalContract organ (the injected store wrapped with the portable TS validator). */
  contract: GoalContractStorePort;
  /** the 6 C12 durable stores (passthrough of the injected port). */
  store: RuntimeStoresPort;
  /** the reconciler — the SOLE mutator door (§15). */
  reconciler: Reconciler;
  /** the Goal Supervisor (C7) — the external no-progress watchdog. */
  supervisor: GoalSupervisor;
  /** the Sprint Engine (C10) — the cap-fail-closed unattended executor. */
  sprintEngine: SprintEngine;
  /** the lifecycle controller (C2) — the level-triggered §4.3 loop; C6 gates DONE. */
  controller: GoalLifecycleController;
  /** the ENTRY surface a consumer calls — run a goal through its entire §4.3 lifecycle. */
  runGoalLifecycle: GoalLifecycleController["runGoalLifecycle"];
  /** the C1 SUBMIT front door — port-bound to the controller's runGoalLifecycle (no `runLifecycle` to pass). */
  submitGoal(raw: RawGoalSubmission, identity: VerifiedIdentity | null | undefined, ctx: Omit<SubmitContext, "runLifecycle">): Promise<SubmitResult>;
  /** the C1 APPROVE front door — port-bound to the reconciler's sole-mutator door + the contract reader. */
  approveFap(response: FapResponse, identity: VerifiedIdentity | null | undefined, ctx: Omit<ApprovalContext, "reconciler" | "contract">): Promise<ApprovalResult>;
  /** resolve the bound founder identity (from the injected FounderBindingPort; fail-closed null when unset). */
  resolveFounderBinding(): Promise<FounderBinding> | FounderBinding;
  /** the injected plane ports — exposed so a consumer threads them into the per-lifecycle contexts. */
  ports: {
    credentialResolver?: CredentialResolver;
    configReadiness?: ConfigReadinessPort;
    notifier?: NotifierPort;
    founderBinding?: FounderBindingPort;
    probeRegistry?: ProbeRegistry;
  };
}

export function createGovernanceRuntime(ports: GovernanceRuntimePorts): GovernanceRuntime {
  // (1) the §4.3 GoalContract organ over the injected store (portable TS validator + the 0053 trigger backstop).
  const contract = createGoalContractOrgan(ports.goalContractStore);
  // (2) the reconciler — the SOLE mutator door (§15) — created from the organ-wrapped contract.
  const reconciler = createReconciler(contract);
  // (3) the GS (C7) + the Sprint Engine (C10) — composed on BOTH store ports.
  const supervisor = createGoalSupervisor({ store: ports.runtimeStores, contract });
  const sprintEngine = createSprintEngine({ store: ports.runtimeStores, contract });
  // (4) the controller (C2) — the level-triggered §4.3 lifecycle loop; C6 gates DONE.
  const controller = createGoalLifecycleController({ contract, store: ports.runtimeStores });

  // resolve the founder binding from the injected port (fail-closed null when unset / no port).
  const resolveBinding = (): Promise<FounderBinding> | FounderBinding =>
    ports.founderBinding ? ports.founderBinding.resolveFounderBinding() : resolveFounderBinding();

  return {
    contract,
    store: ports.runtimeStores,
    reconciler,
    supervisor,
    sprintEngine,
    controller,
    runGoalLifecycle: controller.runGoalLifecycle,

    async submitGoal(raw, identity, ctx) {
      const founder = ctx.founder ?? (ports.founderBinding ? await ports.founderBinding.resolveFounderBinding() : undefined);
      return intakeSubmitGoal(raw, identity, {
        ...ctx,
        founder,
        // PORT-BIND the controller entry — the consumer never hand-wires runLifecycle.
        runLifecycle: controller.runGoalLifecycle,
      });
    },

    async approveFap(response, identity, ctx) {
      const founder = ctx.founder ?? (ports.founderBinding ? await ports.founderBinding.resolveFounderBinding() : undefined);
      return intakeApproveFap(response, identity, {
        ...ctx,
        founder,
        // PORT-BIND the sole-mutator door + the contract reader (no DB default — §15 + residency).
        reconciler,
        contract,
      });
    },

    resolveFounderBinding: resolveBinding,

    ports: {
      credentialResolver: ports.credentialResolver,
      configReadiness: ports.configReadiness,
      notifier: ports.notifier,
      founderBinding: ports.founderBinding,
      probeRegistry: ports.probeRegistry,
    },
  };
}
