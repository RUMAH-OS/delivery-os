---
artifact: RUNTIME-ARCHITECTURE (CANDIDATE blueprint of the conditioned OBW-GS/c core — ADR + Runtime Blueprint + Implementation Roadmap)
id: RA-DOS-v1
subject: The Delivery OS Runtime Architecture — candidate blueprint toward the permanent Company OS foundation
date: 2026-06-28
status: CANDIDATE (design-only; the final consolidation panel — §17 — is AUTHORITATIVE and supersedes §0–§16 where they conflict. Two blind lenses returned SOUND-WITH-CONDITIONS; the conditions re-defer the Project-Owner organ, Sprint Engine, and Slack to panel-gated build-on-pull, add four required durable stores, and fix a Phase 4/5 sequencing inversion. Ratification authorizes ONLY the Phase 0–3 safety core. Implements NOTHING.)
consolidates:
  - docs/reviews/RESEARCH-FOUNDATION-2026-06-28-operating-model-v2.md (AN-1…AN-12; the five-discipline convergence)
  - docs/reviews/ADR-OPERATING-MODEL-V2-2026-06-28.md (OBW-GS/c; the four-lens panel; C1–C13; §19 organ ranking)
  - docs/reviews/INVESTIGATION-OM-v2-three-proposals-2026-06-28.md (§11 walk-back: PO-reconciler folds into the tick; Slack deferred; reflection cut)
  - docs/reviews/INVESTIGATION-OM-v2-sprint-model-2026-06-28.md (§8 walk-back: sprint = Evidence Cycle; pre-flight PRIMARY; three-way verdict as doctrine; slow-asymptotic OPEN)
  - docs/reviews/LEGACY-ARCHITECTURE-AUDIT-2026-06-28.md (single models already exist; self-install drift; expand-then-contract)
  - docs/reviews/HANDOFF-2026-06-28-discovery-incident.md (the primary evidence)
  - core/GOVERNANCE.md · DECISIONS.md · capabilities/* (the on-disk built state)
scope_guard: Design only — no code, no scripts, no wiring, no migrations. The deliverable is the runtime blueprint + ADRs + roadmap + migration + rollout + DoD + success criteria. **Honest correction (§17):** the first draft re-promoted three panel-deferred framings (the Project-Owner organ, the Sprint Engine, Slack) into authorized core phases — §17 re-defers them to build-on-pull and surfaces that disagreement; this body is the candidate blueprint, §17 is the binding amendment.
---

# Delivery OS Runtime Architecture — candidate blueprint of the conditioned core

> **One sentence.** A **durable state spine** (the Result Bus + per-project Project-Owner state + ledgers +
> registries + memory) is the single source of truth; **stateless level-triggered reconcilers** (the Project
> Owner loop, the Goal Supervisor, the engine tick) are *summoned on a clock* to drive and govern it;
> **ephemeral Claude Code agents** (specialists · verifiers · reviewers) are *spawned per task, hold no
> essential state, and die after posting to the bus*; the **founder is summoned with evidence through Slack**
> at genuine boundaries; and every objective advances through **evidence-bounded sprints** that are refused up
> front when statically unreachable, halted-and-escalated when stalled, and shipped through a **local→QA→
> staging→prod** pipeline — with **author≠verifier and a goal-keyed supervisor independent of the loop they
> guard** as the load-bearing safety invariants.

It changes no code. It is the architecture to *review, challenge, and approve* before any implementation begins.

> **⚠ READ §17 FIRST — the final panel conditioned this document.** Two independent blind lenses
> (completeness/integration + adversarial re-inflation) found that this consolidation, under a "definitive
> foundation" framing, **re-promoted three panel-deferred framings into authorized core phases** — the
> **Project-Owner reconciler organ**, the **Sprint Engine**, and **Slack** (which §11/§8/ADR-C8 had routed to
> build-on-pull / their own §11 panels) — and inverted Phase 4/5 (autonomous *shipping* before pipeline
> *safety*). Those findings are **conceded.** **§17 is authoritative:** ratification authorizes **only the
> Phase 0–3 safety core** (stop drift · ship the M1 ledger · the pre-flight feasibility gate · the Goal
> Supervisor + dead-man's-switch); the Project-Owner organ, Sprint Engine, and Slack are **build-on-pull, each
> gated by its own §11 panel**; and §17 homes four durable stores the durable-state law silently required
> (idempotency/de-dup, durable circuit-breaker state, dead-letter, portfolio cost ledger). The *spine and the
> safety core are sound*; the *scoping and sequencing* are corrected in §17.

---

## 1. Executive summary & the one-screen runtime

The architecture is the honest synthesis of five prior investigations, each of which was independently
adversarially reviewed. Its shape is forced by one law the prior art (Kubernetes/Borg/Omega · Temporal/DBOS ·
Google distributed cron · Erlang/OTP) and the Company-OS incident record converge on:

> **The durable-state / stateless-compute law:** *No essential state lives in any process's RAM. State is
> durable; compute is summoned against it. Correctness depends on current state re-derived each pass
> (level-triggered), never on a perfect sequence of events (edge-triggered). Recovery is a re-read; a crashed
> reconciler is crash-equivalent to one that just started.*

Everything below is a consequence of that law plus the safety invariants the incident purchased (author≠
verifier; goal-keyed governance external to the loop; pre-flight feasibility; boundary = STOP = SUCCESS).

```
 ┌──────────────────────────────────────────────────────────────────────────────────────┐
 │ L4 — FOUNDER INTERFACE                                                                  │
 │   Slack operating layer  ── summon-with-evidence · approvals (identity-bound) · status  │
 │   FAP/boundary envelope · the founder single-screen (8 questions)                       │
 └───────────────▲───────────────────────────────────────────────────────────────────────┘
                 │ (event-driven: founder acts at boundaries; pull-by-exception)
 ┌───────────────┴───────────────────────────────────────────────────────────────────────┐
 │ L3 — GOVERNANCE & SAFETY  (independent of the loops they guard — author≠verifier)       │
 │   Pre-flight Feasibility Gate (PRIMARY) · Goal Supervisor (progress watchdog,           │
 │   halt→summon) · GS Dead-man's-switch (different failure domain) · Verify Gate           │
 │   (CI-binding, D9) · §11 Review panels · Learning Engine (L0/L1/L2) · DoD validation     │
 └───────────────▲───────────────────────────────────────────────────────────────────────┘
                 │ (scheduled, level-triggered; reads durable state)
 ┌───────────────┴───────────────────────────────────────────────────────────────────────┐
 │ L2 — ORCHESTRATION  (stateless reconcilers on a clock — NO daemon)                      │
 │   Project Owner reconciler ── AI-native Sprint Engine (plan → execute → 3-way review)    │
 │   Scheduler/heartbeat (tiered ticks) · GitHub Actions (long-lane) · engine-step tick     │
 └───────────────▲───────────────────────────────────────────────────────────────────────┘
                 │ (spawns via G9 main loop; awaits via the bus)
 ┌───────────────┴───────────────────────────────────────────────────────────────────────┐
 │ L1 — EXECUTION SUBSTRATE  (ephemeral compute)                                           │
 │   Claude Code Runtime (the G9 spawner) · specialist agents · verification agents ·       │
 │   review agents · workers behind await steps · the P1–P4 durable run/step engine         │
 └───────────────▲───────────────────────────────────────────────────────────────────────┘
                 │ (reads/writes the single source of truth)
 ┌───────────────┴───────────────────────────────────────────────────────────────────────┐
 │ L0 — DURABLE STATE SPINE  (the ONLY persistent layer — the single source of truth)      │
 │   Result Bus (run/step, Postgres) · Project-Owner state (goal contract + sprint state +  │
 │   goal-delta & attempt ledgers) · Event outbox · Capability registry · Config registry · │
 │   Memory (3-tier + signals corpus) · Governance/decision ledgers                         │
 └────────────────────────────────────────────────────────────────────────────────────────┘
   CROSS-CUTTING: Observability (golden signals + goal-delta telemetry) · Recovery (durable replay) ·
                  Security (least-privilege, identity-bound, secrets in platform stores) · Scaling
   DELIVERY (orthogonal pipeline): local → QA → staging → production · state-gated deploy · expand/contract
```

**The five things this architecture gets right that the incident got wrong:** (1) it watches the **goal-delta,
not the activity**; (2) it refuses statically-unreachable goals **before** burning effort; (3) its supervisor
lives **outside** the loop it guards; (4) it runs long work on a **non-serverless lane**, not behind a 300s
ceiling; (5) **production never takes production *traffic* as its first validation** — *logic* is validated locally, the platform-emergent classes (HE-1…HE-6) on a prod-faithful **staging that IS the real platform**, and the residual behind a closed-loop canary (the C11 correction — "validate locally" as an absolute is false, since local has no `maxDuration`).

---

## 2. Design axioms (the invariants every component is held to)

Inherited from the Research Foundation (AN-1…AN-12) and the panels; not re-argued here, only listed as the
constraints the runtime obeys.

- **AX-1 Govern the objective, not the activity.** Control variable = an *independently measured* goal-delta.
- **AX-2 Re-introduce removed friction as external mechanism.** Every governor AI deletes (fatigue, the social
  cost of "is this reachable?") becomes an explicit fail-closed mechanism keyed on the objective.
- **AX-3 The watchdog lives outside the loop it guards.** Author≠verifier, generalized to orchestration: the
  thing that drives work is never the thing that judges whether the goal is moving.
- **AX-4 Reachability is a gate — checked before AND during.** An unreachable spec escalates the *goal*, never
  triggers another attempt.
- **AX-5 Durable state, stateless compute, level-triggered.** §1's law. Events accelerate; they never carry
  truth.
- **AX-6 Boundary = STOP = SUCCESS.** Autonomous execution terminates cleanly at the founder boundary; it never
  idles or loops forever.
- **AX-7 Long-horizon work is durable/checkpointed/idempotent on a fit-for-runtime lane.** No >300s work behind
  a serverless route; world-touching actions carry intent-keyed de-dup; irreversible actions stay human-gated.
- **AX-8 Local-first validation; production never validates first.** Logic locally; platform-emergent classes
  (HE-1…HE-6) on a prod-faithful staging; the residual behind a closed-loop canary.
- **AX-9 Built ≠ operating; verified ≠ gating.** A capability earns its place only when a mechanism fires it;
  a verifier earns the right to gate only after it is itself calibrated.
- **AX-10 Simplicity-first; parallelism is not free.** Prefer a guarded single loop + an external watchdog to a
  persistent fleet; justify every added agent.

---

## 3. The component lifecycle classification (the goal's explicit ask)

**Exactly which components are persistent, event-driven, scheduled, or ephemeral.** This falls directly out of
AX-5. The doctrine: **persistent = state only; everything that *computes* is scheduled or ephemeral; nothing
essential lives in a long-running process's memory.**

| Lifecycle class | Definition | Components | Rationale |
|---|---|---|---|
| **PERSISTENT** (durable state; the *single source of truth*; survives every restart) | holds state, runs no logic | **Result Bus** (run/step, Postgres) · **Project-Owner state** (goal contract + sprint state + goal-delta ledger + attempt ledger), per project · **Event outbox** (append-only) · **Capability registry** · **Configuration registry** (single config truth) · **Memory** (3-tier + signals corpus) · **Governance/decision ledgers** (DECISIONS.md, gate ledgers) | Recovery = re-read; no SPOF daemon; no state-loss-on-crash. The durable spine the whole runtime sits on. |
| **SCHEDULED / LEVEL-TRIGGERED** (stateless compute on a clock over durable state — the "always-on" feel *without* a daemon) | re-derives desired-vs-observed each tick; holds no essential state | **Project Owner reconciler** (drives sprints) · **Goal Supervisor** (progress watchdog) · **GS dead-man's-switch** (different failure domain) · **engine-step tick** (advance ready durable steps) · **governance crons** (repo-governance, learning-review) | A late tick is *safe* (reads durable state — the resync property); GitHub Actions best-effort cron is therefore acceptable. Crash-equivalent to fresh start. |
| **EVENT-DRIVEN** (reacts to events — but a level-triggered reconciler is the correctness backstop; a missed event self-heals next pass) | wakes on a callback; never the source of truth | **Result Bus completer** (callback: blocked→executing) · **Deployment pipeline** (PR/merge → CI → state-gated deploy) · **Learning triggers** (L0/L1/L2 + N-merge backstop) · **Slack interactions** (approvals, queries) | Events accelerate latency; correctness survives every event being dropped (the inert-`setTimeout`/`enqueue()` wedge class is killed). |
| **EPHEMERAL** (spawned per task; hold no essential state; terminate after posting to the bus) | does the work, posts the result, dies | **Claude Code Runtime sessions** (the `/goal` segments; the G9 spawner; bounded by the H1 cap) · **specialist execution agents** · **verification agents** (author≠verifier) · **review agents** (§11 lenses, sprint completion reviews) · **workers behind await steps** | "Perfect memory" is a property of the durable ledger, not the agent's context. Kill a stalled/looping agent and re-derive from durable state (bounded restart + circuit breaker, never infinite). |

**The resolution of the "persistent Project Owner" debate (load-bearing):** the Project Owner spans three
classes by layer — its **STATE is PERSISTENT** (L0), its **DRIVING LOOP is SCHEDULED/level-triggered** (L2,
stateless), and its **INTELLIGENT WORK is EPHEMERAL** (a bounded Claude Code session invoked *at sprint
boundaries* to plan and to run the completion review). It is therefore the **single, always-accountable owner**
the founder wants — *without* being a fragile always-running in-memory daemon (SPOF + state-loss + idle cost).
"Continuous supervision" = the scheduled reconciler + the Goal Supervisor reading durable state every tick; the
PO spends real intelligence only at boundaries (Reflexion/OODA cadence).

---

## 4. The runtime blueprint, layer by layer

For each component: responsibility · lifecycle · key interactions · the alternative rejected (with the prior
evidence). Components the goal named are all covered.

### 4.0 L0 — the durable state spine (PERSISTENT)
- **Result Bus** — the durable run/step machine (P1–P4; 7-state, SKIP-LOCKED tick, CAS lease, recovery; one
  block-on-correlation await; one idempotent completer). *Built & proven* (27 files byte-identical Admin+PLOS).
  System of record for execution state + communication + recovery in one. *Rejected:* direct agent-to-agent
  messaging (lost on crash, no idempotency); stateless re-derivation each run (context loss).
- **Project-Owner state** — per project: the goal contract (objective + acceptance criteria + **reachability
  assertion** + write-ahead budget), the current sprint state, the append-only **goal-delta ledger**
  (`progress[]{cycle,value,predicted,fix_ref}`) and **attempt ledger** (`{attempt,hypothesis,action,delta,
  outcome}`). *Partly built* (`goal-init`/`goal-stop`); the **M1 `goal-progress.mjs` ledger is designed but
  missing — must ship first.**
- **Event outbox** — append-only; the pull-transport (ECR-0006) other systems consume; the audit substrate.
- **Capability registry** — `*.capability.json` + the governance ladder (exists→reachable→validated→observable
  →trusted→enabled). Built; ~90% unpopulated (a migration item).
- **Configuration registry** — the *single config source of truth* (schema+template from delivery-os; per-key
  owner/validator/required-flag/fix; per-app pooler mode + scope + refs). `config-doctor` reads it; CI
  cross-checks the three planes. *Built & field-proven* (failed closed on 4 keys at once).
- **Memory** — three-tier (portfolio doctrine / project memory / derived-state-never-stored) + the signals
  corpus (dedup-at-write). *Built.*
- **Governance/decision ledgers** — `DECISIONS.md` (question-keyed) + gate ledgers. *Built.*

### 4.1 L1 — the execution substrate (EPHEMERAL)
- **Claude Code Runtime** — the main loop that spawns agents (the **G9 ceiling**: only the main loop spawns;
  reconcilers *plan*, they never self-spawn out-of-loop). A `/goal` segment is one bounded runtime, capped by
  H1 (turn/wall-clock/cost). *Honest harness limit:* true out-of-loop specialist fleets are not available;
  the reconciler launches *bounded Claude sessions*, it does not run an autonomous agent fleet (the AI-OS noun
  stays earned at the Founder Absence Test).
- **Specialist execution agents** — build one vertical slice to the contracts (software-engineer + the domain
  packs). Ephemeral; ground→build→self-verify→post.
- **Verification agents** — independent (author≠verifier); validate a slice on the *real surface*; own the
  "observed state" the reconciler trusts. Ephemeral.
- **Review agents** — §11 lenses + the sprint completion review; verdicts only, own no files. Ephemeral.
- **Workers behind await steps** — Admin state handlers / PLOS comms / timers / human-response — each posts the
  one callback. Ephemeral; a blocked step holds no lease (crash-while-blocked is trivial).

### 4.2 L2 — orchestration (SCHEDULED / level-triggered)
- **Project Owner reconciler** — the single owner's driving loop (full design §5). Level-triggered: each tick
  re-derives desired-vs-(verified)-observed for the active sprint; advances/launches/collects/interrupts;
  spends boundary intelligence to plan and review. *Rejected:* an always-running daemon (SPOF/state-loss/idle
  cost) and a pure event-driven owner (missed-event silent wedge — the incident class).
- **AI-native Sprint Engine** — the Evidence Cycle as the unit of execution (full design §6): plan → execute →
  **three-way completion review**. *Rejected:* fixed-duration human sprints (thrash/windup/OODA); continuous
  unstructured execution (the incident).
- **Scheduler / heartbeat — the tiered ticks** (three *independent* loops, AX-3): (1) the **engine-step tick**
  (advance ready durable steps; the existing `rumah-admin /v1/heartbeat`, Vercel cron ~5 min, sub-300s); (2)
  the **PO-reconciler + GS** (GitHub Actions cron, long-lane); (3) the **GS dead-man's-switch** (a *different*
  failure domain — Vercel cron / external monitor). *"Heartbeat" is liveness only; progress is the GS's
  separate organ (never conflate — the incident agent was alive throughout).*
- **GitHub Actions orchestration** — the non-serverless lane for any >300s work + the scheduled reconcilers.
  *Already proven* (the daily `repo-governance` cron). Dedicated worker + a DBOS-style durable-execution library
  over the existing Postgres bus are **deferred until pulled** (no daemon, no SPOF, when cron+bus is outgrown).
- **Queues** — not a new external queue at N=1 (Waterline); the durable SKIP-LOCKED run/step *is* the queue.
  A pgmq/BullMQ adapter is deferred until a second domain pulls.

### 4.3 L3 — governance & safety (independent; author≠verifier everywhere)
- **Pre-flight Feasibility Gate (the PRIMARY organ — panel C2/§19.2).** Before sprint 1: the serverless-ceiling
  lint (no >300s work behind a 300s route — the exact `runDiscovery` mismatch) + a precedent/reachability check
  ("has this ever been produced; is the target reachable from current inputs?"). Refuses the statically-
  unreachable goal at *hour 0* — the cheapest, judgment-free incident fix. *Designed.*
- **Goal Supervisor (the BACKSTOP).** External arithmetic watchdog: re-probes the metric from its canonical
  source under *its own* identity; computes dGoal/dEffort; layered hard trips (cap · write-ahead budget ·
  no-progress fingerprint · independent goal-verifier); on a trip **halts → summons the founder with evidence →
  re-derives reachability** (never "one more fix"). *The metric STEERS, never gates success.* *Designed* (the
  in-loop H9 escalation is the interim form; the out-of-loop poll is the target).
- **GS dead-man's-switch** — an independent dumb timer on a different failure domain; alarms the founder if the
  GS goes silent (the 76-commit billing-outage class). *New; recorded-failure-pulled (C3).*
- **Verify Gate** — author≠verifier; **binding in CI** (required `verify-coverage` + branch protection +
  CODEOWNERS, D9); semantic `impl_fingerprint` (D8); the local hook is the honest advisory. *Built.*
- **§11 Review panels** — blind-first, consolidated, dissent-surfaced; human/event-triggered, **never** an
  in-loop auto-redirect (the 08:42 frame-lock lesson); the **re-derive-the-premise lens** mandatory on
  feasibility questions. *Built/doctrine.*
- **Learning Engine** — L0 continuous capture (`signals.jsonl`, dedup-at-write) / L1 event-fired checkpoint /
  L2 full review on heavy triggers; census-detector (wire or remove — currently inert); promotion = scaled §11;
  no-backflow lint. Findings compile to *mechanisms, not prose*. *Mostly built.*
- **DoD validation** — the hard gate (implement→build/validate→commit→independent QA→domain review→stakeholder
  acceptance→docs→status; derived `verify_status`, never self-asserted). *Built.*

### 4.4 L4 — the founder interface (EVENT-DRIVEN; pull-by-exception)
- **Slack operating layer** — the recommended first founder interface (full analysis §7): summon-with-evidence
  (the PO/GS post a FAP/boundary card; the founder approves/denies/queries); **a thin transport over the
  authenticated goal API** (the `jarvis` seed already does this), never the authority/execution layer.
  Conditions: identity-bound approvals; prompt-injection defense (chat is never an instruction source for
  privileged actions); a non-SaaS escalation fallback; agents are *on* the loop, not *in* it (no chatty
  synchronous interaction). *Seed built (v0.1.0).*
- **FAP / boundary envelope** — the structured Founder Action Package (status · done · remaining · why-stopped ·
  zero-tech steps · rollback · resume). *Built.*
- **The founder single-screen** — the 8-question north-star surface (what/who/why/skills+knowledge/verifier/
  pass/what-changed/complete), *derived from the ledgers* — the missing V6 Pillar-3 surface, which the Slack
  layer fills. *Designed.*

### 4.5 L5 — the delivery pipeline (orthogonal; EVENT-DRIVEN with state gates)
- **local → QA → staging → production** — AX-8. **local** (born-correct env; the running thing under real
  concurrency/DB shape) · **QA** (author≠verifier on the real surface) · **staging** (prod-faithful: same plan/
  scope/pooler class; migration-parity; cross-system seam round-trip; soak — the rung the consumers lack) ·
  **prod** (state-gated). The named platform-emergent classes **HE-1…HE-6** are caught off-local.
- **State-gated deployment (D7)** — `deployment-auth` authorizes by SDLC state, not per-deploy signature;
  `deploy-lane` + `.deploy-lane.json` policy + FREEZE kill-switch. *Built & proven.*
- **Config platform** — §4.0 single registry; one-pass deploy pre-flight (config + build-shape + migration-
  state). *Built.*
- **Migrations** — **expand/contract** (backward-compatible; code rollback never needs a schema rollback);
  forward-only, applied before code, **bidirectional content-hashed parity gate**; brought into the lane
  (currently manual — a gap).
- **Rollback** — deploy≠release (flags); closed-loop canary + **binding** post-deploy health gate (no
  continue-on-error); restoreable ref captured first.

### 4.6 Cross-cutting
- **Observability** — golden signals (latency/traffic/errors/saturation) **+ goal-delta telemetry** (dGoal/
  dEffort, the burn-rate analogue) + the dispatch-log (who/what/why/skills/verifier). Alert on the *objective*,
  not the activity.
- **Recovery** — durable-state replay; a crashed reconciler/agent resumes by re-reading the bus (no essential
  RAM state). Blocked steps hold no lease. Bounded restart + circuit breaker for stalled agents.
- **Security** — least-privilege tools (no unguarded send/charge/publish/delete); identity-bound Slack
  approvals; secrets in platform stores (never working trees); the permission classifier as a 4th enforcement
  layer; prompt-injection treated as a control-plane attack surface (chat is not an instruction source).
- **Scaling** — per-project Project Owner (the unit is the *goal*, not a team); stateless reconcilers scale
  horizontally; the durable bus is the only shared spine; bounded by compute/cost (write-ahead budgets) and the
  founder's boundary-handling rate (minimized by D6 founder-verifiable narrowing + summon-with-evidence). *No
  management layer to scale.*

---

## 5. The Project Owner — the single owner of every project (full design)

The founder's directive: the PO must understand objectives, prioritize, create sprints, spawn/supervise
runtimes, monitor, interrupt, collect evidence, review, replan, launch specialists, run formal sprint reviews,
validate DoD, auto-start sprints until done, and communicate only meaningful updates. **All of it is granted —
in the durable-state + reconciler + boundary-intelligence form (§3), with the safety interlocks the incident
purchased.**

| PO responsibility (founder's words) | How the runtime delivers it | Lifecycle | Interlock |
|---|---|---|---|
| understand business objectives · prioritize | boundary intelligence: parse the `/goal` into a goal contract (objective + acceptance criteria + reachability assertion + budget); prioritize the sprint backlog | ephemeral (boundary) | the **pre-flight gate** refuses a statically-unreachable objective before any sprint |
| create AI-native execution sprints | the Sprint Engine: plan objective + acceptance criteria + work packages (§6) | ephemeral (boundary) | **metric-fitness check (C4b)** at each sprint plan |
| spawn & supervise execution runtimes | dispatch via `dispatch-route`; the **G9 main loop** spawns the bounded Claude session | scheduled invokes ephemeral | reconciler **plans, never self-spawns** (G9) |
| continuously monitor progress · collect evidence | the level-triggered tick (observe *verified* state) + the GS (dGoal/dEffort) | scheduled | observation owned by the **verifier**, not the acting agent (AX-3) |
| interrupt stalled / misaligned work | a worker stall self-heals next pass (observed≠desired); a *goal* stall is the GS forcing an early completion review | scheduled | **bounded restart + circuit breaker** (never infinite) |
| review intermediate results · replan strategy | re-plan at the sprint boundary from verified state; **discard the stale tail** (anti-windup) | ephemeral (boundary) | re-plan only **while the goal-delta moves**; a flat delta **revokes** autonomous re-frame (C9) |
| launch additional specialist agents | additional work packages dispatched via `dispatch-route` (G9 spawns) | scheduled invokes ephemeral | — |
| perform formal sprint reviews · validate DoD | the **three-way completion review** (§6), adjudicated by an **independent** verifier | ephemeral (boundary) | author≠verifier — the PO runs the review, it does **not** adjudicate it |
| auto-start new sprints until objectives achieved | the Sprint Engine loop | scheduled | bounded by **objective-complete OR feasibility-boundary OR the H1 cap** — never infinite |
| communicate only meaningful updates to the founder | summon-with-evidence via Slack at boundaries; pull-by-exception status | event-driven | agents *on* the loop, not *in* it |

**The PO is the un-delegatable accountability locus (AX-1):** it delegates *work* to ephemeral agents, never the
*outcome*. It validates goal *movement*; it never *judges feasibility* — that verdict summons the founder (AX-4/
C1). **One PO per project; the founder talks to the PO, never to implementation agents.**

---

## 6. The AI-native Sprint Engine (full design)

The sprint = the **Evidence Cycle** made first-class (the sprint investigation's accepted-as-doctrine outcome).
**No fixed duration** — the boundary is *evidence* (the acceptance criteria become evaluable), capped by H1.

```
 PLAN (PO boundary intelligence): frozen objective + acceptance criteria (metric-fitness-checked, C4b) +
      execution plan → work packages via dispatch-route
   → PRE-FLIGHT FEASIBILITY GATE (PRIMARY): statically unreachable? → refuse → summon founder. else ↓
 EXECUTE (ephemeral specialists on the Result Bus; verify-on-real-surface)
 MONITOR (cheap, continuous): engine tick + GS (dGoal/dEffort) — GS may force an early completion review
 COMPLETION REVIEW (INDEPENDENT verifier; stakes-gated; against the FROZEN criteria) → three-way verdict:
   ├─ complete ───────────────────► STOP (DoD validated) = success
   ├─ incomplete-but-reachable ───► PO auto-generates the NEXT sprint (re-plan, discard stale tail)
   └─ unreachable / insufficient ─► HALT → summon founder (feasibility boundary FAP) → terminate
 (loop bounded by: objective-complete OR feasibility-boundary OR the H1 layered cap)
```

**The corrections the adversarial discipline forced (carried, not papered over):**
- **The pre-flight gate is the PRIMARY incident fix** — not the per-sprint review (that is the backstop). The
  review earns its keep only on the *not-statically-knowable* residual.
- **The completion review is INDEPENDENT and STAKES-GATED** — author≠verifier (the PO runs it, doesn't
  adjudicate); fires the *expensive* independent review only for Class-C / founder-verifiable / cross-system
  objectives (else the cheap default is the existing verify-gate + the arithmetic watchdog — ceremony-cost
  discipline, §15.1).
- **Acceptance criteria are frozen *per sprint* but metric-fitness-checked at each plan (C4b)** — freezing the
  *value target* prevents mid-sprint goalpost-drift; re-checking *fitness* each plan prevents entrenching a
  wrong proxy.
- **"Auto-start until done" is bounded** by the three-way verdict + the H1 cap. **OPEN PROBLEM, named honestly:**
  a *slowly-moving-but-practically-infinite* objective reads "reachable" (positive dGoal/dEffort) and would
  sprint forever — caught today **only by the H1 cap**, not by the GS (which trips on *flat*, not slow-positive).
  A *rate-of-convergence floor* (require the delta to project hitting the target within budget) is a candidate
  fix but is a **new mechanism owing its own evidence and panel** — not built here.

---

## 7. The Slack operating layer — sequencing recommendation

**Recommendation: make Slack the first founder interface immediately after the runtime foundation core**, ahead
of Browser Control or other worker capabilities — *with the ChatOps conditions and one honest caveat.*

- **Why (operational value):** ChatOps is the fastest path to a complete, audited, human-in-the-loop control
  loop at near-zero build; **summon-with-evidence is native** for agents; the **transcript is the audit log**;
  it **validates the whole operating model in real daily operation** (PO ↔ founder ↔ governance) before any
  heavy capability; the **seed already exists** (`jarvis` v0.1.0); and it **fills the missing V6 Pillar-3
  single-screen surface**. Beats **Browser-first** (a worker capability, not a control plane — and only right
  when there's *no* API; there *is* a goal API) and **direct-web** (heavyweight pull surface; the founder must
  go look).
- **Conditions (non-negotiable):** thin transport over the authenticated goal API (no model logic in Slack);
  identity-bound approvals; prompt-injection defense; non-SaaS escalation fallback + per-action fail policy;
  agents summon at boundaries, never chatty/synchronous.
- **The honest caveat (the adversarial record):** a prior pass flagged that *unilaterally* overturning the
  panel's C8 deferral on "the seed exists" is sunk-cost reasoning, and Slack *renders* organs that must exist
  first. So the **sequencing is correct but it is a ratification decision** — Slack ships **after** the
  foundation core (it has artifacts to render), as the **first capability**, and the founder (the ratification
  authority, who is directing this) approves it as part of the roadmap (§10). It is *not* bundled into the core
  mechanism; it is the first thing built *on* the core.

---

## 8. Legacy architecture audit — consolidated disposition

Per the full audit (`LEGACY-ARCHITECTURE-AUDIT-2026-06-28.md`): **the single models already exist; the legacy
problem is drift, inert scaffolding, dead code, and scattered config — not competing architectures.** The
runtime-relevant dispositions:

- **PRESERVE (canonical, already the runtime's organs):** Result Bus · `deployment-auth`/lane + the workflow
  templates · GOVERNANCE.md + DECISIONS.md · `dispatch-route` + the routers (G9 C2 firewall) · the verify gate
  (CI-binding) · the learning engine · config-doctor · the gates (seam/lifecycle/workflow) · the
  `/v1/heartbeat` engine tick · the `jarvis` Slack seed.
- **MIGRATE (re-home/install/propagate; no logic change):** **stop the self-install drift** (`.claude/` runs 12
  of 54 tools; `goal-init`/`goal-stop`/`boundary-classify`/`sibling-probe` uninstalled; `verify-gate` stale) —
  *Phase 0, highest priority*; **ship the missing `goal-progress.mjs` M1 ledger**; propagate the Admin-proven
  gates to PLOS; provision `.deploy-lane.json` + config secrets; bring Supabase migrations into the lane.
- **REFACTOR:** unify the three scheduled loops into the tiered model (§4.2); wire `progress-stall.mjs` into the
  GS; collapse config to one registry; docstring "verify-gate is advisory; CI is binding."
- **ISOLATE:** the inert PLOS cron routes (schedule-or-remove); the speculative engine substrate (build-gated);
  D3/D4 (their own §11).
- **REMOVE (fails the measurable-value test):** the dead `setTimeout` drain loop; `DISCOVERY_SEED_INTERVAL_HOURS`;
  the `ratified.by` per-deploy field; the wiki references; **wire-or-remove** census-detector/file-lesson.

**The end state:** one source-of-truth (config registry + derived-not-stored + the bus) · one orchestration
(durable state + the tiered reconcilers) · one governance (GOVERNANCE.md + DECISIONS.md; CI-binding gate) · one
execution (the P1–P4 bus) · one deployment (state-gated + the ladder) — *no competing or hidden legacy
behavior.*

---

## 9. The Architecture Decision Records (RADR set)

The load-bearing runtime decisions, each with the rejected alternative and the evidence.

| # | Decision | Rejected alternative (with evidence) | Confidence |
|---|---|---|---|
| **RADR-1** | Durable state spine = the single source of truth; **stateless level-triggered compute** over it | always-running daemon (SPOF/state-loss/idle cost); pure event-driven (missed-event wedge = the incident) | Proven (substrate) / Strong (shape) |
| **RADR-2** | The Project Owner = persistent STATE + scheduled reconciler + ephemeral boundary intelligence (one owner per project) | persistent in-memory daemon; passive event-only state object | Strong |
| **RADR-3** | Goal governance external to the loop: **pre-flight gate PRIMARY**, GS watchdog BACKSTOP, dead-man's-switch on a different domain | in-loop H9 escalation (frame-inheritance); auto-redirect panel (H9c) | Strong (the embodiment Plausible-until-built) |
| **RADR-4** | The sprint = the Evidence Cycle (evidence-bounded, three-way verdict, stakes-gated independent review, metric-fitness-checked) | fixed-duration human sprints; continuous unstructured execution; mandatory universal review | Strong (as doctrine; core-elevation is a panel call) |
| **RADR-5** | Ephemeral agents (G9 main-loop-spawned); memory is the durable ledger, not agent context | persistent specialist fleets (~15× cost; coordination/context failure; G9-blocked) | Strong |
| **RADR-6** | Tiered independent scheduling (engine tick · PO+GS · dead-man's-switch); GitHub Actions long-lane now; worker/durable-execution library deferred | one platform for everything (the 300s ceiling = the incident); a daemon | Strong |
| **RADR-7** | Local-first validation; prod never validates first; HE-1…HE-6 caught off-local; staging is prod-faithful | "production finds it" (the incident discovered the 300s kill in prod) | Strong |
| **RADR-8** | Slack = the first founder interface after the core, thin over the goal API, with ChatOps conditions | Browser-first (wrong layer); direct-web (heavyweight pull); bundling Slack into the core | Strong (sequencing is a ratification call) |
| **RADR-9** | author≠verifier everywhere (slice CI-binding D9; goal-level via the GS; orchestration via verifier-owned observation); state-gated deploy (D7); semantic VERIFY (D8) | self-asserted verify_status; person-gated deploy; timestamp staleness | Proven |
| **RADR-10** | Expand-then-contract migration of the framework to itself; built-≠-operating gate | flip-the-switch cutover; designed-but-inert accumulation | Strong |

---

## 10. Implementation roadmap (de-risk riskiest-unknown-first; design-only sequencing)

**Ratification authorizes the narrow core + this sequence; not the whole surface at once.**

- **Phase 0 — Stop the drift (prerequisite).** Re-install `.claude/` to current; install the missing kernel
  tools; add continuous drift-check + auto-remediation. *Nothing is trustworthy until the framework stops
  dogfooding stale copies.*
- **Phase 1 — Durable spine operating.** Ship + install `goal-progress.mjs` (M1 ledger); prove the Result Bus
  runs **as the goal-delta substrate** (not just a workflow primitive) — the confidence the panel withheld
  (C5).
- **Phase 2 — The pre-flight feasibility gate (PRIMARY).** Serverless-ceiling lint + reachability/precedent
  check. Cheapest, judgment-free, prevents the incident class at hour 0.
- **Phase 3 — The Goal Supervisor + dead-man's-switch.** External arithmetic watchdog (metric re-probed under
  its own identity; layered trips; halt→summon) + the cross-domain dead-man's-switch. Reconcile the interim
  in-loop H9 with the target out-of-loop poll.
- **Phase 4 — The Project Owner reconciler + Sprint Engine.** The level-triggered loop + the three-way
  completion review (stakes-gated, metric-fitness-checked, anti-windup), folded onto the existing tick.
- **Phase 5 — Pipeline hardening.** Staging rung; expand/contract migrations into the lane; bidirectional
  content-hashed parity; config-as-platform-settings; binding post-deploy gate.
- **Phase 6 — Slack founder surface (the first capability after the core).** Promote the `jarvis` seed to
  summon-with-evidence + approvals + status + the 8-question single screen, under the ChatOps conditions.
- **Build-on-pull (each its own §11 decision):** sprint *core-elevation* doctrine; auto-merge (D3); dev-collapse
  (D4); dedicated worker / durable-execution library; browser/other capabilities; queue adapter.

**Every phase is author≠verifier-proven and independently revertible** (Phase 0 reinstalls are forward-safe;
2–6 are additive — disable the new organ → fall back to current behavior; removals happen only after the
replacement is proven in prod).

---

## 11. Migration strategy (expand-then-contract, non-breaking)
The framework's own expand/contract discipline applied to itself (§8 + Phase 0–6): **add the new canonical path,
prove it author≠verifier, *then* remove the legacy** — never a flip-the-switch cutover. Per-item rollback is
"re-add the dead code," never "restore lost function." Consumers adopt by **pin** at named moments (F1); the
base mints versions; the scaffolder + version boundary make inheritance mechanical; the no-backflow lint keeps
the agnostic core clean.

## 12. Rollout plan
- **Delivery OS first (dogfood):** Phases 0–6 land in the framework; the framework runs its own runtime.
- **Consumers by pin:** rumah-admin (first installer; the engine tick already runs there) → property-lead-os
  (N=2; the gates/config propagate). Anti-third-fork: consumers vendor + sha-pin + drift-check; no source
  divergence.
- **The acceptance milestone = the Founder Absence Test:** the founder ratifies a bounded objective + envelope,
  *leaves*, and on return reconstructs the whole story from the single screen — work advanced within guardrails,
  every gate enforced, kill-switch honored, **the GS halted-and-summoned rather than thrashing** if a goal proved
  unreachable. Passing it earns the "AI Operating System" noun (honestly unearned until then).

## 13. Definition of Done (for the runtime itself)
The runtime is DONE when, for each phase, an **independent VERIFY** confirms on the real surface:
- **DoD-1** the durable spine is the sole state; killing any reconciler/agent loses no progress (recovery = re-read).
- **DoD-2** a statically-unreachable goal is **refused at the pre-flight gate before any sprint** (incident replay).
- **DoD-3** an effort-without-progress loop is **halted from outside the loop and summons the founder**, with the
  dead-man's-switch proving the supervisor was alive to do so.
- **DoD-4** no >300s work runs behind a serverless route; long work is durable/checkpointed/idempotent on the lane.
- **DoD-5** every change is validated **locally + on prod-faithful staging**; production validates nothing first;
  HE-1…HE-6 each have a non-local catch surface.
- **DoD-6** author≠verifier holds at slice (CI-binding), goal (GS), and orchestration (verifier-owned observation).
- **DoD-7** the founder operates the system through Slack: summoned with evidence at boundaries; the 8-question
  screen answerable in ≤2 minutes from derived state.
- **DoD-8** zero competing/hidden legacy behavior remains (one of each model; no inert scaffolding; no drift).

## 14. Success criteria
- **SC-1 (the incident is impossible):** replay the Discovery timeline — the goal **never starts** (pre-flight),
  or for the not-statically-knowable class the unbounded grind is **impossible** (bounded halt-and-summon from
  outside the loop, no human required to *notice*).
- **SC-2 (founder burden falls without relaxing safety):** the founder is *summoned early with evidence*, not
  relied on to *notice late*; Class-C gates unchanged; the boundary-handling rate is low.
- **SC-3 (single models):** one source-of-truth/orchestration/governance/execution/deployment; no hidden legacy.
- **SC-4 (built = operating):** no new designed-but-inert capability ships without the mechanism that fires it.
- **SC-5 (the honest claim):** bounded autonomy is labeled bounded; the AI-OS noun is reserved for the Founder
  Absence Test.

## 15. Open problems & honest limits (named, not hidden)
1. **Slow-asymptotic convergence** (§6) — a slowly-but-practically-infinitely-moving objective is bounded only
   by the H1 cap; a rate-of-convergence floor is a candidate but unbuilt, owing its own evidence/panel.
2. **The supervisor's runtime under G9** — on this harness the external supervisor is a *scripted/gated
   state-reading runner that escalates*, not an autonomous out-of-loop agent; true out-of-loop specialist
   autonomy needs a runtime beyond the current harness.
3. **Metric-fitness is a heuristic frontier** — C4b reduces but does not eliminate the metric-selection
   frame-lock; an LLM fitness check can be wrong, backstopped only by the hard caps.
4. **Sprint core-elevation is a deferred scope decision** — the Evidence Cycle is canonical doctrine here; making
   it *mandatory core* is routed to a §11 panel (not ratified in this document).
5. **Cost at higher agent volume** — write-ahead accounting + the cost instrument are prerequisites, not
   afterthoughts; a runaway reconciler/fleet must be bounded by the budgets.

## 16. Status & the approval gate
This is a **CANDIDATE** runtime architecture. Per the founder directive and Governance §11, **nothing is
implemented until it is reviewed, challenged, and approved.** It is pre-hardened with every prior adversarial
finding and challenged again in §17. The honest limit (the §12 discipline): this document proves the
architecture is *coherent, evidence-grounded, incident-faithful, and consolidated*; it does not prove it
*correct in build* — that is the phased proof slices (run author≠verifier) after ratification.

---

## 17. Final consolidation panel — findings, concessions, and the binding amendment (AUTHORITATIVE)

> Two independent blind lenses reviewed this consolidation: a **systems/integration completeness** lens and an
> **adversarial re-inflation/over-claim** lens. Both returned **SOUND-WITH-CONDITIONS.** They **converge**: the
> *spine and the Phase 0–3 safety core are sound and ratifiable*; but the consolidation **re-promoted three
> panel-deferred framings into authorized core phases** and left **four durable stores un-homed** and a **Phase
> 4/5 sequencing inversion**. The findings are **conceded** and this section is the binding amendment. Faithful
> to §11 ("surface disagreements, never smooth them"), the disagreement with the prior walk-backs is surfaced
> below, not buried.

### 17.1 The conceded re-inflation (both lenses) — re-deferral
The first draft (§4.2/§5/§6/§10/RADR-2/4/8) presented as authorized core build-phases three things the
authoritative passes had **deferred to build-on-pull / their own §11 panel**:
- **The Project-Owner *organ* (the "reconciler" as a distinct core component).** `INVESTIGATION-three-proposals
  §11.4` **withdrew** it ("do not mint a new Project-Owner core organ; the active orchestrator role stays
  DEFERRED per C8"); only the *level-triggered upgrade folded into the EXISTING engine tick* survived. → **The
  PO's *functions* are delivered by existing organs (durable goal-contract state + the engine tick + the GS);
  the PO *organ/role* and the "single owner" framing are build-on-pull, panel-gated.** Drop the
  "all-granted / single owner of every project" daemon rhetoric (§5); keep the three-class decomposition (state
  persistent · loop scheduled · intelligence ephemeral). Re-tag **RADR-2 → DEFER (build-on-pull); Plausible.**
- **The Sprint Engine as core Phase 4.** `INVESTIGATION-sprint-model §8.5` ruled it **build-on-pull, routed to
  its own §11 panel** ("do not ratify to core here"); only the **three-way completion verdict as doctrine**, and
  as a **stakes-gated backstop on the existing verify-gate**, survived. → **The Sprint Engine is build-on-pull,
  panel-gated;** the three-way verdict is carried as doctrine only. Re-tag **RADR-4 → DEFER (doctrine ratifiable;
  engine build-on-pull).**
- **Slack as numbered Phase 6, "founder approves as roadmap."** `§11 B2 / M5′` ruled it **DEFER**, the sequencing
  a **fresh §11 panel** decision (the "the founder is directing this / the seed exists" reasoning is the named
  sunk-cost trap). → **Slack is DEFER; recommended to the next §11 panel as the leading founder-surface
  candidate; the §7 merits comparison is *input to that panel*, not a roadmap commitment.** Re-tag **RADR-8 →
  DEFER (recommended to panel).**

**Surfaced disagreement (not smoothed):** the legacy audit (LAA §1.2/§5) treated the PO-reconciler / Sprint /
Slack as live; the two investigations' §11/§8 walk-backs treated them as build-on-pull. **The walk-backs win**
(they are the later, adversarially-ratified word, and the §17/C6 rule forbids a single-author consolidation
re-electing a deferred item). RA-DOS is corrected to the walk-backs.

### 17.2 The four un-homed durable stores (completeness lens, SHOULD-FIX-3) — added to L0
The durable-state law (AX-5) requires these as *components*, not just asserted properties. Each is **recorded-
failure-pulled** (so it clears Waterline) and **folds into an existing store** (so it adds no sprawl):
- **Idempotency / de-dup store + write-ahead-intent ordering** — consumed intent-keys with a TTL; the invariant
  *write the intent durably BEFORE the side-effect, confirm AFTER* (the 10-PR retry-storm / double-send class).
  Folds into the bus.
- **Durable circuit-breaker / attempt-count state** — open/closed + failure-count + cooldown **in the durable
  attempt-ledger, never reconciler RAM** (else a crashed/rescheduled reconciler resets the breaker and the
  runaway resumes — a direct violation of bounded-restart).
- **Dead-letter terminal** — a `failed-terminal` rung on the bus state machine that, when bounded restart +
  breaker exhaust, records a poison-step and **emits a boundary FAP** (the breaker-open → durable record →
  founder-summon seam, currently untraced).
- **Portfolio-wide cost-accounting ledger** — aggregate spend across N goals (the per-goal write-ahead budget is
  not enough; the **76-commit billing-outage** precedent). Bounds a runaway fleet.

### 17.3 The Phase 4/5 sequencing inversion (completeness lens, BLOCKER-1)
Autonomous execution that *builds and ships* must not run before the **pipeline that makes shipping safe**
(staging rung · expand/contract migrations in the lane · bidirectional migration-parity · binding post-deploy
gate). → **Pipeline hardening moves ahead of (or alongside) any autonomous-shipping work; and autonomous
execution is explicitly scoped to NON-DEPLOYING work (build + local/QA verify only — prod promotion stays the
state-gated D7 human gate) until pipeline hardening lands.** This closes the second incident class (the prod/
migration failures) against an agent reproducing it at machine speed.

### 17.4 The remaining required fixes
- **Headless-invocation spike (SHOULD-FIX-5) — add to Phase 0/1.** The whole autonomy *noun* rests on one
  unproven harness fact: *a scheduled GitHub-Actions job launching a bounded headless Claude session that reads
  the bus, dispatches a specialist (G9: that session is the main loop for its segment), and posts a verified
  result.* Prove it cheaply **before** any auto-sprint design; the Phase 0–3 safety core does **not** depend on
  it (deterministic scripts + arithmetic + human-summon), so the noun is gated, the safety core is not.
- **Reconciler/GS independence (SHOULD-FIX-4).** §4.2(2) is corrected: the PO driving loop and the GS are **two
  independent scheduled jobs** (different state reads, different logic) that may *share* the GH-Actions
  substrate — never one combined job (else the driver grades its own progress and frame-lock returns).
- **The bus-lease invariant (integration seam).** State explicitly: *no scheduler (engine tick, reconciler, GS)
  mutates step state out-of-band; every mutation goes through the bus's SKIP-LOCKED/CAS lease protocol* — this
  is what makes the two tickers touching the same steps safe.
- **No-op-cheap reconcile (integration seam).** The tick must **deterministically (no LLM)** detect "am I at a
  boundary?" and invoke the expensive LLM boundary-intelligence *only then* — or a cron-launched LLM every tick
  is a cost runaway (R5).
- **Dead-man's-switch domain (SHOULD-FIX-7).** Pin it to an **external uptime monitor** (clamp-free), not Vercel
  cron — Vercel cron is subject to the doc's own HE-4 plan-tier clamp (a daily-only watchdog is not a watchdog).
- **RADR-1 confidence (SHOULD-FIX-5/over-claim).** Re-tag to "Proven as a workflow primitive / **Plausible as the
  goal-delta substrate (C5 — must run, Phase 1)**" — do not borrow the proven tag for the unproven composition.
- **C11 phrasing (SHOULD-FIX-6).** Corrected in §1 (production never takes production *traffic* first).

### 17.5 DEFER (name now, build on pull)
Backpressure / admission control (spawn-rate + bus-queue-depth bounds at N>1); relabel the "event bus" as a
**transactional outbox + level-triggered pull** (ECR-0006), not push pub/sub (a *strength* — label it so);
the two real scaling bottlenecks (the **shared Postgres bus** under SKIP-LOCKED contention at portfolio scale,
and the **founder-summon queue** — triage/prioritize boundary FAPs when many projects summon at once); and the
**cross-repo executable seam-contract store** (the runtime artifact the staging cross-system round-trip checks —
the Admin↔PLOS invoice-delivery seam). None is needed at N=1.

### 17.6 What both lenses confirmed is SOUND (the ratifiable core)
The durable-state/stateless-compute law (§1); the **persistent / scheduled / event-driven / ephemeral
classification (§3)** — *the goal's explicit ask, executed cleanly* (the PO three-class decomposition is a real
decomposition, not a fudge); the **pre-flight-gate-PRIMARY / watchdog-BACKSTOP ranking**; **liveness≠progress**;
the **external arithmetic watchdog that summons the human**; the **dead-man's-switch on a different domain (C3)**;
**metric re-probed externally + fitness check (C4a/C4b)**, **flat-delta-revokes-re-frame (C9)**, **long-work-
off-the-serverless-ceiling**; **reflection backstop cut**; **in-loop H9 = interim / out-of-loop = target**;
**auto-merge / worker / queue deferred**; **M1 ledger flagged missing**; the **slow-asymptotic open problem and
the G9 harness ceiling carried honestly (twice)**; and **Phases 0–3 correctly ordered by dependency + risk.**

### 17.7 The corrected roadmap (replaces §10's authorization scope)
**Ratification authorizes ONLY the Phase 0–3 SAFETY CORE** (deterministic; human-present; no headless-LLM
dependency; valuable regardless of the autonomy noun):
- **Phase 0** — stop the self-install drift; **+ the headless-invocation spike** (de-risk the noun early).
- **Phase 1** — the durable spine operating: ship the **M1 `goal-progress.mjs` ledger** (missing on disk) + the
  **four L0 stores (§17.2)**; prove the bus runs *as the goal-delta substrate* (C5).
- **Phase 2** — the **pre-flight feasibility gate (PRIMARY)**.
- **Phase 3** — the **Goal Supervisor + dead-man's-switch (external monitor)**; reconcile interim in-loop H9 → out-of-loop poll.
- **Phase 3.5 (pipeline safety — moved EARLIER, §17.3)** — staging rung · expand/contract migrations in the lane
  · bidirectional content-hashed parity · binding post-deploy gate. *Required before any autonomous shipping.*

**BUILD-ON-PULL — each its own §11 panel, NOT authorized by this ratification:** the **Project-Owner reconciler
organ** (the surviving form: a level-triggered upgrade to the existing tick + the three-way verdict as a
stakes-gated backstop on the existing verify-gate) · the **Sprint Engine** (its core-elevation is a doctrine
panel) · the **Slack founder surface** (sequencing is a panel decision) · auto-merge (D3) · dev-collapse (D4) ·
dedicated worker / durable-execution library · browser/other capabilities · queue adapter · backpressure ·
seam-contract store. Autonomous shipping in any of these is scoped to **non-deploying work until Phase 3.5
lands**.

### 17.8 Status
**CANDIDATE.** Ratify the **spine + Phase 0–3 (+3.5) safety core**; route every build-on-pull item to its own
§11 panel. The honest limit stands: this proves the architecture *coherent, evidence-grounded, incident-
faithful, consolidated, and now independently re-scoped*; it does not prove it *correct in build* — the phased
proof slices (author≠verifier) do. The recurring lesson across this whole program, visible one more time here:
**intuitive additions keep folding back into existing organs under adversarial review, and a "definitive
foundation" framing is itself the thing the governance must catch — which it did.**
