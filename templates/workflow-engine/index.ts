// Workflow Engine — the public barrel. The CANONICAL surface an installer consumes.
// Home: delivery-os/templates/workflow-engine/ (the single source of truth). Apps vendor this directory
// (sha-pinned) and consume ONLY this barrel + the route/port factories. The engine declares the ports
// (EngineContext, HumanPrincipalPort) and the scopes (WORKFLOW_SCOPES); the app supplies the impls.

// ── runner ──
export { createEngine, evaluateStopCondition, isUniqueViolation } from "./engine.js";
export type { Engine, EngineContext, EngineTables, DbLike, TickReport, TxLike } from "./engine.js";

// ── state machine ──
export {
  RUN_STATES, STEP_STATES,
  LEGAL_RUN_EDGES, LEGAL_STEP_EDGES,
  TERMINAL_RUN_STATES, isTerminal,
  isLegalRunTransition, assertLegalRunTransition, IllegalTransitionError,
  isLegalStepTransition, assertLegalStepTransition, IllegalStepTransitionError,
  isUnattendedSafe, isAwaitCallback,
} from "./state-machine.js";
export type { RunState, StepState, StepEffect } from "./state-machine.js";

// ── definition registry + types ──
export { registerDefinition, getDefinition } from "./definitions.js";
export type { WorkflowDefinition, DefinitionStep, StopCondition } from "./definitions.js";

// ── handler registry + types ──
export { registerHandler, runHandler } from "./handlers.js";
export type { Handler, StepContext, HandlerResult } from "./handlers.js";

// ── verifier registry + types ──
export { registerVerifier, getVerifier } from "./verifiers.js";
export type { Verifier, VerifierInput, Verdict, VerifierVerdict } from "./verifiers.js";
// ── T2-T4 verifier framework: rung + calibration (eval-the-evaluator) + advise-vs-gate ──
export {
  getVerifierRung, isGatingExemptRung, isJudgmentRung,
  evaluateVerifier, evaluateAndRegister, recordCalibration, getCalibration,
  gateDecision, isGateEligible, __resetVerifiersForTest,
} from "./verifiers.js";
export type {
  VerifierRung, CalibrationCase, CalibrationThresholds, CalibrationResult, GateDecision,
} from "./verifiers.js";

// ── human-gate doctrine: the port + policy + scopes ──
export { WORKFLOW_SCOPES, NON_HUMAN_ROLES, isVerifiedHuman, isNonHumanRole } from "./human-principal.js";
export type { HumanPrincipalPort, Principal, WorkflowScope } from "./human-principal.js";

// ── capability-pack contract (the app-agnostic install seam) ──
export { registerPacks, createCapabilityRuntime, CapabilityConflictError, SelectorUnknownDefinitionError } from "./capability-pack.js";
export type { CapabilityPack, PackHandler, CapabilityRuntime, CapabilityRuntimeContext } from "./capability-pack.js";

// ── capability SELECTION (the front of the chain: Goal → Capability → run; deterministic, fail-closed) ──
export { selectCapability, submitGoal } from "./capability-selector.js";
export type { Goal, CapabilitySelector, SelectableCapability, SelectionResult, SubmitGoalDeps, SubmitGoalResult } from "./capability-selector.js";
export { createGoalsRoute } from "./goals-route.js";
export type { GoalsRouteContext } from "./goals-route.js";

// ── route factories ──
export { createWorkflowRoute } from "./workflow-route.js";
export type { WorkflowRouteContext, ScopeGuard } from "./workflow-route.js";
export { createApprovalsRoute } from "./approvals-route.js";
export type { ApprovalsRouteContext } from "./approvals-route.js";

// ── system-callback completer (the v1 cross-system primitive's resume side) ──
export { completeAwaitingStep } from "./callback-completer.js";
export type { CompleteAwaitingArgs, CompleteAwaitingResult } from "./callback-completer.js";

// ── agent runner (Slice A: continuous, durable, concurrent drain of blocked agent-result steps) ──
export { claimAgentTask, createAgentRunner, AGENT_RESULT_SOURCE, DEFAULT_AGENT_ID } from "./agent-runner.js";
export type {
  AgentTask, AgentExecutor, AgentExecutorOutcome,
  ClaimedAgentTask, ClaimArgs, AgentRunnerArgs, AgentRunnerHandle, RunOnceReport,
} from "./agent-runner.js";

// ── MULTI-AGENT registry + discovery/routing (Slice 1: goal→capability→AGENT routing; deterministic, fail-closed) ──
export { AgentRegistry, registerAgents, selectAgentFor, DuplicateAgentError } from "./agent-registry.js";
export type { Agent, AgentRequirement, AgentSelectionResult } from "./agent-registry.js";

// ── callback contract (pure zod) ──
export { ApprovalCallbackV1, ApprovalCallbackResponseV1 } from "./contracts/approvals-v1.js";

// ── SHIPPED drizzle schema (the engine's own table objects — installers import these for EngineContext.tables
//    instead of re-typing them; domain-free; matches the canonical engine migration set exactly) ──
export { workflowRun, workflowStep, outbox, workflowApprovalAudit } from "./schema.js";
