// Workflow Engine — workflow DEFINITION mechanism (Slice 0; GENERIC).
// §11 C7: a workflow DEFINITION is an ORDERED LIST of dispatch-route plan-shaped steps. NO new DSL,
// no third lifecycle list. Each step carries the fields dispatch-route already resolves (step_type /
// owner / skill / ku) plus the engine's execution metadata (effect, max_attempts). The engine RUNS
// what this list describes; it does not invent a workflow language.
//
// OWNERSHIP BOUNDARY: this module is GENERIC mechanism only — the definition TYPES + an empty registry
// + register/get functions. It carries ZERO domain knowledge (no app-specific concepts). Per-project
// workflow CONTENT lives in an APP-owned module that calls registerDefinition() at startup. Only the
// engine TOOL travels (vendored); definitions are per-project config (the TOOL-vs-DEFINITION-vs-DATA
// split). This split lets the engine be vendored verbatim into each installer.

import type { StepEffect } from "./state-machine.js";

// A declarative stop-condition predicate (D4) — a PURE predicate over the verify step's stored Verdict.
// The engine evaluates this; it NEVER runs the verifier. Slice 1 supports exactly the predicate the loop
// needs: "the verdict equals X". No DSL, no expression language — a tagged, closed shape.
export type StopCondition =
  | { kind: "verdict-equals"; value: "pass" | "fail" }; // stop when the stored verdict === value

// A definition step — the plan-shaped unit (dispatch-route output + engine metadata). PII-free.
export interface DefinitionStep {
  // dispatch-route plan shape (the existing vocabulary — agent/skill/knowledge-route + ownership-policy):
  stepType: string; // the work-type / dispatch step kind
  owner: string; // resolved owner (ownership-policy requiredOwner)
  skill?: string | null; // skill-route top match (advisory)
  ku?: string | null; // knowledge-route top match (advisory)
  // engine execution metadata:
  effect: StepEffect; // emit-only | idempotent | irreversible (drives the C6 unattended-vs-blocked gate)
  maxAttempts: number; // per-step retry ceiling (auto-retry with backoff; criterion #5)
  handler: string; // the registered executor key (engine resolves this to a function)
  // ── MULTI-AGENT requirement (Slice 1; meaningful on an `agent-result` await-callback step) ──
  // WHICH agent must execute this step's work. `id` pins an exact agent; `skill` requests ANY agent that has
  // that skill. The engine MATERIALIZES this onto the step at plan time (step.agent_requirement); the runner
  // resolves it to exactly one registered agent (selectAgentFor) and routes the step to that agent's executor,
  // recording the resolved agent_id. FAIL-CLOSED: an unresolvable requirement fails THAT step (no arbitrary
  // agent). Omitted on non-agent-result steps (they run the in-process engine handler, not an agent executor).
  agent?: { id?: string; skill?: string };
  // ── await-callback source declaration (S2 per-source least-privilege) ──
  // ONLY meaningful on an `await-callback` step: which callback SOURCE resolves this step's block. The engine
  // writes this onto the blocked step's await_source, and the completer matches on it (a 'system-callback' post
  // can NEVER resolve an 'agent-result' step and vice-versa — the bidirectional guard). Defaults to
  // 'system-callback' (the v1 cross-system primitive) when omitted, so existing definitions are unchanged.
  awaitSource?: "system-callback" | "agent-result"; // (other enum values exist in DDL but are not engine-driven yet)
  // ── Slice 1 (verified-loop, §10.2) — present ONLY on a `verify` step ──
  verifierId?: string; // the GATING Verifier capability id to run in-process — its verdict DRIVES the loop
  stopCondition?: StopCondition; // the declarative predicate the engine evaluates over the stored verdict (D4)
  retryBackToSeq?: number; // the back-edge target: which earlier step to re-ready when the predicate is NOT met
  gateSeq?: number; // on cap-trip, which step becomes the human-response gate (its effect MUST be irreversible)
  // ── T2-T4 framework — advise-vs-gate (the safety crux) ──
  // OPTIONAL advisory verifiers that run ALONGSIDE the gating one (run + record their verdict, NEVER gate). A
  // not-yet-calibrated judge can shadow/advise in production safely via this list — its verdict is recorded as
  // ADVISORY and can never affect the loop's stop/retry/cap decision. Each id is a registered Verifier id.
  advisoryVerifierIds?: string[];
}

export interface WorkflowDefinition {
  key: string; // definition_key — the per-project recipe id
  description: string;
  steps: DefinitionStep[]; // ORDERED (seq = array index)
}

// ── The definition registry — GENERIC + EMPTY. Per-project content registers INTO it at startup. ──
// The engine ships with NO definitions; an owning app calls registerDefinition() for each of its
// workflows before a run executes. Re-registering the same key overwrites (idempotent on re-import).
const DEFINITIONS: Record<string, WorkflowDefinition> = {};

export function registerDefinition(def: WorkflowDefinition): void {
  DEFINITIONS[def.key] = def;
}

export function getDefinition(key: string): WorkflowDefinition | undefined {
  return DEFINITIONS[key];
}

// Remove a definition (E-PH M3a deregistration). When a tenant deregisters, its definitions leave the registry
// so a goal can no longer enqueue an un-serviced run. Additive; the engine never calls this on its own path.
export function unregisterDefinition(key: string): void {
  delete DEFINITIONS[key];
}
