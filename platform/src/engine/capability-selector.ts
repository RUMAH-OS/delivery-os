// Workflow Engine — CAPABILITY SELECTION (the front of the chain: Goal → Capability → run). GENERIC mechanism.
// §11 — Delivery-OS-as-installable-platform. This is the deterministic, fail-closed router that resolves a GOAL
// (an intent/text/payload — NOT a hand-picked definitionKey) to EXACTLY ONE registered capability, then enqueues
// the run the proven production runner executes to verified completion. It is the entrypoint Slack (and any other
// caller) will call. It carries ZERO domain knowledge (no invoice/agent/app concepts) — grep-clean exactly like
// the rest of the engine. WHAT a capability matches is APP-DECLARED content (a `selector`); the MECHANISM here is
// the canonical engine concern.
//
// THE BOUNDARY (keep it):
//   - The selection MECHANISM (this file) is generic + pure + deterministic. No LLM. Safe + testable.
//   - WHAT each capability MATCHES is declared by the app on its capability (the `selector` field below).
//   - FAIL-CLOSED: zero matches → no-match (NO run). More than one match → ambiguous (NO run, never pick
//     arbitrarily). A capability with NO selector is not goal-selectable (must be enqueued explicitly).
//   - LLM-assisted selection is a LATER milestone (it needs the verifier framework). This is deterministic-first.

// ── The Goal — the caller's INTENT, not a hand-picked recipe. PII-free refs by convention (the app owns the
// payload shape; the engine treats it as opaque). `intent` is a normalized intent-label (exact match); `text`
// is free-text a `match` predicate may inspect; `payload` carries structured inputs a `match` may extract. ──
export interface Goal {
  intent?: string;
  text?: string;
  payload?: Record<string, unknown>;
}

// ── The declarative SELECTOR an app attaches to a capability/definition. Smallest viable + deterministic. ──
//   intent — an exact, normalized intent-label this capability serves (case/whitespace-insensitive compare).
//   match  — a PURE predicate over the goal returning the EXTRACTED inputs (the enqueue `input`) when the goal
//            matches, or null when it does NOT. MUST be deterministic + side-effect-free (the engine calls it
//            during routing). A capability may declare `intent`, `match`, both, or neither (neither = not
//            goal-selectable). When BOTH are present the capability matches if EITHER matches (intent OR match).
export interface CapabilitySelector {
  intent?: string;
  match?: (goal: Goal) => Record<string, unknown> | null;
}

// A definition the engine can route to — its key + (optional) its declared selector. The app supplies these; the
// registry below holds them. (The selector lives ALONGSIDE the WorkflowDefinition so app content stays one unit.)
export interface SelectableCapability {
  definitionKey: string;
  selector?: CapabilitySelector;
}

// ── The selection result — a closed, tagged union. EXACTLY ONE of: selected | no-match | ambiguous. ──
export type SelectionResult =
  // the goal resolved to exactly one capability; `inputs` are what selectCapability extracted (the enqueue input).
  | { kind: "selected"; definitionKey: string; inputs: Record<string, unknown> }
  // zero capabilities matched the goal. FAIL-CLOSED: no run is created.
  | { kind: "no-match" }
  // more than one capability matched. FAIL-CLOSED: no run is created; the candidates are surfaced honestly.
  | { kind: "ambiguous"; candidates: string[] };

// normalize an intent label for an exact-but-tolerant compare (trim + lowercase). Pure.
function normIntent(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// ── selectCapability — resolve a goal to EXACTLY ONE capability. Deterministic + pure (no I/O, no enqueue). ──
// For each registered selectable capability: if its selector's `intent` equals the goal's intent (normalized),
// OR its `match(goal)` returns a non-null inputs object, the capability is a CANDIDATE. The extracted inputs are:
//   - the `match` return value when match produced the hit, ELSE
//   - the goal's `payload` (or {}) when the hit was an intent-only match.
// FAIL-CLOSED: 0 candidates → no-match; 1 → selected; >1 → ambiguous (candidates listed, deterministic order).
export function selectCapability(
  goal: Goal,
  opts: { registry: SelectableCapability[] },
): SelectionResult {
  const goalIntent = normIntent(goal.intent);
  // collect candidates deterministically (registry order is the app's declared order).
  const hits: { definitionKey: string; inputs: Record<string, unknown> }[] = [];

  for (const cap of opts.registry) {
    const sel = cap.selector;
    if (!sel) continue; // no selector → not goal-selectable (must be enqueued explicitly).

    let inputs: Record<string, unknown> | null = null;

    // (1) match predicate (the richer, input-extracting path) takes precedence for the extracted inputs.
    if (typeof sel.match === "function") {
      const extracted = sel.match(goal);
      if (extracted !== null && extracted !== undefined) inputs = extracted;
    }

    // (2) intent-label exact match (OR with the predicate). On an intent-only hit, the inputs are the goal payload.
    if (inputs === null && sel.intent !== undefined && goalIntent !== "" && normIntent(sel.intent) === goalIntent) {
      inputs = { ...(goal.payload ?? {}) };
    }

    if (inputs !== null) hits.push({ definitionKey: cap.definitionKey, inputs });
  }

  if (hits.length === 0) return { kind: "no-match" };
  if (hits.length > 1) {
    // FAIL-CLOSED: never pick arbitrarily. Surface the colliding candidates (sorted for a stable response).
    const candidates = [...new Set(hits.map((h) => h.definitionKey))].sort();
    // a single capability matched BOTH on intent and match would appear once → not ambiguous; guard for that.
    if (candidates.length === 1) return { kind: "selected", definitionKey: candidates[0]!, inputs: hits[0]!.inputs };
    return { kind: "ambiguous", candidates };
  }
  return { kind: "selected", definitionKey: hits[0]!.definitionKey, inputs: hits[0]!.inputs };
}

// ── submitGoal — THE GOAL ENTRYPOINT. select → (if selected) enqueue → return the run handle; else return the
// honest no-match/ambiguous result WITHOUT creating a run. This is what the route (and Slack) calls. ──
//   deps.registry        — the selectable capabilities (definitionKey + selector). Built from the app's content.
//   deps.enqueue         — the engine's enqueue (definitionKey, input, idempotencyKey) → { runId, created }.
//   deps.idempotencyKey  — OPTIONAL: a stable idempotency key for this goal submission (so a retried submit
//                          returns the SAME run). When omitted, a fresh random key is minted (one run per call).
export interface SubmitGoalDeps {
  registry: SelectableCapability[];
  enqueue: (definitionKey: string, input: Record<string, unknown>, idempotencyKey: string) => Promise<{ runId: string; created: boolean }>;
  idempotencyKey?: string;
}

export type SubmitGoalResult =
  | { kind: "enqueued"; runId: string; definitionKey: string; created: boolean }
  | { kind: "no-match" }
  | { kind: "ambiguous"; candidates: string[] };

export async function submitGoal(deps: SubmitGoalDeps, goal: Goal): Promise<SubmitGoalResult> {
  const selection = selectCapability(goal, { registry: deps.registry });
  if (selection.kind !== "selected") return selection; // no-match / ambiguous → NO run created (fail-closed).

  const idempotencyKey = deps.idempotencyKey && deps.idempotencyKey.length > 0
    ? deps.idempotencyKey
    : `goal-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { runId, created } = await deps.enqueue(selection.definitionKey, selection.inputs, idempotencyKey);
  return { kind: "enqueued", runId, definitionKey: selection.definitionKey, created };
}
