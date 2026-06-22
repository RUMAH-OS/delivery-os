// Workflow Engine — the public barrel. The CANONICAL surface an installer consumes.
// Home: delivery-os/templates/workflow-engine/ (the single source of truth). Apps vendor this directory
// (sha-pinned) and consume ONLY this barrel + the route/port factories. The engine declares the ports
// (EngineContext, HumanPrincipalPort) and the scopes (WORKFLOW_SCOPES); the app supplies the impls.

// ── runner ──
export { createEngine, evaluateStopCondition } from "./engine.js";
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

// ── human-gate doctrine: the port + policy + scopes ──
export { WORKFLOW_SCOPES, NON_HUMAN_ROLES, isVerifiedHuman } from "./human-principal.js";
export type { HumanPrincipalPort, Principal, WorkflowScope } from "./human-principal.js";

// ── route factories ──
export { createWorkflowRoute } from "./workflow-route.js";
export type { WorkflowRouteContext, ScopeGuard } from "./workflow-route.js";
export { createApprovalsRoute } from "./approvals-route.js";
export type { ApprovalsRouteContext } from "./approvals-route.js";

// ── system-callback completer (the v1 cross-system primitive's resume side) ──
export { completeAwaitingStep } from "./callback-completer.js";
export type { CompleteAwaitingArgs, CompleteAwaitingResult } from "./callback-completer.js";

// ── callback contract (pure zod) ──
export { ApprovalCallbackV1, ApprovalCallbackResponseV1 } from "./contracts/approvals-v1.js";
