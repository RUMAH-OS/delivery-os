# Delivery OS — Durable Execution Engine (DESIGN, DRAFT)

> **DESIGN-ONLY.** No code, no migration, no manifest edits in this pass. This document goes to a
> §11 panel before a single line is written — a substrate this consequential is not built unreviewed.
> Authored by lead-architect; **NOT self-certified** (queued for author≠verifier).
>
> **Anchors (read + reused, not re-litigated):**
> - PHASE-2-EXECUTION-LAYER-READINESS-2026-06-18.md — the evidence-based inventory. Headline: COMPLETE
>   governance+routing, NO execution ENGINE; only created→closed (slice) + pending→verified (verify) states
>   persist; synchronous, human-driven; no async runner / auto-retry / resume / escalation.
> - EXECUTION-LAYER-LEDGER-2026-06-18.md — Scope 5 (durable state machine) + Scope 6 (auto-recovery) = the
>   two GAP-NEEDS-BUILD (LARGE) rows. This doc is the design for exactly those two rows.
> - CAPABILITY-LIFECYCLE.md — the engine is canonical DOS, propagated via os-inherit; Admin is the proving
>   ground (PLOS receives maturity, never discovery).
> - ECR-0005 (infra plane): Admin = serverless Vercel + Supabase; pgmq + pg_cron is the ecosystem default
>   async; BullMQ is PLOS-only (Hetzner). The engine MUST fit the serverless plane for Admin.
> - The existing event substrate: transactional outbox (src/db/schema.ts:253) + GET /v1/events cursor drain
>   (src/events-api.ts) — durable, µs-ordered, replayable, at-least-once. The engine rides this.
> - dispatch-route (now DOS-canonical, header flipped — verified on disk) = the orchestration PLANNER. The
>   engine RUNS what dispatch-route plans. No parallel planner.
> - The 9 gates incl. workflow-gate / lifecycle-gate = the transition validators the engine calls.

---

## 0. Framing — what is and is NOT being designed

The readiness review was explicit: the durable engine is the largest gap and the lowest-priority one, and
building it speculatively is the biggest risk on the board (anchor sec8, sec9-DEFER). The founder has now
made the call to build it to prove success criteria #1 (workflow execution), #4 (state persistence), #5
(recovery). This design therefore exists to make that build as small, additive, and reversible as possible,
riding maximally on what exists — NOT to maximize engine surface.

Design oath: every new piece must justify why an existing piece (outbox, dispatch-route, a gate, os-inherit)
cannot already do the job. The default answer is reuse; new is the exception that must be argued. See the
Reuse Map (§7) for the audited split.

The honest serverless tension up front (ECR-0005): Admin has no long-running worker. A runner on Vercel is a
function with a wall-clock limit that dies between invocations. So the engine cannot be a daemon that holds a
workflow in memory. The design resolves this by making the engine stateless + tick-driven: all liveness
lives in Postgres rows; a short, idempotent tick advances ready work and exits; pg_cron (the ECR-0005
default) calls the tick on a schedule; pgmq provides the visibility-timeout lease that makes resume-after-
interruption a property of the database, not of a process. This is the central architectural commitment and
the thing the §11 panel must stress-test hardest.

---

## 1. The 7-state machine

### 1.1 States (exact) and what they mean

| State | Kind | Meaning | Entered when |
|---|---|---|---|
| queued | initial | a workflow run exists; not yet planned | enqueue(def, input) writes the run + its steps |
| planned | live | dispatch-route produced the step plan (owners/skills/KUs resolved); steps materialized | the tick calls dispatch-route on a queued run |
| executing | live | a step is leased and actively running (a tick is advancing it) | a tick leases the next ready step of a planned/executing run |
| blocked | live (waiting) | run paused on an external/human dependency (gate said human-gated, an escalation, a peer-obligation, a wait-for-event) | a step yields blocked (--force needed, founder approval, awaiting a drain callback) |
| completed | TERMINAL (success) | all steps reached terminal-success; final event emitted | last step completes |
| failed | TERMINAL (failure) | a step exhausted retries OR hit a non-retryable error AND escalation did not resolve it; dead-lettered | retries exhausted / non-retryable / escalation timed out |
| recovered | TERMINAL (success-after-failure) | a run that was failed/interrupted later completed via auto-retry or resume-from-checkpoint | a retried/resumed run reaches success having previously been failed or interrupted |

recovered is deliberately a distinct terminal success (not folded into completed) so criterion #5 is
observable: the founder can SEE that resilience actually fired, not infer it. It is the proof state.

### 1.2 Allowed transitions (the only legal edges)

```
queued    -> planned       (dispatch-route planned the run)
queued    -> failed        (planning itself failed, non-retryable)
planned   -> executing     (a step leased)
executing -> executing     (next step leased; multi-step progress)
executing -> blocked       (step yields: human/gate/wait dependency)
executing -> completed     (all steps done, never previously failed/interrupted)
executing -> failed        (retries exhausted / non-retryable / escalation timeout)
blocked   -> executing     (dependency satisfied: approval, callback, timer)
blocked   -> failed        (escalation SLA expired with no resolution)
failed    -> executing     (auto-retry or manual resume re-leases — run is now recovering)
executing -> recovered     (a run that was previously failed/interrupted completes)
```

Terminal states (completed, failed, recovered) have no outbound edges EXCEPT the one explicit recovery edge
failed -> executing. That single edge makes failed non-final-by-default and is the mechanical heart of
criterion #5. Every transition is gate-checked (§1.4) and emitted to the outbox (§5). No transition is legal
except those listed — the engine refuses unknown edges (fail-closed, consistent with the 9 gates).

### 1.3 Mapping to existing vocabulary (no parallel vocab)

| Engine concept | Existing concept it maps to | Note |
|---|---|---|
| workflow run | a slice / objective instance | the live, multi-step form of what a slice records statically (docs/slices/*.md, today only status:closed) |
| workflow definition | dispatch-route plan shape + ownership-policy work-types | the static recipe; dispatch-route resolves owners/skills/KUs per step exactly as today |
| step | one dispatch (one dispatch-log row) | a step is ~ one dispatch-route spawn; the engine persists what dispatch-log records append-only today |
| step owner/skill/KU | agent-route / skill-route / knowledge-route outputs | unchanged — the engine stores what the routers already compute |
| transition validation | the 9 gates (workflow-gate, lifecycle-gate) | unchanged — gates are the transition guards |
| state change event | an outbox row | unchanged substrate; new event types only |

So the 7 states extend the existing 2-state record (created→closed, pending→verified) into a live machine,
rather than forking a second lifecycle list (the Capability Lifecycle forbids a third list).

### 1.4 Gate-checked transitions
- planned -> executing and executing -> completed: lifecycle-gate (build->reachable->continuable) where the
  step produces a surface.
- executing -> completed / executing -> recovered for cross-repo work: workflow-gate (fullyProven — today
  returns false on unmet peer obligations; a run with an open peer obligation goes to blocked, not completed
  — the engine honors the gate, never bypasses it).
- a step needing --force / human approval => executing -> blocked (the engine never auto-forces; the escape
  hatch stays human-logged, per ledger Scope 6).

The engine adds no new gate. It is a consumer of the gate layer.

---

## 2. Persistence model (durable, additive, reversible)

Decision: a new, small workflow_run + workflow_step table pair — NOT outbox-as-state, and NOT
slice-frontmatter. Rationale, argued against the alternatives:

- Why not outbox-as-state? The outbox is an append-only event log (facts that happened, immutable,
  replayable). Live execution state is mutable current truth (a row whose state changes queued->executing).
  Conflating them either makes the outbox mutable (destroying the replay/immutability the seam depends on —
  same family as invoice-immutability-principle) or forces event-sourcing reconstruction on every tick
  (expensive; serverless ticks must be cheap). The outbox stays the event log; the new tables are the state
  projection. This mirrors the ratified Admin↔PLOS hybrid: events for deltas + a read model for current
  truth (admin-plos-hybrid-integration.md). The engine is that pattern applied internally.
- Why not slice-frontmatter? Markdown frontmatter is not transactional, not concurrently-safe, and cannot be
  leased. It stays the static record of a closed slice; the new tables are the live machine.

### 2.1 Schema (additive; describe-only, no DDL here)

workflow_run: id uuid pk · definition_key text (which recipe; per-project def) · state text (one of the 7,
CHECK-constrained, fail-closed) · input jsonb (data-minimised IDs/refs, NOT PII dumps — outbox discipline) ·
idempotency_key text unique (a re-enqueue with the same key is a no-op — outbox id-idempotency lifted to the
run level) · attempt int · was_interrupted boolean (set when a lease expires mid-step; drives recovered vs
completed) · blocked_reason text null · escalation_due_at timestamptz null · created_at · updated_at ·
terminal_at timestamptz null.

workflow_step: id uuid pk · run_id fk -> workflow_run · seq int · state text (ready|leased|done|failed|
blocked, rolls up to the run) · step_type/owner/skill/ku (exactly the dispatch-route outputs) · lease_until
timestamptz null + lease_token uuid null (the visibility-timeout lease, §3) · attempt int · max_attempts int
· next_retry_at timestamptz null (backoff) · checkpoint jsonb null (resumable progress marker) · result
jsonb null · error jsonb null · created_at · updated_at.

Reversibility: both tables are purely additive (new tables; no change to any existing table; outbox/slice
records untouched). Drop-to-revert is clean. The consumedAt column reserved on outbox is NOT touched (it
belongs to the separate event-lifecycle gap, ledger Scope 3).

Survives restart/interruption: all liveness is in these rows + the lease columns. A process death mid-step
leaves a leased step with a future lease_until; when it expires the next tick re-leases it (and sets
was_interrupted=true) — resume is a database property, not a process property.

---

## 3. Async runner (honest about serverless)

### 3.1 The runtime reality (ECR-0005)
Admin is serverless (Vercel functions + Supabase Postgres). No long-running worker process; no in-memory
queue across invocations. So the engine is NOT a daemon. It is:

```
a stateless, idempotent TICK function + a database-resident lease/queue + a pg_cron schedule
```

Honest about the constraint: async runner here means scheduled, checkpointed, lease-based advancement, not a
persistent event loop. BullMQ is NOT used in Admin (PLOS-only/Hetzner per ECR-0005); proposing BullMQ for
Admin would violate the infra plane.

### 3.2 The mechanism: pgmq + pg_cron (the ECR-0005 default async)
- pgmq gives the queue a visibility-timeout lease: read makes a message invisible for N seconds; if not
  deleted (acked) within N it reappears. This is the off-the-shelf primitive that gives resume-after-
  interruption for free, in the database, with no worker. Each ready step (or run needing a tick) is a pgmq
  message keyed by run_id/step_id.
- pg_cron invokes the tick on a schedule (e.g. every 30–60s) — the heartbeat that replaces the missing
  daemon on a serverless plane. pg_cron runs inside Postgres, survives function cold-starts, needs no
  always-on compute.
- The tick (a Vercel function, also invokable on-demand right after enqueue for low latency):
  1. read up to K ready messages from pgmq (leases via visibility timeout).
  2. for each: load run/step, run the gate check, advance one transition, write the new state + a
     checkpoint, and emit the state-change event to the outbox in the SAME DB transaction as the state write
     (transactional outbox — the existing pattern, src/db/schema.ts:253).
  3. delete (ack) the message on success; on transient failure leave it (visibility timeout re-delivers =>
     automatic retry); schedule next_retry_at with backoff.
  4. exit within the function wall-clock limit. Long work is chunked across ticks via checkpoint, never held
     in one invocation.

### 3.3 Checkpoint / resume
A step persists checkpoint jsonb after each unit of progress. If the function dies (timeout, deploy, crash)
mid-step, the lease expires, the message reappears, the next tick re-reads it, loads the checkpoint, and
continues. was_interrupted flips true, so the run finishes in recovered, not completed — making the resume
visible. No work lost, no double-commit: every transition is idempotent on (run_id, seq, attempt) and the
outbox emit is idempotent on its own row id (the existing id-idempotency).

### 3.4 Why this is small
~one tick function + pgmq/pg_cron wiring (both Supabase extensions, no new infra). No new transport (rides
pgmq, the ECR-0005 default) and no new event bus (rides the outbox).

---

## 4. Recovery / resilience

- Auto-retry: step attempt < max_attempts => on transient failure set next_retry_at = now + backoff(attempt)
  with jitter; pgmq re-delivery + the cron tick re-lease executes it; max_attempts per step-type. Reuses the
  pgmq visibility timeout + the tick.
- Idempotency: run-level idempotency_key (no duplicate runs); step transitions idempotent on
  (run_id,seq,attempt); outbox emit idempotent on row id. A retried step that already partially-committed
  resumes from checkpoint, never re-does committed sub-work. Reuses the outbox id-idempotency.
- recovered state: the distinct terminal-success reached if a run ever entered failed or was_interrupted
  before completing. The proof of criterion #5.
- Escalation: when attempt == max_attempts (transient) OR a non-retryable error OR a blocked run exceeds
  escalation_due_at, the engine emits workflow.escalated to the outbox and sets blocked with blocked_reason.
  Surfaced on the in-flight view (§5) and, via the outbox->/v1/events seam, to The Room/PLOS which owns
  attention/inbox (NOT Admin — admin-truth-source-boundary.md: Admin emits the fact, PLOS ranks it). The
  founder sees it on the execution-ledger live view.
- Dead-letter: a run that exhausts retries AND whose escalation SLA expires -> failed (terminal), with full
  error + last checkpoint retained for forensic replay. No silent drop; a workflow.failed event is emitted.
  (Optionally a workflow_dead_letter VIEW over failed runs — a view, not a new table.)

The engine never auto-forces a gate. A transition a gate refuses goes to blocked and waits for a
human-logged --force or an approval — the escape hatch stays preventive + logged (ledger Scope 6).

---

## 5. Observability hooks (the founder can SEE state)

- Every transition emits an outbox event in the same transaction as the state write. New event types
  (additive to the events catalog — keep the catalog-comment in sync per ledger secC.2): workflow.queued,
  workflow.planned, workflow.step.started, workflow.blocked, workflow.escalated, workflow.completed,
  workflow.failed, workflow.recovered. These ride the existing GET /v1/events drain unchanged — PLOS/The
  Room consume them like any other event.
- In-flight live view (the missing piece, ledger Scope 7 GAP): current truth lives in workflow_run/
  workflow_step, so a live view is a straight read of those tables — this is what finally lets
  execution-ledger.html show running objectives, not only closed ones. The 8-question founder screen gains a
  live section: per run -> current state, current step + owner, attempt count, last checkpoint time,
  blocked/escalation reason. Satisfies the V6 North Star (founder can SEE workflow state in <=2 min) for
  in-flight work.
- Strict boundary: Admin only surfaces FACTS (run state, step, owner, error). All ranking/attention/inbox/
  severity stays in The Room/PLOS (admin-truth-source-boundary.md). The engine builds no opinionated
  dashboard; it exposes the state + emits the events, and The Room decides what deserves the founder's
  attention.

---

## 6. Canonical ownership + consumption

- The engine TOOL is DOS-canonical: single-authored in delivery-os/templates/tools/ (the tick function +
  the lease/queue helpers + the state-machine validator), vendored per project via os-inherit, sha-pinned in
  each project INHERITED.json, drift-gated — the identical mechanic that produced the 10 pinned files and
  just promoted dispatch-route (ledger secB.0). Owner: lead-architect (state machine + runner);
  transition-validation defers to the gate owners.
- Per-project DATA stays per-project (the established gate pattern — seam-gate is canonical yet reads Admin's
  own contract): the workflow_run/workflow_step tables and rows live in each project's own Postgres; the
  workflow DEFINITIONS (definition_key recipes) are per-project config. Only the engine TOOL travels. No
  execution state crosses a repo boundary.
- Consumption: Admin is THE proving ground (CAPABILITY-LIFECYCLE — built/used/matured here first). PLOS
  receives the engine via os-inherit ONLY after Built->Verified->Used-in-Admin->behavior-proven->in-OS.
  PLOS, on Hetzner, MAY back the same engine contract with BullMQ as its lease/queue impl behind the
  identical state-machine interface (the tool's queue layer is an adapter: pgmq for the serverless plane,
  BullMQ for PLOS — same states, same events, same tables). Rumah/future projects inherit the mature engine
  by running the sync.
- TOOL vs DEFINITION vs DATA (the clean split): TOOL = canonical state machine + runner + queue adapter
  (DOS-owned). DEFINITION = per-project workflow recipes (project config). DATA = run/step rows + outbox
  events (per-project Postgres). Mirrors how dispatch-route is the tool while ownership-policy + dispatch-log
  are per-project.

---

## 7. Reuse map — builds-ON vs genuinely-NEW

| Concern | Built ON (reuse, do NOT rebuild) | Genuinely NEW |
|---|---|---|
| Event transport | transactional outbox + GET /v1/events drain (durable, µs-ordered, replayable, at-least-once) | only new event types (workflow.*) — additive to the catalog |
| Orchestration planning | dispatch-route (canonical) + agent/skill/knowledge-route + ownership-policy | nothing — the engine calls the planner |
| Transition validation | the 9 gates: workflow-gate, lifecycle-gate (+ others where relevant) | nothing — the engine consumes gates |
| Async transport | pgmq + pg_cron (ECR-0005 default) | the tick function + lease/queue wiring (small) |
| Idempotency | outbox row-id idempotency (lifted to run/step level) | the run-level idempotency_key (small) |
| Distribution | os-inherit (vendored, sha-pinned, drift-gated) — proven byte-current | nothing — same mechanic |
| Observability surface | execution-ledger.html (8-Q founder screen) | a live in-flight section reading the new tables (the Scope 7 GAP) |
| Truth/attention boundary | admin-truth-source-boundary + the outbox->PLOS seam | nothing — Admin emits facts; The Room ranks |
| Durable state | — | the workflow_run + workflow_step tables + the 7-state machine validator (the core new build, ledger Scope 5/6 GAP) |

The genuinely-new surface is just three things: (1) the two state tables + the state-machine validator; (2)
the tick function + pgmq/pg_cron lease wiring; (3) the live section on the existing ledger screen.
Everything else is reuse. This is the minimum that can satisfy #1/#4/#5.

---

## 8. Build sequencing — smallest first proof slice, then increments

### Slice 0 — the proof slice (smallest thing that proves #1 + #4 + #5)
Goal: one durable, multi-step workflow runs queued->planned->executing->completed with state persisted
across a process restart, AND one injected interruption produces a recovered terminal state.
- Pick the simplest real multi-step Admin workflow as the first DEFINITION — candidate: lead-to-contract
  (the founder's stated generalize-first target in capability-completeness-standard), OR an even thinner
  internal one (e.g. a 2-step invoice-prep run) to de-risk before a product workflow.
- Build: the 2 tables + the state-machine validator (refuses illegal edges); the tick function reading one
  pgmq queue; transactional outbox emit per transition; pg_cron schedule.
- Reuse: dispatch-route to plan the steps; lifecycle-gate on the surface-producing step; outbox + drain
  unchanged.
- Prove #4: kill the function mid-step -> next tick resumes from checkpoint, no lost/duplicated work.
- Prove #5: the resumed run lands in recovered (not completed); a forced transient failure auto-retries with
  backoff then recovers.
- Prove #1: the run reaches a terminal state unattended (the founder did not hand-drive each step).
- Observe: the run is visible live on execution-ledger throughout.

### Slice 1 — escalation + dead-letter
Add blocked/escalation (SLA + workflow.escalated), max-attempts dead-letter (failed terminal with retained
forensic state), human-force-to-unblock (logged, no auto-force).

### Slice 2 — the gate-honoring path
Wire workflow-gate fullyProven so a run with an open peer obligation goes blocked, not completed. (This
threads into the cross-project proof, but that proof itself stays FOUNDER-GATED on unfreezing a 2nd consumer
— out of this engine's scope, per the readiness review.)

### Slice 3 — promote + generalize (Waterline)
Once proven in Admin on >=1 real workflow: vendor the engine TOOL to delivery-os/templates/tools/, bind in
os-foundation.manifest.json, sha-pin, drift-gate (the secB.0 ritual). Keep the queue layer an adapter (pgmq
for serverless, BullMQ for PLOS) so the state machine + tables + events stay variant-neutral — resist
generalizing the queue beyond the two real backends (Waterline Rule).

### Risks + OPEN QUESTIONS for the §11 panel
1. Is the engine even the right next build? The readiness review ranked it largest + lowest-priority and
   called speculative construction the top risk. The founder chose to build it. §11 should confirm a REAL
   unattended-multi-step requirement NOW (not someday) justifies #1/#4/#5 over the higher-leverage
   distribution/cross-project work (Waves 1–4 of the ledger). SEQUENCING GATE.
2. Serverless tick latency vs. execution. A pg_cron 30–60s heartbeat means worst-case ~1 min/step between
   ticks (an on-demand tick after enqueue mitigates the first step). Is tick-driven advancement genuinely
   workflow execution for the founder's intent, or does the intent imply sub-second stepping the serverless
   plane cannot give without violating ECR-0005? HONEST CONSTRAINT TO RATIFY.
3. pgmq dependency vs. SKIP LOCKED. pgmq is a Supabase extension. Acceptable, vs. a hand-rolled SELECT ...
   FOR UPDATE SKIP LOCKED lease on the step table (no extension, slightly more code, one fewer dependency)?
   Trade-off: pgmq = less code + battle-tested visibility timeout; SKIP LOCKED = zero new extension + full
   control. ARCHITECTURE CHOICE TO SETTLE.
4. Two queue backends = two code paths. The pgmq/BullMQ adapter keeps the state machine neutral but the
   resilience behavior is only PROVEN on the pgmq path in Admin; the BullMQ path is unproven until PLOS
   inherits. Premature generalization, or the right Waterline seam? WATERLINE CALL.
5. Definition format. Workflow definitions are new per-project config. What schema — and does it risk
   becoming a third lifecycle/DSL the OS must maintain? Must reuse dispatch-route's plan shape, not invent a
   workflow DSL. SCOPE-CREEP GUARD.
6. Outbox growth. The engine multiplies outbox volume (>=7 events/run). The event-lifecycle gap
   (retention/ack, ledger Scope 3) is currently deferred — does the engine force that gap to close sooner?
   DEPENDENCY TO SURFACE.
7. Recovery semantics edge cases. A non-idempotent side effect inside a step (e.g. an external email send)
   that partially committed before a crash — the checkpoint must bracket side effects. But Admin's comms
   boundary says Admin emits events and PLOS executes comms (comms-contact-canonical-architecture). Does
   that boundary make most Admin steps naturally idempotent (emit-only)? Likely yes — worth ratifying as a
   design assumption that REDUCES recovery complexity. ASSUMPTION TO CONFIRM.

---

> Status: DRAFT, lead-architect. NOT self-certified. Goes to §11 (principle-11-review) before any code. An
> independent verifier must confirm: (a) the design rides the existing outbox/dispatch-route/gates/os-inherit
> and adds only the three new surfaces named in §7; (b) it honors ECR-0005 (serverless Admin = pgmq/pg_cron,
> no long-running worker; BullMQ PLOS-only); (c) it forks no parallel event bus, no parallel planner, and no
> third lifecycle list; (d) every table is additive + reversible.
> Built != Adopted: this engine is real only when Slice 0 runs a durable workflow through the states with a
> proven recovery — not because this doc exists.
