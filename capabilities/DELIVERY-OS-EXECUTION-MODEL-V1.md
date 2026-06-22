# Delivery OS Execution Model v1 - the minimum that powers BOTH state and communication (DESIGN-ONLY)

> CONSOLIDATES, and SUPERSEDES as the single index, two prior board docs:
> WORKFLOW-ENGINE-V1-BOARD-REVIEW.md (the await-callback primitive, proven on invoice-send) and
> MAILBOX-INTELLIGENCE-MULTIAGENT-V1.md (the multi-agent pipeline + its emergent R1-R6). Anti-fragmentation:
> this is now the ONE execution-model doc; the two priors are kept as the cited derivations, not maintained in
> parallel. If they disagree with this doc, fix the prior to point here.
>
> Founder directive, verbatim intent: I do not want an invoice engine. I do not want a mailbox engine. I want
> the minimum Delivery OS execution model that can power both. This doc is built FROM two already-validated
> domains, not from either alone - the cross-domain reduction IS the proof the model is shared, not an
> abstraction. DESIGN-ONLY: no build, no scripts, no wiring. Board call.

---

## 0. The thesis (and the verdict)

Thesis: both domains reduce to ONE core primitive - a durable step that BLOCKS on a correlation key and
RESUMES when a matching callback arrives, where the callback SOURCE is pluggable (system-callback /
agent-result / timer-wake / domain-event / human-response). Everything else (the durable run, the in-process
step, the branch selector) is small scaffolding around that one primitive.

Verdict: the thesis HOLDS for the two domains, with ONE honest exception pushed OUT of the engine. Four
named flows - delivery-confirmation (Admin), intent-classification (PLOS), payment-follow-up timer (Admin),
human-reply (PLOS) - are the SAME block/resume primitive with different sources (sec 7). The exception that
does NOT fit the engine is branch-on-LLM-classification quality (the decision content + its evals): that is
real, hard, domain-owned work that must live in the PLOS agent, NOT in the engine. The engine only needs the
result of a classification to pick a next step (a deterministic branch selector); it must never absorb the
classifier or its evals (sec 6, sec 9 over-build guard).

This is the intersection of two PROVEN flows (the invoice-delivery round-trip; the Slice-0 durable machine),
not a speculative platform. The state machine ALREADY declares the target edge
[blocked,executing] // dependency satisfied (approval, callback, timer) (src/engine/state-machine.ts L36)
- the engine ANTICIPATED the pluggable source; v1 only wires the sources into that one proven edge.

---

## 1. Model 1 - Shared workflow primitives (reduce ruthlessly)

Only primitives BOTH domains exercise. Each tagged PROVEN (reuse as-is) / NET-NEW.

| # | Primitive | What it is | Both domains exercise it? | PROVEN vs NET-NEW |
|---|---|---|---|---|
| P1 | Durable run + steps (7-state machine, SKIP-LOCKED tick, CAS lease, recovery) | the run record + its ordered steps + the unattended tick that advances/blocks/recovers them | YES - invoice flow IS a run; mailbox flow IS a run | PROVEN - Slice 0 (VERIFY-execution-engine-slice0.md): #1 unattended-terminal, #4 kill-and-resume, #5 forced-failure->recovered, CAS, trigger+RLS, golden-master cage. Reuse verbatim. |
| P2 | In-process step | a step that completes within one tick (no external dependency); emit-only / idempotent runs unattended | YES - invoice record-outcome; mailbox Contract-Agent seam READ | PROVEN - Slice-0 in-process handlers + the emit-only / irreversible-blocks discipline (C6). Reuse. |
| P3 | The ONE await step - block-on-correlation with a pluggable source | emits a request/task, drives executing->blocked, holds NO lease, resumes only when a callback whose correlation key matches arrives. Source is a field: system-callback / agent-result / timer / domain-event / human-response | YES - every wait in both domains is one of these | MIXED. The block/resume EDGE + the system-callback source are PROVEN (VERIFY-invoice-delivery-status.md round-trip + Slice-0 edges). The other four sources are NET-NEW but are the SAME edge with a different writer of the callback. Deepest net-new = agent-result and human-response (sec 9). |
| P4 | Branch / next-selector | the definition picks the next step seq from the prior step result (class=noise->terminate; category=dunning->dunning sub-path). NOT a DSL. | YES - invoice: delivered->settle vs failed->retry-or-escalate; mailbox: the classification branch | NET-NEW (small). Slice 0 runs sequential steps only. A pure data-driven next-selector over a step result. No new state, no language. |

That is the entire model: P1 + P2 + P3 + P4. P1/P2 are proven; P3 is one proven edge made source-pluggable;
P4 is a small selector. There is no P5. We resist (Waterline, N=1): no callback ROUTER, no generic effect
registry, no SLA/dead-letter engine, no parallel fan-out, no DSL - none of those is exercised by BOTH domains
in v1 (sec 8 deferred).

---

## 2. Model 2 - Agent ownership (who EXECUTES each step)

The engine is repo-agnostic and never spawns. It owns the durable run; it does not own the work inside a step.
Step executors sit BEHIND the await primitive.

| Layer | Owns | In this model |
|---|---|---|
| DOS / engine | the durable run, the steps, the block/resume edge, the tick, recovery, the completer | runs the run; for an await step it emits a task + BLOCKS; never executes domain logic and never spawns an agent |
| Admin | System-of-Record STATE steps (contract/invoice state read via /v1/ops; emit state facts like payment.observed) | executes P2 in-process state steps + emits-and-awaits where a fact needs an Admin ack. Never PII; never money unattended (C6) |
| PLOS | communication + the LLM capability/agent steps (classification, intent, contact-resolution, comms draft/send) | executes the agent-result and system-callback (send) sources; posts callbacks back to the engine |
| human | every irreversible decision (approve a send, issue a number, move money) | executes the human-response / human-decision source via a human-callback (sec 5) |

Step executor contract (uniform): emit-task -> bounded runner executes -> posts a callback. The engine emits a
task to the outbox; a bounded runner (Admin handler, PLOS agent runner, a timer, or a human via the UI) does
the work and POSTs the result to the ONE completer (sec 3). The engine resumes. This is identical for all
sources - the only difference is who writes the callback.

The G9 ceiling is binding and is WHY this works. Per G9-DISPATCH-RUNNER-ARCHITECTURE.md: only the main loop
(Claude) spawns subagents; dispatch-route PLANS, it does not spawn (dispatch-route.capability.json: Plans, does
not spawn - honest V6 ceiling). So agent-result v1 is NOT the engine autonomously spawning a Claude subagent.
It is: the engine emits an agent-task that a bounded PLOS agent runner (or, interim, a founder-/Claude-driven
dispatch) executes and posts back. The engine emits a task + awaits - it never self-spawns. This is the
load-bearing scoping decision and the deepest net-new risk (sec 9).

How dispatch-route plans ownership per step. A workflow DEFINITION is dispatch-route plan-shaped (Slice-0 C7):
for each step, dispatch-route resolves the owner (ownership-policy wins; route explains), the agent, and the
skills+knowledge to inject, and emits the DispatchPlan + spawnPrompt. The engine RUNS that plan - it does not
re-decide ownership. dispatch-route is the PLANNER; the engine is the durable RUNNER of the plan; the executors
are the orchestra. No second planner, no new mechanism.

---

## 3. Model 3 - The ONE callback contract (all sources post here)

There is exactly ONE completer. The proven /v1/deliveries completer is GENERALIZED - same shape, same
in-txn/idempotent/CAS discipline - so every source posts to the same place.

Correlation key. A waiting step is identified by (runId, seq) materialized as a single
workflow_step.awaiting_event_id (the request event id). The inbound callback carries that id. (Net-new = one
column + index on the step table, exactly the prior N2 design - no new table.)

The callback contract (uniform across all sources):

    awaitingEventId : evt_...        (the correlation key = the request event id; equals runId+seq)
    source          : system-callback | agent-result | timer | domain-event | human-response
    result          : source-specific payload (deliveryOutcome | agentResult | empty-for-timer | event | humanDecision)
    status          : ok | failed    (did the awaited work succeed? drives the P4 branch)
    idempotencyKey  : ...            (dedup key; a duplicate post is a no-op)

Completer properties (all PROVEN on the delivery case; generalized, not redesigned):
- In-transaction + idempotent. The completer runs in the SAME txn that records the result (the proven
  deliveries-api pattern: append-only insert + advance). A duplicate callback is a no-op on idempotencyKey.
- CAS-guarded. It advances the step only WHERE awaiting_event_id = mine AND state = blocked - losing the CAS
  means someone already completed it (race-safe, the proven Slice-0 write-back discipline).
- Callback-before-block race handled (proven design): the tick checks for an already-arrived result before
  blocking (record-then-advance-if-waiting). A callback that beats the block is recorded and consumed when the
  step would block.
- Crash-while-blocked is trivial because a blocked step holds no lease (sec 4) - recovery re-reads state;
  nothing to un-stick.

The single most important generalization: today /v1/deliveries writes only the delivery outcome and (after
GAP-B) a read-only projection - it deliberately touches no workflow run (VERIFY-invoice-delivery-status.md
criterion 1: callback stance preserved, no mutation). v1 job is to add ONE thing: when an inbound callback
awaitingEventId matches a blocked step, the completer (in that same txn) advances it blocked->executing. Every
source posts the same body to the same completer; the source field only changes who wrote it.

---

## 4. Model 4 - The waiting state (one blocked state, different wake conditions)

A blocked step holds no lease (PROVEN, Slice-0 #4 - that is exactly why crash-while-blocked is trivial). A
blocked step is fully described by: source, awaiting_event_id (correlation), wake_at (optional), sla/timeout
(optional). There is ONE blocked state with TWO wake conditions, never two states:

| Wake condition | Mechanism | PROVEN vs NET-NEW |
|---|---|---|
| external-wait (system-callback, agent-result, domain-event, human-response) | an inbound POST to the completer (sec 3) drives blocked->executing | edge PROVEN; the four non-system sources are net-new WRITERS of the same edge |
| timer-wait (wake_at) | the already-running tick wakes runs whose wake_at is past and drives blocked->executing - the CLOCK is just another callback source | NET-NEW (small): one workflow_step.wake_at column + one tick clause. No scheduler service, no new state. |

Both are the SAME blocked state; the only difference is the wake condition. wake_at and awaiting_event_id can
coexist on one step (an external wait WITH an SLA timeout = resume on callback OR wake at T and escalate). v1
ships the bare timer-wake; full SLA/dead-letter is deferred (sec 8).

---

## 5. Model 5 - Human-in-the-loop (a human gate IS an await step)

A human gate is not a special mechanism - it is the P3 await step whose source is human-decision (approval:
yes/no) or human-input (a response/value). The human is just another bounded runner that posts a callback.

The invariant (Slice-0 C6, sec 11 C6): every irreversible action - send a message, move money, ISSUE a number
- ALWAYS routes through a human-gate await. The engine runs emit-only / idempotent steps unattended; it leaves
the run blocked for a human on anything irreversible (state-machine.ts L73: mirrors dispatch-route no-spawn
ceiling). Enforced by construction, not by reviewer memory.

The two domains human gates are the SAME primitive:
- Admin send-approval (the Communication step draft+approve, class B / D2): block on human-decision; the
  founder approves in the UI; the UI POSTs a human-callback (status ok); the proven send fires.
- PLOS human-reply (the mailbox reply the agent drafted): block on human-decision; same UI approval; same
  human-callback; the proven send port sends.

Both resolve via the SAME completer (sec 3) with source human-response. The engine never knows or cares that a
human (vs a system) wrote the callback - that is the whole elegance. The UI approval action is a thin POST to
the one completer.

---

## 6. Model 6 - The multi-agent execution path (end-to-end)

    trigger (inbound email / invoice-due / founder intent)
      -> dispatch-route PLANS the run (owner + agent + skills + knowledge per step; emits the definition)
      -> engine materializes the durable run (P1) and ticks
           for each step:
             in-process (P2)   -> completes in tick (emit-only / read seam)
             OR await (P3)     -> emit task to (Admin handler | PLOS agent runner | timer | human),
                                  drive executing->blocked, exit (NO lease held)
      -> executor does the work, POSTs the ONE callback (sec 3) with its source + result
      -> completer (in-txn, idempotent, CAS) matches awaiting_event_id, advances blocked->executing
      -> branch/next-selector (P4) picks the next step from the result
      -> ... loop until terminal (completed | failed | recovered)

- Recovery is via durable state (P1): a crash mid-pipeline resumes because blocked holds no lease and every
  transition is CAS-guarded (Slice-0 #4/#5). Honest new cases to prove: agent-callback-before-block; duplicate
  agent result; timer-fires-during-recovery (the prior rec R6 list).
- Observability is via the existing outbox -> /v1/events (PULL, ECR-0006): every transition is emitted; The
  Room consumes for ranking (Admin emits FACTS, never ranks - admin-truth-source-boundary).
- Jarvis / the V6 North-Star screen sit ON TOP: a straight read of workflow_run/workflow_step + emitted facts
  answers the 8 questions (what/who/why/skills+knowledge/verifier/pass/what-changed/complete). No new mechanism
  for the screen - it reads the run.
- The classifier exception (stays OUT of the engine). The LLM that decides class/intent and its evals are
  PLOS-owned step executors. The engine receives only result.category and runs P4. If the classifier is wrong,
  that is a PLOS eval problem, not an engine problem. Keeping the decision content out of the engine is what
  keeps the model the intersection of two flows and not an AI workflow platform.

---

## 7. BOTH domains mapped onto the model (the proof it is shared)

### 7a. Admin - invoice flow (state)

| Step | Primitive | Callback source | sync/async/wait/human |
|---|---|---|---|
| due/eligible trigger | (trigger) | - | starts the run |
| prepare invoice (draft, number NULL) | P2 in-process | - | sync (emit-only, Slice-0 proven) |
| request send | P3 await | system-callback (PLOS delivery) | async-wait - the PROVEN round-trip |
| founder approves send (irreversible) | P3 await | human-response | human gate (C6) |
| record delivery outcome | P2 in-process | - (consumes the callback) | sync |
| branch on outcome | P4 | - | delivered->settle ; failed->retry/escalate |
| payment follow-up (no payment by T+N) | P3 await | timer (wake_at) | async-wait - the timer source |
| (on wake) draft next reminder | back to request-send | system-callback again | loops via the same edge |

### 7b. PLOS - mailbox flow (communication)

| Step | Primitive | Callback source | sync/async/wait/human |
|---|---|---|---|
| inbound email | (trigger) | - | starts the run |
| classify (noise vs value, category) | P3 await | agent-result | async-wait (LLM agent runner) |
| branch on class | P4 | - | noise->terminate ; dunning/deal->continue |
| infer intent | P3 await | agent-result | async-wait |
| resolve contact/tenant | P3 await | agent-result (graph) | async-wait |
| read Admin contract/invoice state | P2 in-process | - (/v1/ops seam read) | sync (PII-free) |
| draft reply (LLM) | P2 in-process | - | sync (content only, no send) |
| founder approves reply (irreversible) | P3 await | human-response | human gate (C6) |
| send reply | P3 await | system-callback (delivery) | async-wait - the SAME proven send round-trip |
| follow-up (no reply by T+N) | P3 await | timer (wake_at) | async-wait |

Verdict on does the one model power both?: YES. Both flows are entirely P1/P2/P3/P4. Every wait in both is the
SAME executing->blocked / blocked->executing edge; the ONLY variable is the callback source. The four named
flows prove it: delivery-confirmation = system-callback; intent-classification = agent-result; payment-follow-up
= timer; human-reply = human-response - same primitive, four sources. Notably the send round-trip is literally
shared: invoice-send and mailbox-reply both block on the same delivery system-callback. The model is the
intersection of the two, demonstrated.

What must stay OUT of the shared model (push to the domain):
- The LLM classifier/intent/contact intelligence + their EVALS -> PLOS. The engine takes the result, runs P4.
- Invoice numbering / money / balance -> Admin SoR, behind a human-gate await. The engine never issues.
- Mailbox read lane / DWD consent / send-scope / comms templates/cadence -> PLOS comms-execution.
- Ranking / attention / inbox / dashboards -> The Room (consumes events; never in the engine or Admin).
- PII -> never in the run state; tenantId-only across the seam (ADR-0003); bodies un-persisted.

---

## 8. The minimum v1 surface (proven vs net-new) + what is deferred

Reuse, do NOT rebuild (PROVEN):
- P1 durable run/steps/tick/CAS/recovery + golden-master cage (Slice 0).
- P2 in-process emit-only steps + the C6 irreversible-blocks discipline.
- The system-callback half of P3 - the emit->drain->send->/v1/deliveries->record round-trip, idempotent +
  PII-free (invoice-delivery verify).
- dispatch-route PLANNING; capability discovery; outbox -> /v1/events PULL transport (ECR-0006).

NET-NEW v1 (small, on top of Slice 0):
1. Pluggable-source await + the ONE completer - generalize /v1/deliveries to match awaiting_event_id and
   advance blocked->executing for ANY source; add workflow_step.awaiting_event_id (+ index). The system-callback
   source is proven; this opens the same edge to the other four.
2. Timer-wake source - workflow_step.wake_at + one tick clause (the clock as a callback source). NET-NEW.
3. agent-result source - the emit-agent-task + bounded-runner-posts-result wiring (the heart of multi-agent;
   the deepest net-new - sec 9).
4. human-response source - the UI approval action POSTs a human-callback to the same completer. NET-NEW (small)
   but gates every irreversible action.
5. P4 branch/next-selector - pick next seq from a step result. NET-NEW (small), no DSL.

Explicitly DEFERRED (Waterline - not exercised by both domains at N=1): a callback ROUTER for more than 2
callback types / a generic effect registry / full SLA / escalation / dead-letter (v1 = timer-wake + escalation
EMIT only) / parallel fan-out / a DSL / pgmq/BullMQ adapter (single SKIP-LOCKED backend, sec 11 C2) / any prod
wiring or gate enforcement (v1 stays off-prod behind the comms go-live, like Slice 0) / domain-event as a source
(designed as pluggable, but no v1 flow forces a non-delivery domain-event yet - add on first real need).

---

## 9. Sequencing / over-build guard / risks / founder-gated

Sequencing.
1. PRECONDITION - comms go-live is the proof real backing (prod deploy of events/deliveries APIs, tokens, PLOS
   mailbox OAuth consent, the resolved Phase-0 double-send). Without it the system-callback and the send half of
   both flows have no real backing. v1 BUILDS off-prod in parallel on the Slice-0 harness; its PROD proof waits
   on go-live.
2. Build off-prod: the 5 net-new pieces (sec 8) on the proven block/resume edge. No prod touched.
3. Agent evals (qa-test / agent-output evals) on Classification + Intent BEFORE they drive a live run - a
   misclassification silently mis-routes founder mail. The classifier stays OUT of the engine; its quality is a
   PLOS gate.
4. sec 11 mini-review of THIS scope before code (consequential: the pluggable-source contract, the agent-result
   shape, the cross-repo run boundary).
5. VALIDATE end-to-end + the recovery/race proofs (author not-equal verifier, as Slice 0 was): a real flow
   blocks on each source and resumes to terminal; crash at each block; duplicate-callback; callback-before-block;
   timer-fires-during-recovery.
6. GENERALIZE + promote: extract the engine from exactly what the two flows needed; DOS promotion + os-inherit
   vendoring gated post-V6 + past the N=1 master gate.

The over-build guard (load-bearing). This model is the INTERSECTION of two PROVEN flows, not an abstraction.
The guard: a primitive earns its place ONLY if BOTH the invoice flow AND the mailbox flow exercise it (sec 7
tables are the test). That is why there is no callback router, no effect registry, no SLA engine, no DSL in v1 -
neither pair of tables needs them. If a future proposal adds a primitive, it must show two domains exercising it
first (Waterline, N>=2). The engine is the residue of two real flows; it is never built ahead of them.

Risks (honest ledger).
- PROVEN (low risk): P1 state machine + tick + CAS + recovery; the system-callback round-trip; dispatch
  planning; the outbox transport.
- NET-NEW + HARD: agent-result (R-agent-runtime, HIGH) - PLOS agents are gesture-scoped pure functions and NO
  self-spawning runner exists (G9); v1 must be emit-task -> bounded-runner -> callback, never engine-spawns.
  Under-scoping this is the single most likely failure. human-response (MED) - small mechanism but it is the
  brake on every irreversible action; it must be unbypassable-by-construction (C6). Agent quality / evals (HIGH)
  - LLM decisions branch a real workflow + draft customer text; evals before live; every send stays human-gated.
  The timer (MED) - serverless tick latency (ECR-0005): on-demand tick after enqueue/callback; blocked runs cost
  nothing. Branch selector (LOW-MED) - keep it a pure selector, resist growing a DSL. Cross-repo run (MED) -
  first engine driving steps in another repo; reuse the proven PULL transport, no new transport.
- R-over-build (HIGH if unguarded) - mitigated by the intersection guard above + the deferred list (sec 8).

Founder-gated. The comms go-live (gates validation, not the off-prod build) / the agent-runtime posture for
agent-result (bounded runner + human gate vs anything more autonomous) / every irreversible action
(human-response gate: send, issue a number, move money - never autonomous) / the sec 11 acceptance of the
pluggable-source / agent-result / cross-repo boundary / promotion to DOS + vendoring to PLOS (post-V6, past
N=1).

---

## 10. Verified-loop / goal-oriented execution (the founder's "Loop Engineering" ask)

> Founder ask, distilled: make the org's OWN discipline a first-class RUNTIME pattern. Shift the agent model
> from Human -> Prompt Agent -> Result to Goal -> Agent -> Verify -> Retry/Improve -> Stop Condition. A
> loop = trigger + action + an OBJECTIVE stop condition. The VALUE is the verification + the objective (not
> subjective) done-criteria, NOT the step-execution. Every loop is hard-capped (runaway/cost guard). Maker-checker
> (a separate scorer/eval agent). "Most tasks don't need loops" - loops are OPT-IN where verification matters.
> EXCLUDED from v1 (transcript hype, not load-bearing): 24/7 agent fleets; a meta-agent that infers loops.
> DESIGN-ONLY. This section amends v1; it builds nothing.

### 10.0 This is the org's own DNA, generalized - not a new concept

Say it plainly: Delivery OS ALREADY runs maker-checker verified loops at the DEVELOPMENT level. Every slice is
build-agent -> independent verifier -> retry -> stop-when-verified, enforced by author!=verifier (CODEOWNERS),
the verify-gate skill + .claude/hooks/verify-gate.mjs, and the sec-11 multi-lens review for consequential
decisions. Slice 0 itself only counted as done when an INDEPENDENT verifier reproduced its criteria - that is a
verified loop with an objective stop (the criteria) and a hard cap (the gate blocks, it does not retry forever).
The founder's ask is to make that SAME loop - act, then an independent objective check, then retry-or-stop - a
first-class RUNTIME execution pattern for agents (Mailbox/Contact/Outreach/Jarvis), not just a development-time
discipline. We are generalizing our own dogfood, not importing an AI-workflow idea.

### 10.1 The six questions, answered honestly

1. Does P1-P4 naturally support Reason->Act->Verify->Repeat->Stop as first-class?
   PARTLY, mechanically - NOT first-class. P4 (branch/next-selector) plus a back-edge (a next-selector that
   picks an EARLIER seq) can mechanically express a loop: act -> verify -> branch(stop | retry-act). The state
   machine already permits arbitrary edges, so a cycle is allowed. BUT the model as written has: no first-class
   GOAL / objective stop-condition concept, no attempt counter or hard-cap (a back-edge with no bound is exactly
   a runaway), and no NAMED verify step (verification is just another step, indistinguishable from action).
   So as-is, P1-P4 is a step-executor that CAN cycle - it is not a first-class verified-loop. Shipping it as-is is
   precisely the rework the founder fears: you build the step-executor, then discover the value was the
   verification + stop + bound and have to retrofit them.

2. Smallest change now to avoid that rework?
   Keep the engine P1-P4 verbatim. Add only THREE things, two of them tiny engine fields:
   (a) an attempt counter + maxAttempts hard-cap carried on a looping step (runaway/cost guard - by
       construction, not by reviewer memory);
   (b) an OBJECTIVE stop-condition predicate that P4 evaluates over a verify RESULT (stop vs retry-back-edge);
   (c) confirm P4 supports a back-edge (cycle) - the state machine already allows the edge, so this is a
       selector capability, not new state.
   No new primitive, no P5. The loop is a COMPOSITION of existing pieces plus a bound and a predicate.

3. Verification loops as primitive vs capability vs pattern?
   - The LOOP is a workflow PATTERN layered on P1-P4: act step (P2/P3) + verify step (P3 agent-result, or P2
     in-process check) + bounded branch (P4 + maxAttempts + stop-predicate). It is not a primitive because it
     adds no new durable mechanism - it is wiring of P1-P4.
   - The VERIFIER is a reusable CAPABILITY (maker-checker / scorer / eval agent) registered in the capability
     catalog and reused across Mailbox / Contact / Outreach. One verifier capability, many loops.
   - The ONLY engine-level additions are the attempt-bound (one field + tick check) and the objective
     stop-predicate (evaluated by P4). Justification for NOT a new primitive: the over-build guard (sec 9) - a
     primitive earns its place only if BOTH domains exercise a NEW durable mechanism; the loop introduces none.
     Calling the loop a primitive would re-absorb verification + decision content into the engine, the exact
     anti-pattern sec 9 forbids. Loop = composition; verifier = capability; bound + predicate = the only engine
     surface.

4. How would Mailbox Intelligence use it?
   Each agent step becomes a verified loop ONLY where verification matters (most steps stay single-shot):
   - Classification: act: classify -> verify: confidence >= threshold OR a checker agent agrees -> branch:
     stop-when-confident | retry-with-more-context (back-edge) | maxAttempts reached -> escalate-to-human (a
     human-response await, C6). The objective stop is the confidence/checker predicate; the bound caps retries;
     the human-gate is the floor when the loop cannot satisfy the criteria.
   - Communication / draft: act: draft reply -> verify: tone/correctness checker agent passes -> branch:
     stop-when-passes | improve-and-redraft (back-edge, bounded) -> then human-approval await before send.
     The verifier raises draft quality; the human gate still owns the irreversible send (C6). The loop bounds the
     redraft attempts; the stop-predicate is the checker pass.
   This drops cleanly onto sec 7b: classify and draft are already P3/P2 steps; we add a verify step + a bounded
   branch around the ones that need it.

5. How would Jarvis-style multi-agent use it?
   Jarvis does NOT prompt step-by-step. Jarvis sets a GOAL + objective success criteria; the engine runs
   reason->act->verify->repeat loops ACROSS agents (the maker-checker and manager-with-helpers patterns are just
   multi-agent loops the engine orchestrates) until the stop-predicate is satisfied or maxAttempts trips. Every
   irreversible action remains a human-gate await (C6). Quality is gated by verifiers, not by Jarvis re-prompting.
   The 8-question North-Star screen (sec 6) reads this directly: goal, attempts so far, last verify result, stop
   reason - all already in workflow_run/workflow_step + emitted facts; no new screen mechanism.

6. Which transcript concepts to incorporate into v1 BEFORE implementation?
   INCORPORATE: objective goal + stop-condition as first-class; verification-as-the-core-value (a named verify
   step + a reusable checker capability); a hard-cap / maxAttempts on EVERY loop; Reason->Act->Verify->Repeat->Stop
   as a NAMED pattern (this section); maker-checker (a separate scorer with evals, the qa-test / agent-output
   evals already in sec 9 step 3); most tasks do not need loops (loops are opt-in; the engine stays minimal -
   single-shot steps remain the default); per-attempt logging/observability (each attempt + each verify result
   emitted via outbox -> /v1/events, ECR-0006 - no new transport).
   EXCLUDE (explicitly): 24/7 agent fleets; the meta-agent-that-infers-loops. Both violate the over-build guard
   and the G9 no-spawn ceiling; neither is exercised by the two proven domains.

### 10.2 The amended model (net-new is SMALL)

P1-P4 UNCHANGED. On top:
- The verified-loop PATTERN: act step + named verify step + bounded branch. Pure composition; no new primitive.
- Two tiny ENGINE fields on a looping step: attempt / maxAttempts (hard-cap) and a stopCondition predicate
  that P4 evaluates over the verify result. (One column-pair + one tick clause + one selector clause; same order
  of magnitude as the timer-wake wake_at net-new in sec 4.)
- The VERIFIER capability: maker-checker / scorer / eval agent, registered in the catalog, reused across domains.
  It is a step executor behind the P3 await (source agent-result) or a P2 in-process check - it adds NO engine
  surface.
- Stop-when-bound-trips routes to a human-response await (C6), never to silent failure or unbounded retry.

Why this avoids the founder's feared rework: the feared failure is build a step-executor, later discover the
value is verification. We make goal + verify + stop + bound first-class NOW, at near-zero extra engine surface
(two fields + a pattern + a catalog capability). We do not wait for a v2 retrofit; we also do not over-build a
loop primitive. This is the minimum that makes the verification the first-class thing.

### 10.3 The honest hard part

The loop MECHANICS are trivial (a back-edge + a counter + a predicate - all near-proven). The real work and the
real risk is the VERIFIER QUALITY: defining OBJECTIVE stop criteria and building trustworthy agent EVALS. A loop
with a weak verifier is worse than no loop - it confidently retries toward a wrong objective, or stops when it
should not. This is the same lesson as sec 9 risk Agent quality / evals (HIGH): the engine is easy; the
objective done-criteria + maker-checker evals are where the effort and the founder gating belong. Loops are
opt-in precisely because a loop is only as good as its verifier - do not loop a step whose success you cannot
objectively check.

### 10.4 Sequencing (unchanged posture)

Still DESIGN-ONLY - this section builds nothing. The verified-loop pattern + the two engine fields fold into the
sec 9 sequence: off-prod build on the Slice-0 harness; comms go-live remains the precondition for live proof;
agent evals (sec 9 step 3) BEFORE any loop drives a live run; and a sec-11 mini-review of THIS amended v1 (the
maxAttempts/stop-predicate engine fields + the verifier-capability contract) BEFORE any code. The over-build
guard (sec 9) still binds: the loop pattern earns its place because BOTH domains exercise it (Mailbox
classification/draft and Admin dunning-retry both loop act->verify->bounded-branch).

### 10.5 The Verifier capability (STRATEGIC) - model it fully, because this is where the value moves

> Founder directive, verbatim intent: future value will come less from workflow execution and more from the
> quality of verification, evaluation, scoring, confidence assessment, and approval decisions ... the real
> differentiator will be verifier quality. Sections 10.0-10.4 named the Verifier as a reusable capability and
> stopped. This sub-section models it FULLY: its contract, a trust-ranked type taxonomy, the strategic
> eval-the-evaluator property, its place in the capability catalog, and the cross-domain reuse table the founder
> asked for. It also codifies the durable design principle. The shift this encodes: the loop mechanics (sec 10.2)
> are solved and cheap; the verifier + its evals are the hard, high-value, EVALUATED capability - the
> differentiator. DESIGN-ONLY.

#### 10.5.0 Why a sub-section, not a new doc (anti-fragmentation)
The Verifier was already named the loop reusable capability in sec 10.1(3)/10.2. Forking a new doc would split
the execution model from its most strategic part. This EXTENDS sec 10; the engine surface (sec 10.2: maxAttempts
field + stopCondition predicate) is UNCHANGED. Everything below is capability + eval weight, NOT new engine. The
Verifier is a registered capability in the sense of CAPABILITY-PROMOTION-DISCOVERY.md (catalog/manifest/facets/
governance ladder) - it reuses that machinery rather than inventing a parallel one.

#### 10.5.1 The Verifier CONTRACT (the loop stop condition, made an interface)
A Verifier is a capability with one uniform interface. It IS the loop objective stop condition (sec 10.2):
the loop stops when the verdict is pass, OR attempt >= maxAttempts (the hard cap, sec 10.2 fields). A
needs_improvement verdict (with suggestedImprovement) feeds the bounded retry back-edge; fail with no
improvement path routes to a human-response await (C6).

    Verifier.verify(input) -> Verdict
      input  : { goal/criteria, candidate, context }   // the objective; what is judged; the run context
      Verdict:
        verdict             : pass | fail | needs_improvement   // the stop signal P4 reads
        score?              : 0..1     // optional rubric score (threshold-gated verifiers)
        confidence          : 0..1     // how sure the verifier is OF ITS OWN verdict (calibration target, 10.5.3)
        reasons             : string[] // why - the audit trail; emitted to /v1/events (observable rung)
        suggestedImprovement? : ...    // feeds the retry back-edge when needs_improvement

Properties (deliberate):
- **Objective over subjective.** verdict is the contract; score/confidence make the objectivity measurable.
- **PII-aware by construction.** A verifier that must read Contact PII to judge (e.g. entity-resolution, comms
  tone over a real person thread) RUNS IN PLOS, never in Admin or the engine (admin-truth-source-boundary;
  ADR-0003). The engine receives only the Verdict across the seam - never the PII the verifier read. This is
  the exact classifier-plus-its-evals-stay-in-the-domain boundary of sec 6/sec 9, applied to verifiers.
- **It is a step executor, not engine surface.** A Verifier sits behind the P3 await (source agent-result) for
  agent/LLM verifiers, or runs as a P2 in-process check for deterministic ones. It adds NO durable mechanism.

#### 10.5.2 Verifier TYPES - a small taxonomy, RANKED BY TRUST (prefer objective; fall back to human)
Five types, highest-trust first. The design rule: **use the highest-trust verifier the criterion admits; fall
back down the ladder only when no higher type is trustworthy enough; the bottom rung (human) is always available.**

| # | Type | Verdict comes from | Trust | Needs evals before it may GATE? | Canonical example |
|---|---|---|---|---|---|
| T1 | **Deterministic check** | a rule/assertion over facts | HIGHEST | NO - it is its own proof (a rule cannot be miscalibrated, only mis-specified) | invoice balance == 0; sum(allocations)==invoice.total; idempotency-key absent |
| T2 | **Rubric scorer** | a scored rubric, threshold-gated (score >= t) | HIGH | YES - the threshold + rubric must be calibrated against labelled outcomes | draft-quality score >= 0.8; data-completeness score |
| T3 | **Classifier-confidence** | the acting agent OWN confidence vs a threshold | MEDIUM | YES - self-reported confidence is worthless until calibrated (10.5.3) | classify only if confidence >= 0.9 else escalate |
| T4 | **LLM-judge / maker-checker** | a SEPARATE agent scores the maker output | MEDIUM (powerful but opaque) | YES - strongly; an un-evalled judge is the most dangerous (confident + plausible + wrong) | a checker agent grades intent-correctness or tone |
| T5 | **Human-approval** | a human IS the verifier | CONTEXT-HIGHEST for irreversible/subjective | N/A - the human is the ground truth (unifies with sec 5 human-in-the-loop / C6) | approve a send; issue a number; move money |

The ranking is the design guidance: a T1 deterministic check beats a T4 LLM-judge whenever the criterion can be
expressed as a rule - so *invest in making criteria objective* (push T4->T2->T1 where possible). T5 (human) is
the **canonical fallback**: the unbypassable floor for anything irreversible, subjective, or where no objective
verifier has earned enough trust to gate. T5 unifies sec 5 - a human gate is just a Verifier of type
human-approval whose Verdict posts via the human-response callback (sec 3). One model now covers approval AND
verification.

#### 10.5.3 THE STRATEGIC PROPERTY - eval-the-evaluator (this is where the investment goes)
**A Verifier must ITSELF be evaluated before it is allowed to GATE.** This is the load-bearing, non-obvious
claim and the real differentiator. A weak/uncalibrated verifier is WORSE than no loop: it confidently iterates
a bounded loop toward a WRONG objective, or stops pass when it should have failed - manufacturing false
confidence at machine speed. The loop safety is exactly the verifier calibration.

Therefore every non-T1 Verifier carries:
- **An eval suite** - labelled cases with known-correct verdicts (true-pass / true-fail / known-hard), the
  verifier measured precision/recall + calibration (does a stated confidence 0.9 actually mean ~90% right?).
  This is the qa-test / agent-output evals already named in sec 9 step 3 and sec 10.3 - now made a *property of
  the verifier capability*, not a one-off pre-flight.
- **A measured trust level** - it earns the right to gate via the SAME CAPABILITY-GOVERNANCE-LADDER.md rungs
  every capability climbs: **exists -> reachable -> validated (eval suite passes a stated bar, author!=verifier)
  -> observable (its verdicts + reasons emitted to /v1/events) -> trusted (calibration holds on real data) ->
  enabled (allowed to GATE autonomously)**. A verifier is just a capability; the may-it-gate question is exactly
  the governance-ladder question (ku-capability-governance-ladder), and built-is-not-allowed-to-gate is exactly
  ku-implemented-is-not-operationally-proven applied to verifiers.
- **The advise-vs-gate rule (the fail-safe):** *an un-evaluated / not-yet-enabled Verifier may only ADVISE,
  never GATE.* While below the enabled rung it runs in shadow - its verdict is recorded/emitted (building the
  eval evidence) but does NOT stop or branch the loop; the loop real stop condition stays a human-approval
  (T5) until the verifier calibration earns the enabled rung. T1 deterministic checks are exempt (a rule is
  its own proof). This is the construction-level guard against a confident-but-wrong gate, and it is precisely
  where the v1 effort + founder gating belong - NOT the loop mechanics.

**Say it plainly: the differentiator and the real investment are the EVAL INFRASTRUCTURE** - objective stop
criteria, labelled eval suites, calibration measurement, and the advise->gate promotion gate - NOT the loop
engine (which is two fields and a back-edge, near-proven). The engine is minimal on purpose; the strategic
weight is the Verifier capability + its evals.

#### 10.5.4 Reusability - Verifiers are catalog capabilities, invoked by id, composed into loops
A Verifier is registered exactly like any capability in CAPABILITY-PROMOTION-DISCOVERY.md: a *.capability.json
manifest, the 5 facets, an invoke descriptor, a governance-ladder status, discoverable via capability-route,
invoked by id via capability-invoke. Consequences:
- **One verifier, many loops.** A confidence-threshold verifier or an llm-judge rubric is declared ONCE and
  reused across Mailbox/Contact/Outreach/Jarvis - not re-authored per domain.
- **Composable.** A goal-success verifier (10.5.5, Jarvis) COMPOSES domain verifiers by id rather than
  re-implementing them.
- **PII-routing is a manifest fact.** A verifier touching Contact PII carries pii:true and is PLOS-owned -
  the same fail-closed scope machinery (A2/SEC-1 in CAPABILITY-PROMOTION-DISCOVERY) governs whether its verdict
  may cross the cross-system seam. No new mechanism.
- **The dedup gate prevents 5 bespoke verifiers.** The rebuild-detector (C4/C5 there) is exactly what stops a
  team re-inventing a quality-scorer that already exists.

#### 10.5.5 The reuse table (the founder explicit ask) - the SAME types reused across all 5
The strategic claim made concrete: these are NOT 5 bespoke verifiers; they are the SAME catalog verifier TYPES
(T1-T5) reused across domains. Read the rightmost columns vertically - each type recurs.

| Domain | Verifier(s) used | Type(s) | Stop / fallback |
|---|---|---|---|
| **Mailbox Intelligence** | classification-confidence verifier; intent-correctness checker; comms tone/correctness scorer | T3 (confidence) + T4 (LLM-judge) + T2 (rubric) | stop-when-confident/passes; else bounded retry; else escalate-to-human (T5) |
| **Contact Intelligence** | entity-resolution-confidence verifier (is this the right Contact? score+confidence); dedup-correctness checker | T3 (confidence) + T1/T4 (rule + judge) | stop-when-resolved-confident; ambiguous -> human (T5). PII -> runs in PLOS (10.5.1) |
| **Outreach Intelligence** | message-quality scorer; compliance/approval verifier; reply-classification confidence | T2 (rubric) + T1 (compliance rule) + T3 (confidence) | quality-passes + compliance-passes -> human-approval (T5) before any send (C6) |
| **Human Approval Flows** | the human-approval verifier (the canonical fallback - the human IS the verifier) | **T5** | the human decision IS the verdict; unifies with sec 5; the floor for irreversible/money/subjective |
| **Future Jarvis workflows** | a goal-success verifier (did the goal objective criteria get met?) that COMPOSES the domain verifiers above | composite (composes T1-T4) + T5 floor | stop when goal-criteria met; bounded; every irreversible action still a T5 human gate |

The reuse is the point: **T3 confidence-threshold** appears in Mailbox, Contact AND Outreach; **T2 rubric-scorer**
in Mailbox AND Outreach; **T4 LLM-judge** in Mailbox AND Contact; **T1 deterministic** in Contact AND Outreach
(compliance); **T5 human-approval** is the shared floor across ALL of them and IS the Human-Approval-Flows row.
Jarvis adds no new type - it composes the existing ones behind a goal-success verifier. That cross-domain
recurrence is the strategic reusability the founder asked to see demonstrated.

#### 10.5.6 The CORE DESIGN PRINCIPLE (durable - candidate KUs)
Codified for promotion to the wiki (the org KU corpus), drafted by knowledge-engineer, author!=verifier, not
self-certified:

> **Verified-loop execution (Goal -> Act -> Verify -> Improve -> Stop) is a core Delivery OS principle.** Every
> goal-oriented agent task is BOUNDED (maxAttempts) + gated by an OBJECTIVE stop condition + verified by a
> CALIBRATED Verifier capability. Verification is a strategic, reusable, EVALUATED capability - the
> differentiator is verifier QUALITY, not loop mechanics. **A Verifier must itself be evaluated before it is
> allowed to gate** (an un-evaluated verifier may only ADVISE). Prefer objective verifiers (deterministic ->
> rubric -> confidence -> judge) and fall back to a human-approval verifier when no objective verifier has
> earned enough trust; the human gate is the unbypassable floor for anything irreversible.

Two candidate KU ids (proposed, gated on the founder ratifying this amendment - DESIGN-ONLY, not created here):
- **ku-verified-loop-execution** - the loop is a bounded, objective-stop, verifier-gated pattern; loops are
  opt-in where verification matters; the value is the verification + objective done-criteria, not the steps.
  Earned-from: this sec 10 (founder Loop-Engineering ask) + the org own maker-checker dogfood (sec 10.0).
  Related: ku-verify-seam-by-one-real-round-trip, ku-author-not-equal-verifier.
- **ku-verifier-must-be-evaluated** - a verifier must itself be calibrated/evaluated before it may GATE; an
  un-evaluated verifier may only advise; a weak verifier is worse than no loop. Earned-from: this sec 10.5.3.
  Related: ku-capability-governance-ladder (it climbs the same rungs to earn enabled/gate),
  ku-implemented-is-not-operationally-proven (built != allowed-to-gate), ku-enable-capabilities-on-trust-not-existence.

#### 10.5.7 The honest hard part (where v1 investment + risk actually are)
The loop MECHANICS are solved and cheap (sec 10.3): a back-edge + an attempt counter + a stop predicate, all
near-proven, two engine fields. **The hard, high-value, high-risk work is verifier QUALITY + the EVAL
INFRASTRUCTURE:** defining objective stop criteria, building labelled eval suites, measuring calibration, and
the eval-the-evaluator gate (advise-until-calibrated). This is the single largest v1 investment area and the
single largest risk - a confident wrong verifier gating a bounded loop is the failure mode, and it is silent.
Keep the ENGINE minimal (a verifier is a CAPABILITY, not engine surface); spend the effort on the capability +
its evals. This restates and sharpens sec 10.3 and the sec 9 Agent-quality/evals (HIGH) risk: the founder
gating belongs on which verifiers are trusted enough to GATE, not on the loop wiring.

---

## Critical-rule check
This doc CONSOLIDATES the two prior board docs into one execution-model index (anti-fragmentation), DERIVES the
model from TWO validated domains (the cross-domain reduction is the proof of sharedness), reduces to exactly
four primitives (P1/P2 proven; P3 one proven edge made source-pluggable; P4 a small selector), maps BOTH domains
onto them with a YES verdict, honors the ownership boundary (Admin=State, PLOS=Communication, DOS=Orchestration)
and the G9 no-spawn ceiling, and is honest about the net-new core (agent-result + human-response sources, the
agent runtime, the timer, the branch). It refutes one thing for honesty: the LLM classifier + its evals do NOT
belong in the engine - they stay in the domain. DESIGN-ONLY: no build, no scripts, no wiring. Built is not
Adopted: this model is real only when ONE flow blocks on each callback source and resumes to terminal with the
recovery/race cases proven - not because this doc exists.
