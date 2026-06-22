# Workflow Engine v1 — Board Recommendation (DESIGN / REVIEW ONLY)

> Anchored on what is now VALIDATED. Reconciles + extends the prior engine work (EXECUTION-ENGINE-DESIGN +
> §11 + the BUILT Slice 0) and the just-proven Admin/PLOS comms round-trip. Do NOT build yet — board call.

## VERDICT
**YES — move into Workflow Engine v1 now, narrowly scoped to ONE net-new primitive (the cross-system capability-step: emit-request → await-callback) proven on ONE real 2-step workflow (`invoice-send`).** This is NOT a green light for "build the workflow platform."

**Why the posture changed since the 2026-06-18 §11** (which ranked the engine LARGE + lowest-priority and named speculative construction the top risk): the two halves the engine needs are now each **independently PROVEN on real Admin work**, so v1 is connecting two proven things, not speculating.
1. **Durable orchestration + recovery is BUILT + verified** (Slice 0 PASS — `VERIFY-execution-engine-slice0.md`): 7-state machine, SKIP-LOCKED tick, CAS, trigger+RLS; #1 unattended-terminal / #4 kill-and-resume / #5 forced-failure→`recovered`.
2. **The atomic cross-system round-trip is PROVEN** (`VERIFY-invoice-delivery-status.md`): `invoice.send_requested` → drain → PLOS resolve+send → `/v1/deliveries` callback → Admin records. This is exactly the shape of a durable "do work in another system and await the result" step.

The 2026-06-18 worry (building the engine before a real cross-system step exists) is retired: the step exists and works. v1 productizes the **DOS = Orchestration** third of the validated `Admin=State · PLOS=Communication · DOS=Orchestration` pattern. admin-first-proof holds; reuse-heavy (~4 small additions on two fully-built subsystems) contains the over-build risk.

**Legitimate no-go:** if the board judges there is no REAL multi-step need NOW, DEFER (the standing §11 sequencing gate). Read: invoice-send is real (founder pain #1) and rides only proven infra — bar met.

## Proven vs what v1 must still prove (honesty ledger)
**PROVEN:** the state machine + illegal-edge refusal; unattended terminal via tick(); kill-mid-step resume (no lost/double work); forced-failure→`recovered`; CAS under concurrency; DB safety; AND, separately, the emit→drain→execute→callback→record round-trip (idempotent, PII-free, no invoice mutation).
**NOT YET PROVEN (v1's entire job):** (a) a step that BLOCKS a run and is RESUMED by an inbound callback (today engine steps run in-process; the deliveries callback touches no workflow run — the two are unwired); (b) multi-step composition (step N+1 consumes step N's cross-system result); (c) recovery across a real cross-system workflow (crash-while-blocked; duplicate callback; callback-before-block race).

## v1 SCOPE — IN (the one idea + 4 small net-new pieces)
The cross-system **capability-step (emit-request → await-callback)** = the comms round-trip generalized into a durable engine step, reusing the two state-machine edges that already exist for it (`executing→blocked` = "blocked on a callback"; `blocked→executing` = "callback satisfied").
- **N1** — `StepEffect = "await-callback"` + engine branch: emit the request to the outbox in-txn, drive `executing→blocked`, exit (does NOT complete in-tick). Unattended-safe (emits a request, mutates no money).
- **N2** — correlation: request event carries `workflowRef` (runId+seq); inbound callback `eventId` maps to the waiting step. Likely just a `workflow_step.awaiting_event_id` column + index — **no new table**.
- **N3** — a thin **callback completer** inside the existing `deliveries-api` txn: when an outcome's `eventId` matches a waiting step → mark done + `blocked→executing`, CAS-guarded, same txn as the (already idempotent) delivery insert.
- **N4** — ONE real 2-step workflow DEFINITION (`invoice-send`), dispatch-route plan-shaped, no DSL.
No new transport (outbox + live drain + live callback), no new planner (dispatch-route), no bus, no queue adapter (single SKIP-LOCKED backend, §11 C2), no new lifecycle list (reuses two existing edges, C7).
**New edge cases v1 must prove:** callback-before-block race (record-then-advance-if-waiting; tick checks for an already-arrived outcome before blocking); duplicate callback (CAS on await state); crash-while-blocked (trivial — blocked holds no lease); callback-never-arrives (v1 = escalation EMIT only; full SLA = Slice 1).

## v1 SCOPE — DEFERRED (resist over-build)
Generalizing the callback to other types (signing, contact-intelligence) — Waterline call after a 2nd real callback exists (never a "callback router" on N=1). Full escalation/SLA/dead-letter (Slice 1). pgmq/BullMQ adapter (§11 C2). Cross-repo `fullyProven` gate (Slice 2). Polished live-ledger UI (raw query suffices). Workflow CONTENT Admin doesn't own (lead-to-contract, renewal). Any prod wiring / gate enforcement (v1 stays off-prod behind the comms go-live, like Slice 0).
**Already built (reuse):** state machine, tick/CAS/backoff/recovered, in-process handlers, definition format, migration 0034 + trigger/RLS, golden-master cage, outbox, `/v1/events` drain, `/v1/deliveries` callback, PLOS drain→send→callback, dispatch-route/gates/os-inherit. **Net-new = N1–N4 only.**

## First proof workflow — `invoice-send` (2-step, cross-system)
Step 1 (await-callback) `request-send`: emit `invoice.send_requested` → BLOCK on the PLOS delivery callback. Step 2 (in-process) `record-outcome`: on resume, emit `invoice.send_settled`.
Why this, not renewal: reuses the ONE callback proven end-to-end (no new PLOS/contract/seam work — it orchestrates the round-trip that runs by hand today); honors the ownership boundary 1:1 (Admin = state steps + the engine primitive; PLOS = comms content behind the seam; DOS = the durable run); genuinely multi-step + cross-system (the two unproven rows) while being the smallest such thing. The irreversible ISSUE step stays `blocked`-for-human (§11 C6).
**Renewal is the north-star ILLUSTRATION of why multi-step** (eligibility→generate→sign→activate→invoice spans Admin state + PLOS comms + signing + billing with human gates + real crash exposure) **but NOT the v1 target:** the signing callback isn't a proven round-trip (only delivery is); `renewal-evidence-mode` forbids speculative renewal backlog; renewal content crosses ownership. Renewal = a Slice-2 candidate only once the primitive is proven AND a real renewal exposes the need AND the signing callback is proven like delivery now is.

## Multi-agent story (the engine is the conductor; no new mechanism)
1. **Plan — dispatch-route (BUILT):** resolves owner/skill/KU per step; a DEFINITION is dispatch-route plan-shaped. The engine RUNS what dispatch-route plans (no parallel planner).
2. **Run — the engine (v1):** leases, runs, checkpoints, advances/blocks, recovers. **An agent invocation is just an await-callback step whose "other system" is an agent runner that posts a result back — identical mechanics to the PLOS callback.**
3. **Execute — capabilities/agents (BUILT discovery):** a step's work is a discovered capability (capability-route/invoke) or an agent (agent-route); the engine only needs the step to complete in-tick or call back. Catalog = orchestra; engine = conductor.
4. **Complete — callbacks (v1):** durable correlation means an agent can take minutes or crash-retry without the workflow losing its place.
Jarvis sits ON this: intent → dispatch-route plans → engine runs the durable workflow → capabilities/agents execute → callbacks complete → outbox→/v1/events makes every transition observable to The Room (which owns ranking). The V6 North-Star screen is a straight read of `workflow_run`/`workflow_step` + emitted facts. The §11 C6 boundary keeps autonomy safe: emit-only/idempotent/await-callback run unattended; irreversible (issue a number, move money, send directly) stays `blocked` for a human.

## Sequencing · risks · founder-gated
**Sequencing:** (1) PRECONDITION — the comms go-live completes as the proof's real backing (prod deploy of events/deliveries APIs, tokens, PLOS mailbox OAuth consent, the now-fixed Phase-0 double-send); v1 builds + proves off-prod in parallel on the Slice-0 harness, but its PROD proof waits on go-live. (2) v1 build off-prod = N1–N4 + the race/duplicate/crash adversarial proofs (author≠verifier). (3) §11 mini-review of this scope before code (board may fold into accepting this rec). (4) prod proof: run `invoice-send` once, founder-observed. (5) Slice-2 candidates (each its own decision). (6) promote to DOS + vendor via os-inherit once proven in Admin.
**Risks:** R1 over-build (HIGH) → 4-addition scope + explicit deferrals + no-DSL/no-callback-router-on-N=1. R2 real-requirement-now (the sequencing gate) → invoice-send real + proven infra. R3 callback race/dup/crash (MED) → record-then-advance + tick-checks-before-block + CAS + blocked-holds-no-lease. R4 serverless tick latency (ECR-0005) → on-demand tick after enqueue/callback; blocked runs cost nothing. R5 outbox growth → prune tick before volume. R6 coupling to an unproven callback (HIGH if ignored) → v1 proves ONLY on deliveries. R7 building renewal/lead-to-contract CONTENT in Admin (HIGH if ignored) → v1 = the PRIMITIVE only.
**Founder-gated:** the comms go-live (gates v1's prod proof, not its off-prod build); wiring the engine to prod / any gate (unwired until "go"); promotion + vendoring to PLOS (post-V6, past N=1); any renewal workflow (renewal-evidence-mode, event-triggered).

**Built ≠ Adopted:** Workflow Engine v1 is real only when `invoice-send` runs a durable cross-system workflow that BLOCKS on the delivery callback and RESUMES to terminal with the race/duplicate/crash cases proven — not because this doc exists.
