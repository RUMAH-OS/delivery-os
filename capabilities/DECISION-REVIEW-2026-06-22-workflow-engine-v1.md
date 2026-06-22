# §11 Decision Review — Workflow Engine v1 surface (build-readiness)

- Date: 2026-06-22 · Decision: build the smallest viable Workflow Engine v1 (verified-loop + Verifier capability) per DELIVERY-OS-EXECUTION-MODEL-V1.md.
- Panel (4 blind lenses): database-data · integration-architect · security-compliance · reviewer-critic.

## CONSOLIDATED VERDICT: RATIFY-WITH-CONDITIONS (4/4, no REVISE)
The model is sound and reuses a proven base (verified on disk: the `blocked→executing` edge already exists in state-machine.ts L36 "approval, callback, timer"; the `/v1/deliveries` completer's in-txn/idempotent/CAS/eventId-integrity discipline; Slice 0). The engine stays minimal; the Verifier is correctly a capability, not engine. BUT the "smallest viable v1 surface" accreted (5 sources + 5 pieces + 5 verifier types + an eval framework) — cut Slice 1 hard.

## THE SLICE-1 SCOPE (unanimous — what to build first)
Prove Goal→Act→Verify→Improve→Stop end-to-end on ONE real Admin workflow, off-prod on the Slice-0 harness, with ZERO net-new agent runtime, ZERO eval infrastructure, NOT gated on the comms go-live:
- **Workflow:** a bounded retry on a real Admin in-process action with a **T1 deterministic stop** — candidate: invoice-prepare retried until a deterministic post-condition (prepared draft exists · number IS NULL · exactly-one-row), capped at maxAttempts, escalating to a human-response gate on cap-trip.
- **Net-new (minimum):** (1) P4 branch/next-selector + back-edge; (2) REUSE existing `attempt`/`max_attempts` (do NOT add a 2nd counter) for the hard-cap; (3) objective `stopCondition` predicate (declarative jsonb) over a verdict; (4) the Verifier CONTRACT instantiated by ONE **T1 deterministic** verifier (eval-exempt, P2 in-process); (5) the **human-response** source; (6) the generalized completer (`awaiting_event_id` + UNIQUE partial index; advance `blocked→executing` in-txn/CAS/idempotent). Slice 1 exercises two sources: system-callback (proven, reused as template) + human-response.

## CONDITIONS (binding, before/within build)
### Data
- D1: `await_source` CHECK enum; **UNIQUE partial index on `awaiting_event_id`** (makes duplicate-callback safe by construction + the completer match unambiguous); partial index on `wake_at WHERE state='blocked'` (when timer lands). 
- D2: **step-level legal-edge trigger** — the completer is the first cross-process writer of step state (`blocked→done`); DB backstop required (run-state trigger already covers the edges — verified, no change).
- D3: **reuse existing `attempt`/`max_attempts`**; back-edge routes through the retry path (bumps attempt), await-resume through the resume path (keeps attempt) — else the hard-cap isn't honored.
- D4: `stopCondition` + `verdict` as declarative jsonb (engine evaluates a pure predicate over a stored verdict; never runs the verifier). Tested down-migration + CI cage.
### Security (the human gate is load-bearing — do NOT repeat the 2026-06-17 presence-only gate theater)
- S1 (BLOCKING): human-response callback = **verified human principal** (real session JWT, not presence/service token) + bound to run+step+**action/candidate id** + **single-use** (CAS-consumed) + **in-transaction, fail-CLOSED durable audit** atomic with the `blocked→executing` advance (if the audit write fails, the gate does NOT open). Adopt the 2026-06-17 conditions 2-3 verbatim.
- S2 (BLOCKING): **per-source least-privilege scopes + source-match** in the completer (`deliveries:write` system / `agent:callback` / `approvals:write` human — never issued to a service/agent token; timer **internal-only, no HTTP ingress**). A callback may only resolve a step awaiting its own source.
- S3 (BLOCKING): **irreversible step ⟹ only a T5 human verifier may gate** (agent-result/non-T5 = advance-only, never resolve the irreversible step). Preserve C6 by construction (engine.ts no-spawn/blocked discipline; cage asserts it).
- S4: **verdict PII-free at the seam** — `reasons` as coded enum, not free text; free-text rationale stays in PLOS (`.strict()` inbound). 
- S5: advise-vs-gate enforced against the verifier's **measured** governance-ladder rung server-side, not a manifest flag (generalizes the standing sideEffect-honesty enforcement gap).
### Correlation / race / integrity
- R1: the await emits its request event + sets `awaiting_event_id` + transitions `executing→blocked` in ONE txn; the completer matches `awaiting_event_id` first / `state` second; dedup key = the callback's OWN identity. Closes callback-before-block + duplicate-callback.
- R2: named author≠verifier proof cases: callback-before-block, duplicate-callback, crash-while-blocked, timer-fires-during-recovery; cap unbypassable by construction.
### Scope / honesty
- C1: add a "Slice 1 scope" box to the model so §10.5 is not read as a build manifest; state explicitly the eval-the-evaluator framework is **Slice 3+, not v1**.
- C2: **agent-result in v1 = the contract + a manual/single-bounded-invocation runner that POSTs the callback (mechanically = human-response)**. A programmatic/autonomous agent runner is DEFERRED + founder-gated + re-crosses the Admin↔PLOS seam (own §11 + a single hash-checked seam contract). Do NOT pretend a programmatic runner ships in v1.

## DEFERRED (explicit, each its own gate): timer-wake (Slice 2, small) · agent-result programmatic runner (post-V6/PLOS) · domain-event source (Waterline) · T2/T3/T4 verifiers + the entire eval-the-evaluator framework (Slice 3+) · SLA/dead-letter/router/DSL/queue-adapter.

## Recommendation to the founder
Ratify Slice 1 at the cut scope. It proves the verified loop on a real Admin action with a T1 deterministic stop + a human-gated cap — no agent runtime, no eval infra, no comms-go-live dependency — buildable off-prod today. The strategic eval/verifier investment follows the proven loop (Slice 3+), exactly as the model says.
