# Mailbox Intelligence — the FIRST real multi-agent workflow (Board Recommendation, DESIGN / REVIEW ONLY)

> AMENDS, does not replace, WORKFLOW-ENGINE-V1-BOARD-REVIEW.md. That rec named invoice-send as the first proof
> of the cross-system capability-step. The founder has OVERRIDDEN the TARGET (not the mechanism): the proof is
> now Mailbox Intelligence, the first REAL multi-agent workflow. invoice-send's proven comms round-trip is NOT
> discarded — it becomes the Communication-Agent STEP (a reused subset) of the larger pipeline. The engine
> requirements below are DERIVED FROM the mailbox pipeline, not pre-designed. DESIGN-ONLY. Do NOT build.
> Board call. Reconciles + cites; regenerates nothing.

---

## 1. REFRAME (the verdict)

The goal is REAL MULTI-AGENT EXECUTION. The Workflow Engine is not the goal — it is the minimum infrastructure
that EMERGES from making the first real multi-agent workflow run end-to-end.

The prior board rec was correct about the MECHANISM (durable run + the cross-system await-callback step) but
framed it engine-first: build the primitive, prove it on the smallest 2-step thing (invoice-send), then look
for more workflows. The founder's directive inverts the framing: pick the first real multi-agent workflow,
build it on the minimum infra, validate it end-to-end, and let the engine fall out of exactly what that
workflow needed. This is the anti-over-build posture the standing section-11 sequencing gate has demanded since
2026-06-18, made concrete.

The validation target: Mailbox Intelligence. The chosen pipeline (the founder's example):

```
Incoming Email -> Classification Agent -> Intent Agent -> Contract Agent -> Communication Agent
                  -> Follow-up Agent -> callback handling -> workflow continuation
```

Proving this end-to-end proves the six things a multi-agent system must do, ALL AT ONCE, on real founder work:
workflow ownership, task delegation, callback handling, waiting states, agent coordination, execution recovery.
No synthetic workflow can prove these honestly; this one can, because every step maps to an evidenced pain in
the real 182-message corpus (property-lead-os/docs/reviews/mailbox-intelligence-board-review.md).

VERDICT: Build -> Validate -> Generalize.
1. Build Mailbox Intelligence on the MINIMUM infra (the 5 agents + the two genuinely net-new engine primitives
   the pipeline forces: agent-as-a-durable-step and a timer/wait step).
2. Validate end-to-end on a real incoming email, plus a crash-mid-pipeline recovery test.
3. Generalize — extract the Workflow Engine from EXACTLY what the pipeline needed; nothing speculative.

> This is NOT a green light to build a workflow platform. It is a green light to build ONE real multi-agent
> workflow, with the explicit expectation that the reusable engine is the residue.

### Why Mailbox Intelligence is the RIGHT first proof (not invoice-send)
- It is the highest-leverage real work (mailbox-intelligence-board-review.md sec1, sec8): the dunning loop is
  the founder's #1 time-sink; 28% of inbound is unread; the deal chain leaks out of every system. The proof
  rides on top of value, not a toy.
- It is genuinely multi-agent — it forces real LLM agents that classify, infer intent, resolve contacts, and
  draft. invoice-send is multi-STEP but single-actor (it orchestrates a deterministic send). Mailbox
  Intelligence is the first thing that needs AGENT COORDINATION, which is what the founder is actually after.
- It contains invoice-send as a subset — the Communication Agent's real backing IS the proven
  emit -> drain -> PLOS-send -> callback -> record round-trip
  (rumah-admin/docs/verify/VERIFY-invoice-delivery-status.md). Nothing proven is thrown away; it is promoted
  from "the whole proof" to "one step of the bigger proof."
- The substrate already exists in PLOS — real LLM agents (packages/agents/conversation-extraction-agent.ts,
  contact-intelligence-agent.ts), the proven send port (apps/web/lib/mailbox-send-port.ts), DWD mailbox read
  (scripts/spike-dwd-tenant-zero.mjs), conversation extraction + a contact graph. We are wiring proven parts
  into a durable run, not inventing the parts.

---

## 2. PIPELINE DECOMPOSITION (one row per step/agent)

> Owner key: PLOS = communication/mailbox/comms-execution/classification/intent/conversation/contact
> intelligence (per admin-truth-source-boundary + the comms/contact ownership directive). Admin = the System
> of Record for contract/invoice STATE, reached via the seam, never PII. DOS = the durable orchestration (the
> run, the steps, the waits, the callbacks).
> SYNC = completes in-process within one engine tick. ASYNC = the engine BLOCKS the run and is resumed by a
> callback (agent-delegation or external).

| # | Step / Agent | Owner | What it does | Inputs -> Outputs | SYNC / ASYNC | Waiting state? | Callback pattern |
|---|---|---|---|---|---|---|---|
| 0 | Incoming Email (trigger) | PLOS | A real inbound message arrives in an enrolled mailbox (DWD read lane); metadata + snippet only, bodies un-persisted. Starts a run. | mailbox event -> messageRef (mailbox, messageId, threadId, contentHash) | trigger (not a step) | n/a | n/a — this STARTS a run (a new workflow_run) |
| 1 | Classification Agent | PLOS | LLM classifies the message: noise vs human-value, and the category (dunning / deal / lead / vendor / admin). The triage what-needs-me intelligence (mailbox-review cap 1). | messageRef + snippet -> class, category, confidence (a FACT, no send) | ASYNC (LLM agent = a delegated step) | no | agent-delegation callback (NET-NEW pattern, sec3) |
| 2 | Intent Agent | PLOS | LLM infers the actionable intent within the category (payment confirmed / extension requested / new enquiry / dispute). | class+category + snippet -> intent, extractedFacts (parsed pay-state, booking-ref) | ASYNC (LLM agent) | no | agent-delegation callback |
| 3 | Conversation / Contact resolution | PLOS | Resolves the counterparty in the contact graph (company to person-with-role to booking-ref), reusing contact-intelligence-agent + conversation-extraction-agent. Yields the tenantId seam ref (NOT PII). | thread + sender -> contactRef, companyRef, tenantId?, bookingRef? | ASYNC (LLM agent + graph read) | no | agent-delegation callback |
| 4 | Contract Agent | Admin (via seam) + DOS step | Reads Admin contract/invoice STATE for the resolved tenantId via GET /v1/ops (open invoices, contract status, booking-ref) — read-only, PII-free. On a payment-confirmed intent it MAY emit a state fact for Admin (payment.observed) — never mutating money directly. | tenantId + intent -> openInvoices, contractStatus, bookingRef (read); optionally emit payment.observed | SYNC (read seam call) or ASYNC (if it emits + awaits an Admin ack) | no | read: in-process; emitted fact: the SAME emit-callback pattern as step 5 |
| 5 | Communication Agent | PLOS (comms) + DOS step | THE ALREADY-PROVEN COMMS ROUND-TRIP, REUSED. Drafts the reply/reminder (LLM, class B = draft+approve, D2), then on founder approval sends via the proven send port; the delivery callback records the outcome. invoice-send generalized to any reply. | draft inputs -> mailReplyDraft -> (founder-approved) send -> delivery outcome | ASYNC (await the send + delivery callback) + a human-approval gate | yes, if approval pending | the PROVEN delivery callback (/v1/deliveries) — already verified end-to-end |
| 6 | Follow-up Agent | PLOS (logic) + DOS (timer) | Schedules a follow-up: if no reply / no payment by T+N days, re-enter the run and draft the next dunning step. The waiting/timer step. | followUpAt, condition -> a scheduled re-entry | ASYNC (a WAITING/TIMER step) | YES — the defining waiting state | timer callback (NET-NEW: a wake-at re-entry, sec3) |
| 7 | callback handling -> continuation | DOS | When step 5 delivery callback OR step 6 timer fires, the run resumes from blocked and advances (timer fire -> back to step 5 to draft the next reminder). | a callback/timer event -> blocked -> executing -> next step | engine-internal | n/a | the proven blocked-to-executing edge (Slice 0) driven by callback OR timer |

Reading of the decomposition (the honest shape):
- Most of the pipeline is PLOS (steps 0-3, 5-content, 6-logic) — communication/mailbox intelligence. This is
  correct per the ownership boundary and matches where the substrate already lives.
- Admin appears ONCE, as a read (step 4) through the existing /v1/ops seam, with at most an emitted fact
  (payment.observed) — never a direct money mutation. The boundary holds 1:1.
- DOS owns the run, the waits, and the callbacks — steps 0 and 7 plus the ASYNC mechanics of every other step.
  The engine is the conductor; PLOS agents + Admin state are the orchestra (the prior rec framing, now
  instantiated on a real pipeline).
- There are exactly TWO genuinely new async shapes the pipeline forces beyond what is proven:
  (a) agent-delegation callback (steps 1-3) and (b) the timer/wait (step 6). Everything else is the proven
  Slice-0 run + the proven delivery callback. That is the minimum engine (sec3).

---

## 3. MINIMUM ENGINE REQUIREMENTS, DERIVED FROM THE PIPELINE (the emergent v1)

> The engine is whatever THIS pipeline forces — nothing more. Each requirement is justified by a specific row
> in sec2 and mapped to PROVEN vs NET-NEW. Resist adding anything the pipeline does not need.

| # | Requirement | Forced by step(s) | PROVEN today? | What is net-new |
|---|---|---|---|---|
| R1 | Durable run + persisted state + recovery | the whole run (0, 7) | PROVEN — Slice 0 (VERIFY-execution-engine-slice0.md): 7-state machine, SKIP-LOCKED tick, CAS, kill-and-resume, forced-failure to recovered | nothing — reuse Slice 0 as-is |
| R2 | Callback handling (block a run, resume on an inbound result) | 5, 7 | PROVEN for the delivery case (VERIFY-invoice-delivery-status.md + the prior rec N1-N3 design) — executing-to-blocked on emit, blocked-to-executing on callback, correlation by awaiting_event_id, race/dup/crash handled | the delivery callback is proven; this generalizes the SAME mechanism to two new sources (R3, R4) |
| R3 | Agent-invocation-as-a-step (delegate to an agent, await its result) | 1, 2, 3 | PARTIALLY — the await-callback SHAPE is proven; the agent runner that posts a result back is NET-NEW | a step whose effect = delegate-to-agent: emit an agent-task, BLOCK, resume when the agent posts its result. Mechanically IDENTICAL to the delivery callback — the other system is a PLOS LLM agent runner instead of the send port. This is the heart of multi-agent. |
| R4 | Waiting / timer step (scheduled wait + re-entry) | 6 | NOT PROVEN — Slice 0 has no time-based wake | a wake-at step: BLOCK with a wake_at timestamp; the tick (already running) wakes runs whose wake_at is past and drives blocked-to-executing. A second callback SOURCE (the clock) into the proven block/resume edge — no new state |
| R5 | Sequential + branch-on-classification coordination | 1 to 7, and the noise-vs-value / dunning-vs-deal branch after step 1 | PARTIALLY — Slice 0 runs sequential steps; branching on a step result is NET-NEW (small) | the definition can choose the next step from a prior step output (class=noise -> terminate; category=dunning -> the dunning sub-path). A next-selector, NOT a DSL |
| R6 | Recovery mid-pipeline (crash while blocked on an agent / a timer / a send) | all ASYNC steps | PROVEN for in-process + delivery | extend the proven crash tests to the agent-delegation + timer blocks (not new mechanism — a blocked run holds no lease, so crash-while-blocked is already trivial; the new cases are agent-callback-before-block and timer-fires-during-recovery) |

The minimum engine = R1 (reuse) + R2 (reuse, generalized) + R3 (NET-NEW agent-step) + R4 (NET-NEW timer step)
+ R5 (small NET-NEW branch selector) + R6 (adversarial proofs on the new blocks).

The two genuinely new primitives are R3 (agent-as-a-step) and R4 (timer-wait). Both are the same proven
block/resume edge driven by a new callback source (an agent result; the clock) — which is exactly why the prior
rec instinct (generalize the await-callback) is right, and exactly why we must NOT build a callback router or a
generic effect system on N=1 (the Waterline rule; the prior rec deferred list). Two new sources into one proven
edge — that is all the pipeline forces.

> Honest ceiling on R3 (load-bearing). Per G9-DISPATCH-RUNNER-ARCHITECTURE.md, the platform has NO
> self-spawning agent runner — only the main loop (Claude) spawns subagents; dispatch-route PLANS, it does not
> spawn. So agent-as-a-durable-step v1 cannot mean the engine autonomously spawns a Claude subagent. It means:
> the engine emits an agent-task that a bounded PLOS agent runner (or, interim, a founder-/Claude-driven
> dispatch) executes and posts back. The PLOS agents in scope (classification/intent/contact) are
> gesture-scoped pure functions today (conversation-extraction-agent.ts is explicitly NOT an A-series runtime
> agent). Turning them into callback-posting durable steps is real, bounded work — and the deepest net-new risk
> in this whole plan (sec6, R-agent-runtime).

---

## 4. BUILD -> VALIDATE -> GENERALIZE PLAN

### BUILD (the Mailbox Intelligence workflow on the minimum infra)
Net-new (what the pipeline forces, nothing else):
- The 5 agents as durable steps: Classification, Intent, Contact-resolution, Communication (draft side),
  Follow-up — wired as engine steps. The INTELLIGENCE of Classification/Intent/Contact REUSES PLOS existing
  LLM agents (conversation-extraction-agent, contact-intelligence-agent) — the net-new part is the agent-task
  emit + the result-callback (R3), not new models.
- R3 agent-step: StepEffect = delegate-to-agent (emit an agent-task to the outbox, BLOCK, resume on the agent
  result callback). The agent runner posts back via the same callback shape as /v1/deliveries.
- R4 timer-step: StepEffect = wake-at (BLOCK with wake_at; the tick wakes it). One new column
  (workflow_step.wake_at) + a tick clause; no new table, no scheduler service.
- R5 branch selector: the definition picks the next seq from the prior step result. No DSL.
- The mailbox-intelligence workflow DEFINITION (dispatch-route plan-shaped, per Slice-0 C7).

Reused (proven — do NOT rebuild):
- Engine Slice 0 (R1): run/step tables, SKIP-LOCKED tick, CAS, recovery, golden-master cage.
- The comms callback (R2): the proven invoice-send round-trip becomes the Communication Agent send + delivery
  callback verbatim (VERIFY-invoice-delivery-status.md).
- dispatch-route (the agent PLANNER, BUILT): plans which agent/skill/knowledge per step; the definition is its
  plan, materialized.
- Capability discovery (CAPABILITY-PROMOTION-DISCOVERY.md): the steps are discovered capabilities; the engine
  only needs each step to complete in-tick OR call back.
- PLOS mailbox substrate: DWD read lane, the send port, the contact graph, conversation extraction.

### VALIDATE (end-to-end, on real work)
The first end-to-end validation (the bar for this is real):
> A REAL incoming email -> Classification (value/dunning) -> Intent (payment-confirmed OR extension-requested)
> -> Contact resolution (tenantId) -> Contract Agent reads Admin state (open invoice / contract status) ->
> Communication Agent drafts a reply -> founder approves -> the proven send fires -> the delivery callback
> RESUMES the run -> Follow-up Agent schedules a T+N wait -> at T+N the timer RESUMES the run -> it drafts the
> next step. The run reaches a terminal state, fully durably, with every transition emitted to the outbox
> (observable to The Room, which owns ranking).

Plus the recovery test (the honest one):
> Crash the process mid-pipeline at THREE points — (a) blocked on an agent-delegation callback, (b) blocked on
> the delivery callback, (c) blocked on the timer — and prove the run resumes to terminal with no lost, no
> double, and no fabricated work. Plus the adversarial races: agent-callback-before-block; duplicate agent
> result; timer-fires-during-recovery. Author not-equal verifier (qa-test), exactly as Slice 0 was verified.

### GENERALIZE (let the engine emerge)
- Extract the Workflow Engine from EXACTLY what the pipeline needed: durable run (had), block/resume callback
  (had), agent-step (R3), timer-step (R4), branch selector (R5). Nothing speculative.
- ONLY after a SECOND real workflow needs them do we generalize: a callback ROUTER (multiple callback types),
  a generic effect registry, SLA/dead-letter, parallel fan-out. Each is a Waterline call on N>=2, never on N=1
  (the prior rec deferred list, upheld).
- Promote the engine to DOS + vendor via os-inherit only once proven in Admin AND past the N=1 master gate
  (V6-end-state / FOUNDER-OS-MIGRATION-PRINCIPLE), post-V6.

---

## 5. OWNERSHIP + CROSS-SYSTEM REALITY (honest about scale)

| Concern | Repo / owner | Why |
|---|---|---|
| Incoming email, classification, intent, conversation/contact resolution, the comms draft + send + the dunning logic | PLOS | PLOS owns mailbox + comms-execution + classification/intent/conversation/contact intelligence (admin-truth-source-boundary; the comms/contact ownership directive). The agents already live in packages/agents/. |
| Contract / invoice STATE read (step 4), payment.observed emit | Admin (via /v1/ops read seam + outbox) | Admin = System of Record for contract/invoice state. Reached PII-free via the seam (tenantId only, ADR-0003). Admin never reads bodies; PLOS never holds Admin state. |
| The durable run, the steps, the waits, the callbacks, recovery | DOS / Admin-hosted engine | DOS owns orchestration. The engine (Slice 0) is Admin-hosted today (admin-first proving ground); promoted to DOS on N=1. |

This is NOT a small build. Be honest: the proof pulls in, as preconditions or in-scope:
- Real LLM agents (classification, intent) that need EVALS — they make decisions that branch a workflow and
  draft customer-facing text. Untested LLM agents in a durable pipeline are the largest quality risk (sec6).
- The PLOS mailbox go-live (DWD consent, the read lane, the send-scope grant) and Contact Intelligence as live
  dependencies, not spikes.
- The comms go-live as a hard precondition (prod deploy of events/deliveries APIs, tokens, PLOS mailbox OAuth
  consent, the resolved Phase-0 double-send) — the Communication Agent has no real backing without it.
- A cross-repo workflow spanning Admin (engine + state) and PLOS (agents + mailbox + comms) — the first time
  the engine drives steps that execute in another repo. This is genuinely new integration surface.
- The PLOS-frozen reality — PLOS is the active proving ground for its own mailbox work; this pipeline depends
  on PLOS capabilities that may themselves be mid-flight. Sequencing must respect PLOS own roadmap, not assume
  its agents are frozen-and-ready.

---

## 6. SEQUENCING · RISKS · FOUNDER-GATED

### Sequencing
1. PRECONDITION — the comms go-live (the Communication Agent real backing) AND the PLOS mailbox read lane live
   on a real mailbox. Without both, the pipeline cannot be validated end-to-end on real mail.
2. Reconcile with PLOS mailbox roadmap (mailbox-intelligence-board-review.md Waves 1-4): the triage +
   payment-fact + contact-graph capabilities this pipeline consumes are PLOS own Wave 1-3. This rec does NOT
   re-plan them — it CONSUMES them as the agent steps. Confirm with PLOS what is live vs in-flight before
   committing the pipeline build.
3. Build off-prod on the Slice-0 harness (admin-first): R3 (agent-step), R4 (timer-step), R5 (branch), the
   definition, the 5 agent-step wirings — proven against the proven block/resume edge, no prod touched.
4. Agent evals (qa-reviewer / agent-output evals) on Classification + Intent BEFORE they drive a live run — a
   misclassification silently mis-routes the founder mail.
5. section-11 mini-review of THIS scope before code (the board may fold it into accepting this rec). The
   consequential decisions: R3 agent-step shape, R4 timer mechanism, the cross-repo run boundary.
6. Validate — the sec4 end-to-end run (founder-observed) + the recovery/race proofs (author not-equal verifier).
7. Generalize + promote — extract the engine; DOS promotion gated post-V6 + N=1.

### Risks
- R-over-build (HIGH) — the engine is the residue, not the goal. Guard: only R3 + R4 + R5 are net-new engine
  primitives; everything else reuses Slice 0 + the delivery callback. NO callback router, NO generic effect
  registry, NO SLA/dead-letter on N=1 (Waterline; the prior rec deferred list).
- R-agent-runtime (HIGH — the deepest net-new) — PLOS agents are gesture-scoped pure functions, and the
  platform has NO self-spawning runner (G9). Agent-as-a-durable-step must be defined as emit-task ->
  bounded-runner-executes -> callback, NOT the engine spawns a Claude subagent. Under-scoping this is the
  single most likely way the plan blows up. Guard: v1 agent-step is the proven callback shape with an agent
  result as the source; the runner is bounded + human-gated where it touches anything irreversible.
- R-agent-quality / evals (HIGH) — Classification/Intent are LLM decisions that branch a real workflow and
  draft customer text. Guard: evals before live; the deal-to-signed chain stays class C (founder-controlled,
  per the mailbox review sec5); every customer-facing send stays class B draft+approve (D2). The engine NEVER
  auto-sends; the Communication step always blocks for approval.
- R-comms-precondition (HIGH if ignored) — no comms go-live means no real Communication Agent. Guard: the
  go-live is a hard precondition for VALIDATION (build proceeds off-prod in parallel).
- R-ownership / PLOS-frozen (MED) — most agents are PLOS; PLOS is mid-flight on its own mailbox waves. Guard:
  consume PLOS capabilities via the seam; do not build mailbox intelligence in Admin; align with PLOS roadmap
  before committing.
- R-cross-repo-run (MED) — the first engine that drives steps executing in another repo. Guard: the cross-repo
  seam is the proven outbox -> /v1/events (PULL) transport (ECR-0006) + the agent-result callback; no new
  transport.
- R-PII / privacy (MED, section-11) — the pipeline reads real mail. Guard: bodies un-persisted (metadata+snippet
  only), reads allowlist-scoped, tenantId-only across the Admin seam (ADR-0003), corpus gitignored — the exact
  discipline the mailbox review already practiced.
- R-real-requirement-now (the standing sequencing gate) — is there a REAL multi-agent need NOW? YES: the
  dunning loop + triage are the founder evidenced #1 pains, and the pipeline rides proven infra + real PLOS
  agents. Bar met. (If the board judges the agent-runtime work too large for the current proving-ground phase,
  the legitimate fallback is to prove R3 on ONE agent step first — Classification only -> a deterministic
  send — before the full 5-agent chain. That is a smaller first slice of the SAME pipeline, not a different
  target.)

### Founder gestures (gated)
- The comms go-live (gates validation, not the off-prod build).
- Confirming the agent-runtime posture for R3 (bounded runner + human gate vs anything more autonomous).
- Every customer-facing send in the Communication step (D2 — class B draft+approve, never autonomous).
- The section-11 mini-review acceptance of R3/R4/the cross-repo run boundary.
- Promotion to DOS + vendoring to PLOS (post-V6, past N=1).
- Anything touching money or an irreversible commitment (the Contract Agent emits FACTS / reads STATE; issuing
  a number or moving money stays blocked-for-human, per Slice-0 C6).

---

## 7. PROVEN vs GENUINELY-NEW-AND-HARD (the honesty ledger — do not undersell the scale)

PROVEN (reuse, low risk):
- The durable run + state machine + tick + CAS + kill-and-resume + forced-failure recovery (Slice 0).
- The emit -> drain -> PLOS-send -> delivery callback -> record round-trip, idempotent + PII-free
  (invoice-delivery verify). This IS the Communication Agent send half.
- dispatch-route PLANNING (selects agent/skill/knowledge per step; the definition is its plan).
- The PLOS mailbox substrate: DWD read, the send port, the contact graph, conversation extraction agents.

GENUINELY NEW AND HARD (this is where the work + risk live):
- The 5 agents as durable, callback-posting steps — turning PLOS gesture-scoped pure agents into bounded
  runtime steps that the engine delegates to and awaits (R3). The deepest net-new piece; no self-spawning
  runner exists today.
- Their evals — LLM classification/intent quality gating a real workflow + customer-facing drafts.
- Agent-as-a-durable-step (R3) and the timer-wait (R4) — two new callback sources into the proven block/resume
  edge.
- Branch-on-classification coordination (R5) — the run chooses its path from a step result.
- The end-to-end mailbox -> agents -> comms -> follow-up -> callback loop running durably across two repos —
  the first time all six multi-agent properties are proven together on real work.

Bottom line: the engine half is mostly proven; the multi-agent half (real LLM agents, made durable, evaluated,
coordinated, and recovered across two repos) is the genuinely new and hard part — which is precisely why it is
the right proof, and precisely why the engine must emerge from it rather than precede it.

---

### Critical-rule check
This rec amends, does not regenerate, WORKFLOW-ENGINE-V1-BOARD-REVIEW.md (invoice-send -> the Communication
step) and consumes, does not duplicate, mailbox-intelligence-board-review.md (PLOS evidence-based mailbox waves
become the agent steps). It derives the minimum engine FROM the pipeline (Build -> Validate -> Generalize), maps
every requirement to proven vs net-new, honors the ownership boundary (PLOS=comms/agents, Admin=state via seam,
DOS=run), and is honest that the agent-runtime + evals are the hard, large, net-new core — not a small add-on.
DESIGN-ONLY: no build, no scripts, no wiring. Board ratifies the reframe (multi-agent execution is the goal;
the engine emerges), the sec2 decomposition, the sec3 minimum requirements, and the sec4 plan; an independent
verifier checks that nothing here pre-builds an engine ahead of the pipeline. Built is not Adopted: this is real
only when a real incoming email drives the durable pipeline to terminal — with the recovery/race cases proven —
not because this doc exists.
