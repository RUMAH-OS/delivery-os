// Workflow Engine — the AGENT REGISTRY + DISCOVERY/ROUTING (the MULTI-AGENT runtime layer; GENERIC, domain-free).
//
// THE BOUNDARY (keep it): dispatch-route PLANS owner/skill/ku onto a step (the plan-shape DefinitionStep); the
// CAPABILITY SELECTOR resolves a goal → exactly one capability (capability-selector.ts). THIS module is the
// missing EXECUTABLE layer between them: a registry of AGENTS (each holds an executor PORT) + a deterministic,
// fail-closed router that resolves a step's agent REQUIREMENT ({id?, skill?}) to EXACTLY ONE registered agent.
// The runner (agent-runner.ts) routes each claimed agent-result step to its resolved agent's executor.
//
// IT MIRRORS capability-selector.ts ON PURPOSE (same fail-closed tagged-union shape): exact id wins; else match
// by skill; 0 → no-match; >1 → ambiguous (NEVER pick arbitrarily). Pure + deterministic (no I/O). It carries
// ZERO domain knowledge (no invoice/claude/app concept) — grep-clean exactly like the rest of the engine. WHAT
// an agent can do is APP-DECLARED content (its skills + its injected executor); the MECHANISM here is canonical.

import type { AgentExecutor } from "./agent-runner.js";

// ── An AGENT — the smallest viable executable unit. The app DECLARES these (its skills + its injected executor
// port). `id` is the stable identity recorded onto the step's resolved agent_id + the per-agent outbox events.
// `skills` are the capabilities this agent can serve (a step's `skill` requirement matches against this set). ──
export interface Agent {
  id: string;
  skills: string[];
  executor: AgentExecutor; // the injected PORT — (task) => Promise<{ok, result?, error?}>. App-supplied.
}

// ── A step's AGENT REQUIREMENT — what an agent-result step DECLARES it needs (materialized onto the step at plan
// time). `id` pins an exact agent (highest precedence); `skill` requests ANY agent that has that skill. Both
// optional: a requirement with NEITHER is unroutable (fail-closed no-match) — a step must name what it needs. ──
export interface AgentRequirement {
  agentId?: string;
  skill?: string;
}

// ── The discovery result — a closed, tagged union mirroring SelectionResult. EXACTLY ONE of:
//   selected   — the requirement resolved to exactly one agent (its id is the resolved agent_id).
//   no-match   — zero agents satisfied the requirement (FAIL-CLOSED: the step fails; NO arbitrary agent).
//   ambiguous  — more than one agent satisfied a skill requirement (FAIL-CLOSED: NEVER pick arbitrarily). ──
export type AgentSelectionResult =
  | { kind: "selected"; agentId: string }
  | { kind: "no-match" }
  | { kind: "ambiguous"; candidates: string[] };

// ── The AGENT REGISTRY — register / get / list. FAIL-CLOSED on a duplicate agent id (a silent overwrite would
// route work to the wrong executor). Holds the app-supplied agents; the runner is constructed with one. ──
export class DuplicateAgentError extends Error {
  constructor(public readonly agentId: string) {
    super(`duplicate agent id: "${agentId}" — agent ids must be unique within a registry (fail-closed)`);
    this.name = "DuplicateAgentError";
  }
}

export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();

  // register ONE agent. FAIL-CLOSED on a duplicate id (throws DuplicateAgentError) — never a silent overwrite.
  register(agent: Agent): void {
    if (this.agents.has(agent.id)) throw new DuplicateAgentError(agent.id);
    this.agents.set(agent.id, { id: agent.id, skills: [...agent.skills], executor: agent.executor });
  }

  get(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  // list in a deterministic order (sorted by id) — so candidate lists + reports are stable.
  list(): Agent[] {
    return [...this.agents.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}

// ── registerAgents — build a registry from a declared list (the app's single declared roster). FAIL-CLOSED on
// any duplicate id across the list (the registry throws). Returns the ready registry. ──
export function registerAgents(agents: Agent[]): AgentRegistry {
  const registry = new AgentRegistry();
  for (const a of agents) registry.register(a);
  return registry;
}

// ── selectAgentFor — resolve a step's agent REQUIREMENT to EXACTLY ONE registered agent. Pure + deterministic.
// PRECEDENCE: an exact agentId wins (it pins one agent unambiguously). Else match by skill across the roster.
// FAIL-CLOSED: a requirement naming an agentId that is NOT registered → no-match (NEVER fall back to skill — a
// pinned-but-absent agent is an error, not a hint). A skill matching 0 agents → no-match; >1 → ambiguous
// (candidates surfaced, deterministic order). A requirement (or none) naming NEITHER id nor skill → no-match. ──
export function selectAgentFor(
  requirement: AgentRequirement | undefined | null,
  registry: AgentRegistry,
): AgentSelectionResult {
  const req = requirement ?? {};

  // (1) exact agentId — the highest-precedence, unambiguous pin. Present-but-unregistered = no-match (fail-closed).
  if (req.agentId !== undefined && req.agentId !== "") {
    const agent = registry.get(req.agentId);
    return agent ? { kind: "selected", agentId: agent.id } : { kind: "no-match" };
  }

  // (2) skill match — ANY agent whose skill set contains the requested skill. 0 → no-match; 1 → selected; >1 →
  //     ambiguous (NEVER arbitrary — the colliding candidates are surfaced honestly, sorted for a stable reply).
  if (req.skill !== undefined && req.skill !== "") {
    const candidates = registry.list().filter((a) => a.skills.includes(req.skill!)).map((a) => a.id);
    if (candidates.length === 0) return { kind: "no-match" };
    if (candidates.length === 1) return { kind: "selected", agentId: candidates[0]! };
    return { kind: "ambiguous", candidates: [...candidates].sort() };
  }

  // (3) a requirement naming NEITHER id nor skill is unroutable (a step must declare what it needs). Fail-closed.
  return { kind: "no-match" };
}
