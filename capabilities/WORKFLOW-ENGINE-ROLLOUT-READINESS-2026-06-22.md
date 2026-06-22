# Workflow Engine — Rollout-Readiness Assessment (2026-06-22)

> Founder question (pre-P2): is the engine runtime complete enough to begin rollout? Preferred sequence:
> 1 finish engine → 2 verify REAL workflow execution → 3 install Admin → 4 install PLOS → 5 capability migrations.
> Method: independent, code-grounded (lead-architect), skeptic-not-cheerleader. DESIGN-ONLY.

## VERDICT: FINISH RUNTIME WORK FIRST — do NOT install into PLOS or optimize P2 mechanics yet.
The durable core is real and verified. But **the engine has never had a real, cross-system workflow run through it**, and the one net-new primitive the board called v1's *entire job* — a step that blocks on an inbound **system** callback and resumes — **was cut from the Slice-1 build and does not exist as wired code.** The founder's own step-2 gate ("verify REAL workflow execution") is unmet. **Most damning:** no production path drives a run — `POST /invoices/prepare-batch` (`admin.ts:1487-1523`) calls `prepareInvoice()` directly, bypassing the engine; the engine has been exercised ONLY by proofs against a throwaway DB.

Document contradiction underlying the framing: `WORKFLOW-ENGINE-V1-BOARD-REVIEW` nominated `invoice-send` (emit→block-on-PLOS-callback→resume) as THE proof; the same-day `DECISION-REVIEW-2026-06-22` **cut that scope** and re-pointed Slice 1 at the verified-loop + human gate. So what shipped is not the readiness proof the board named.

## Per-dimension: BUILT vs MISSING
### 1. Workflow Engine runtime
- **BUILT (strong, verified):** 7-state run + 5-state step machine + legal-edge whitelist + DB-trigger backstop; SKIP-LOCKED lease + CAS + in-order advancement; crash/resume → `recovered`; golden-master cage.
- **MISSING:** (a) **cross-system await-callback is UNWIRED** — the completer (`approvals-route.ts:82`) resolves `human-response` ONLY; `deliveries-api.ts:46-57` inserts a `delivery` row and touches NO `workflow_step`; `events-api.ts` touches no engine state. (b) **Timers/`wake_at`/SLA** not built (migration `0002` comments: DEFERRED) — only `next_retry_at` backoff; a blocked run with no callback waits forever. (c) **multi-step composition** across a cross-system result: never run. (d) **no production driver / tick scheduler** wired; no outbox prune.

### 2. Multi-agent execution
- **BUILT:** dispatch-route PLANS steps (definitions are plan-shaped).
- **MISSING:** **no agent RUNNER** that executes a step and posts a result back; **no agent has ever run through the engine** (§11 C1/C2 deferred the programmatic runner). The mailbox pipeline (classify→intent→contract→comms→followup) is **purely designed**.

### 3. Capability registration
- **BUILT:** in-process registries + one verifier manifest (with a known path bug).
- **MISSING:** registration is **hand-wired** (`registerInvoiceWorkflows()` import side-effect), NOT manifest-discovery-driven; **no real Capability Registry** (just in-process maps for ONE app); the manifest is not a load-bearing contract; a 2nd app (PLOS) would have to hand-author its own wiring.

### 4. Verified-loop execution
- **BUILT:** act→verify→branch→stop loop + back-edge + hard `max_attempts` cap; verifier-as-capability dispatch.
- **MISSING:** **only T1 deterministic** (+ T5 human gate). **No T2 rubric / T3 confidence / T4 LLM-judge**; **no eval-the-evaluator calibration** (the advise-vs-gate safety machinery) — all Slice 3+. So the loop can verify deterministic post-conditions only; the **AI-judgment outcomes that are the actual moat** (mailbox classification/intent/tone) cannot yet be verified.

## Genuinely DONE and strong (do not undersell)
Durable core (state machine + lease/CAS + crash-resume + DB-trigger backstop + cage) — verified. The **human gate is load-bearing, not theater** (verified principal, machine-roles rejected, single-use, fail-closed in-txn audit) — retired the 2026-06-17 presence-only defect. The **ownership boundary is clean** (engine grep-domain-free; portabilization well-executed). The **verified-loop mechanics work** for a T1 stop with an unbypassable cap. This is a solid Slice-0 + Slice-1 — just not a rollout-ready cross-system orchestration engine.

## Premature to install/optimize around
P2 mechanics (drift-gate/migration-runner) — the completer surface + await-source + schema will change when the system-callback source is wired. PLOS install — PLOS's value (mailbox multi-agent) needs the agent runner + T2-T4 verifiers, none of which exist; it would inherit an engine that runs only deterministic in-process loops + human gates. Registry generalization — N=1 (Waterline).

## Minimum to reach step-2 ("verify REAL workflow execution")
The smallest REAL proof = **`invoice-send`** (2-step, cross-system, rides only proven infra): emit `invoice.send_requested` → **block** on the PLOS delivery callback → **resume** on `/v1/deliveries` → emit `invoice.send_settled`. Build:
1. **Wire the callback completer to the workflow step (THE gate):** an inbound `/v1/deliveries` outcome whose `eventId` matches `workflow_step.awaiting_event_id` advances `blocked→done` + run `blocked→executing`, IN the same idempotent txn as the delivery insert, CAS-guarded (enable `await_source='system-callback'`).
2. **An `await-callback` StepEffect + engine branch** (emit-in-txn → `executing→blocked`, holds no lease, exits) — distinct from the irreversible/cap-trip human-gate path.
3. **The `invoice-send` 2-step definition** (dispatch-route plan-shaped, no DSL).
4. **Adversarial recovery proofs** (author≠verifier): callback-before-block, duplicate callback, crash-while-blocked, + one real step-2-consumes-step-1 composition.
5. **Drive it from a real gesture** (one operator gesture `enqueue("invoice-send",…)` + an on-demand/scheduled tick) — not a harness.

## Sequencing (what GATES rollout vs follows)
- **GATES rollout:** (1) cross-system callback wiring + the `invoice-send` proof = the step-2 gate; (2) a production driver + tick scheduler.
- **Follows into Admin, GATES the PLOS install specifically:** (3) timers/`wake_at`/SLA (Slice 2 — soon after gate 1; a cross-system engine with no SLA in prod is fragile); (4) agent-result runner + ≥1 calibrated T2-T4 verifier + eval-the-evaluator — **GATE PLOS** (the advise-vs-gate property is the only thing between a confident-wrong LLM verifier and an autonomous machine-speed mistake).
- **Non-gating follow-on:** (5) capability registry / manifest discovery (N≥2, Waterline); (6) outbox prune; fix the manifest path bug opportunistically.

## Bottom line
Bank P1 (engine canonical in DOS + cleanly installed into Admin — done + verified). **Next runtime work = wire the cross-system callback and run `invoice-send` end-to-end** (step-2 gate). Defer P2 installation mechanics + the PLOS install until the engine has proven a real cross-system workflow; defer T2-T4/agent-runner until before PLOS specifically.
