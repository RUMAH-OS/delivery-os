---
artifact: ARCHITECTURE-DECISION-RECORD
id: ADR-OM-v2
subject: Delivery OS Operating Model v2 — the complete AI-native operating model
date: 2026-06-28
status: PANEL-REVIEWED CANDIDATE (design-only; §11 blind panel complete — see §18; the FINAL conditioned recommendation is §19 and supersedes §0/§14/§16 where they conflict; founder ratification pending)
evidence_base: docs/reviews/RESEARCH-FOUNDATION-2026-06-28-operating-model-v2.md (the definitive investigation)
incident_anchor: docs/reviews/HANDOFF-2026-06-28-discovery-incident.md (PLOS Discovery ≥20)
scope_guard: This is an ARCHITECTURE design. It implements NOTHING — no code, no scripts, no wiring, no migrations. It ends in ONE recommended operating model justified by evidence, first principles, and incident history only.
method: First-principles re-derivation for an all-AI-agent organization. Human practices are inspiration only; each is challenged ("why did it exist → does the reason survive when workers are AI → re-derived design"). Alternatives are compared, inferior designs rejected with evidence, accepted designs justified.
---

# ADR — Delivery OS Operating Model v2 (the AI-native operating model)

> **The one-sentence design.** A persistent **Project Owner** per goal holds an *un-delegatable goal
> contract*; it dispatches *ephemeral, verified* worker agents over a *durable result bus*; and the whole
> segment is governed by an **External Goal Supervisor** that is keyed on the *goal-delta, not the activity*,
> separates *liveness from progress*, layers its stop conditions, and on a stall **halts → summons the
> founder with a feasibility finding → forces a re-frame** — never "one more fix." Work is *validated locally
> through a real environment ladder (local → QA → staging → prod)* before promotion; **production is never the
> first validation environment**. Everything that can be a *mechanism* is a mechanism; the founder is
> *summoned with evidence*, never relied upon to *notice*.

This ADR designs that model in full, component by component, and rejects the alternatives with evidence.

> **⚠ READ THIS FIRST — the panel changed the recommendation.** Sections §1–§17 are the **pre-panel
> candidate**. A four-lens independent blind §11 panel (lead-architect · adversarial critic ·
> re-derive-the-premise · platform/ops) reviewed it; **all four returned SOUND-WITH-CONDITIONS** with
> load-bearing conditions. **§18 is the panel consolidation; §19 is the FINAL conditioned recommendation and
> is authoritative** — where §0/§5/§14/§16 conflict with §19, §19 wins. The headline change: the candidate
> over-centered a *mid-flight* supervisor and over-claimed it could "re-derive feasibility"; the panel
> re-ranks a **deterministic pre-flight reachability/serverless-ceiling gate as the primary organ**, demotes
> the supervisor to a **dumb arithmetic tripwire that summons the human** (it does not judge feasibility),
> adds a **dead-man's-switch on the supervisor itself**, scopes v2 to a **proven-need core**, and conditions
> "production never validates first" so it cannot certify a platform-emergent bug green locally. Read §19.

---

## 0. How to read this ADR

- Every section follows the same discipline: **(i) what the human practice is and why it existed → (ii) does
  the reason survive when every worker is an AI agent (continuous, parallel, perfect-memory-if-given-durable-
  state, instant-comms, deterministic-where-mechanized, auto-verified) → (iii) the re-derived AI-native design
  → (iv) alternatives compared and the inferior ones rejected with evidence.**
- **Confidence tags:** *Proven* (production evidence) · *Strong* (converges across the research + incident
  record) · *Plausible* (first-principles, not yet field-tested) · *Open* (flagged for the panel / design
  detail phase).
- The accepted invariants are the research foundation's **AN-1…AN-12** (cited inline as `[AN-n]`). They are
  not re-argued here; they are the constraints this design is held to.
- The recommended model is named **OBW-GS** — *Owner · Bus · Worker, governed by a Goal Supervisor*.

---

## 1. Foundational axioms — the AI-native delta

The entire design turns on one observation from the research foundation (§4.1): **human operating models are
saturated with *accidental safety governors*** — fatigue, working hours, the cost of context-switching,
boredom with fruitless work, the social cost of asking "is this even possible?", the slowness of iteration,
the expense of re-planning. These frictions silently enforced *"stop when you are not getting anywhere,"*
*"don't ship what you didn't check,"* *"escalate when stuck."* **An AI workforce removes every one of them.**

Therefore the master design rule, applied everywhere below:

> **For every governor AI deletes, re-introduce the discipline as an explicit, external, fail-closed mechanism
> keyed on the objective. [AN-2]** A practice inherited from human orgs is kept *only* if its underlying reason
> survives the removal of human friction; otherwise it is discarded or re-derived.

The properties we design *for* (the AI workforce's actual capabilities):
- **Continuous + parallel execution** → throughput is not the constraint; *direction* and *convergence* are.
  The dominant failure mode flips from "too slow" to "fast in the wrong direction" (the Discovery incident).
- **Perfect memory — but only if given durable state.** An agent's context is finite and lossy; "perfect
  memory" is an architectural property of the *system* (durable, retrievable state), not of the agent. Designed
  in §6.
- **Instant communication via shared state** → synchronization ceremonies (meetings, standups) lose their
  reason for existing; coordination becomes a read against a durable store.
- **Deterministic execution where mechanized** → gates, linters, and comparators are trustworthy; prose and
  memory are not (the framework's own mechanism-over-prose law).
- **Automated verification** → author≠verifier becomes cheap, continuous, and *more* essential (it is the
  structural defense against reward hacking).

---

## 2. What we challenge, keep, re-derive, or discard (the assumption ledger)

The goal demands that every inherited assumption be challenged. The verdicts (each justified in the cited
section):

| Inherited practice | Why it existed (human) | Survives AI-native? | Verdict | §|
|---|---|---|---|---|
| **Synchronous meetings** | humans can't share state instantly; align mental models | No — state is shared instantly via the bus | **DISCARD** (replace with shared state + structured independent-review *computations*) | 3,9 |
| **Sprint ceremonies (planning/standup/demo/retro)** | batch scarce human attention on a calendar; predictability | Mostly no — re-planning is now free; status is derived | **RE-DERIVE** → evidence-driven cycles bounded by goal-delta, not calendar | 11 |
| **Management layers (manager-of-managers)** | allocate scarce attention; resolve conflict; hold accountability up a chain | No — allocation is dynamic; accountability is a contract | **DISCARD** the layers; **KEEP** a single accountability locus (Project Owner) | 3 |
| **Pull requests as a human review queue** | async review for forgetful serial humans | No — verification is instant + parallel | **DISCARD** the queue function | 9 |
| **PR/merge as the author≠verifier binding point** | bind a second principal at the irreversible act | **Yes** — reward hacking makes it *more* needed | **KEEP** (server-side binding) | 8,9 |
| **Long-lived branches / manual merge** | integration cadence for human teams | Partly — needed as stable env refs, not as a human queue | **RE-DERIVE** → short slice-branches, auto-merge on green, env-pinned promotion refs | 9 |
| **Progressive delivery (canary) watched by humans** | humans squint at dashboards before widening | Reason survives, watcher changes | **KEEP, re-derive** → closed-loop canary with enforced soak + auto-rollback [AN-7] | 10 |
| **Production as where you "really find out"** | staging never perfectly matches prod | No — and it caused the incident | **DISCARD HARD** → local-first validation; prod never validates first | 10 |
| **Project management (Gantt/tickets/status reports)** | track scarce serial humans | No | **DISCARD** → goal contract + goal-delta ledger | 3,5 |
| **Release as a ceremony / sign-off meeting** | gate human attention at the risky moment | No | **RE-DERIVE** → state-gated mechanical promotion [D7] | 10 |
| **Ownership = a person on a rota** | one throat to choke | Reason survives (accountability conserved [AN-1]) | **KEEP, re-derive** → un-delegatable goal contract held by the Project Owner | 3 |
| **Heartbeat-as-health-signal** | "is the process alive?" | **Dangerously insufficient** — the incident agent was alive throughout | **RE-FRAME** → split liveness-tick from the progress-watchdog | 5,7 |
| **Author≠verifier; DoD; §11 review; learning-review** | independent judgment; quality floor | **Yes — strengthened** | **KEEP** (extend to the goal level) | 8 |

Net: the AI-native operating model is **radically flatter and ceremony-free than a human org, but more
heavily *instrumented*.** It deletes coordination overhead and replaces it with mechanical governance keyed on
the objective.

---

## 3. The organizational topology — Founder · Project Owner · Worker · Supervisor

### 3.1 Why a topology at all, and what human structure we reject
Human orgs build hierarchies to route scarce attention and conflict up a chain. With abundant parallel labor
and instant shared state, **a hierarchy of *managers* is pure overhead** — there is no attention to ration and
no mental models to reconcile in a meeting. We therefore reject the management pyramid outright. But two
functions in any org are *not* about scarcity and survive: **(a) single-point accountability for an outcome
[AN-1], and (b) independent judgment that does not mark its own homework (author≠verifier, the supervisor
[AN-3/AN-9]).** The topology is the minimum that provides exactly those two, and nothing else.

### 3.2 The four roles (and only four)

```
            ┌──────────────────────────────────────────────────────────┐
  FOUNDER ──┤ objectives · approvals · credentials · strategic rulings  │
   (human)  │ Class-C gates · feasibility verdicts   (Slick-first, §12) │
            └───────────────┬──────────────────────────────────────────┘
                            │  one persistent surface per project
                 ┌──────────▼───────────┐        invokes (fresh context)
                 │   PROJECT OWNER (PO)  │◄───────────────────────────┐
                 │  holds the GOAL       │                            │
                 │  CONTRACT + ledger    │     ┌──────────────────────┴───────┐
                 │  (un-delegatable [AN-1])│   │  EXTERNAL GOAL SUPERVISOR (GS) │
                 │  re-frame authority   │     │  out-of-loop · goal-delta-keyed │
                 └──────────┬───────────┘     │  liveness≠progress · layered    │
                            │ dispatch         │  trips · halt→summon→re-frame   │
                            │ (G9 main-loop)   └──────────────────▲──────────────┘
              ┌─────────────▼─────────────┐                       │ reads
              │  EPHEMERAL WORKER AGENTS  │  post results         │ (independent
              │  spawn → ground → build → │──────────────────────►│  goal-delta)
              │  self-verify → indep-verify│   RESULT BUS (durable)│
              │  → post → terminate       │   = state + comms +    │
              └───────────────────────────┘     recovery (§4)      │
```

- **Founder (human).** The source of *objectives* and the holder of *irreducible authority*: approvals,
  credentials/consents, strategic/architectural rulings, all Class-C irreversible gates (money/send/publish/
  delete/auth/migrations/contracts/secrets), and — new in v2 — **feasibility verdicts** when the supervisor
  reports a goal may be unreachable. The founder is *summoned with evidence* at boundaries [AN-6]; never polled,
  never the system's clock.
- **Project Owner (PO) — persistent, one per project/goal.** Holds the **goal contract** (objective +
  acceptance criteria + an explicit *reachability assertion* + a *progress/effort budget* [AN-4]) and the
  append-only **goal-delta ledger**. Has **re-frame authority** (can re-order/re-scope work within the
  objective) and the **escalation channel** to the founder. **Does no implementation.** It is the
  un-delegatable accountability locus [AN-1].
- **Worker agents — ephemeral.** Spawned per task by the main loop (honoring the G9 no-self-spawn ceiling),
  given an explicit task contract (objective · output format · tools · boundaries), they ground → build →
  self-verify → hand to an *independent* verifier → post to the bus → **terminate**. They hold no long-lived
  state; their "memory" is the durable ledger (§6). *Challenge to "persistent specialist agents": see §3.4.*
- **External Goal Supervisor (GS).** The new organ. **Not** the worker, **not** the PO's own planning voice —
  an out-of-loop evaluator the PO *invokes with fresh context*, keyed on an *independently measured* goal-delta.
  It is the home of progress governance (§5). Its independence is the whole point [AN-3/AN-11].

### 3.3 Why the Supervisor must be separate from the Project Owner (the subtle, load-bearing point)
A naïve design makes the PO its own supervisor. **Rejected, with evidence:** the PO *holds the frame* (it
authored the goal decomposition); a supervisor that shares the PO's context inherits the PO's frame, exactly as
the 08:42 principle-11 panel inherited the false "5→≥20" frame (`POSTMORTEM-2026-06-28` §E2). The GS is
therefore defined as **a fresh-context evaluation** that re-derives "is this goal reachable from current
inputs?" *without being told the PO's framing as ground truth* [AN-11]. The PO is outside the *worker's* loop
(good enough to watch worker progress); the GS is outside the *PO's* loop (necessary to break the PO's frame).
This nesting — worker ⊂ PO ⊂ GS ⊂ founder — is the structural answer to "who supervises the supervisor": each
layer is frame-independent of the one it judges, and the top layer is the human.

### 3.4 Alternatives for the worker layer — persistent vs ephemeral (rejection with evidence)
| Option | Claim | Verdict |
|---|---|---|
| **A. Persistent specialist agents** (always-on PLOS-mailbox/scoring/discovery agents) | cure context-loss across long runs; own outcomes | **REJECTED as default.** Anthropic's own data: multi-agent ≈15× tokens, worsens coordination/context failure; the G9 ceiling forbids out-of-loop self-spawn anyway; and the headline benefit (not re-deriving attempt #3 at attempt #8) is *better* served by durable state (§6). [Strong] |
| **B. Ephemeral workers + durable attempt-ledger** (recommended) | perfect memory via state, not via liveness | **ACCEPTED.** Cheaper, G9-clean, and the ledger gives true "perfect memory" the agent's context cannot. [Strong] |
| **C. Hybrid: ephemeral workers, *persistent state objects* (PO + ledger)** | persistence where it helps (state), ephemerality where it's cheap (compute) | **ACCEPTED as the precise form of B.** "Persistent Project Owner" = a persistent *state object + a thin always-available surface*, not a long-running LLM. |

**Decision:** workers are ephemeral; persistence lives in *state*, not in *agents*. Reconsider per-workload
only if a specific task proves a benefit the ledger cannot give (none in the record). [Strong]

---

## 4. The execution substrate — the Result Bus (state · communication · recovery in one)

### 4.1 First principles
In a human org, "communication" and "state" and "recovery" are separate concerns (chat, docs, backups). For an
AI workforce with instant shared state, **they collapse into one durable object**: if every step's request and
result is a durable, correlated, idempotent record, then *communication is a write*, *state is the
accumulated records*, and *recovery is a re-read*. This is not a new invention — it is the **P1–P4 block/resume
engine the OS already built and proved** (`DELIVERY-OS-EXECUTION-MODEL-V1.md`; 27 files byte-identical across
Admin+PLOS) — and it is independently endorsed by the durable-execution / saga canon as the correct substrate
for long-horizon autonomous work (research §6 D3). [Proven]

### 4.2 The design
- **One durable run = an ordered set of steps** on a 7-state machine with a SKIP-LOCKED tick, CAS leases, and
  crash recovery (P1). A *blocked* step holds **no lease** — so crash-while-blocked is trivial (re-read state).
- **One await primitive** (P3): a step blocks on a correlation key and resumes when a matching callback
  arrives. The callback **source is pluggable**: system-callback · agent-result · timer · domain-event ·
  human-response. *Every* wait — an API round-trip, a worker finishing, a timer, a founder approval — is the
  *same* edge with a different writer.
- **One completer** (the bus): in-transaction, idempotent (dedup on idempotency key), CAS-guarded. Every source
  posts the same envelope to the same place. This is the communication spine.
- **Agent-result is emit-task → bounded-runner → post-callback**, never engine-self-spawn (G9-clean).
- **The substrate is pluggable** (single Postgres SKIP-LOCKED backend in v2; the engine anticipated this) — so
  the *execution platform* question (§8) is decided *behind* the bus without changing it.

### 4.3 Why this substrate specifically (alternatives rejected)
| Alternative | Rejection |
|---|---|
| **Direct agent-to-agent messaging** (no durable bus) | messages are lost on crash; no recovery; no idempotency → the 10-PR retry-storm has nothing to dedup against. Rejected. |
| **An external queue (BullMQ/pgmq/SQS) as the spine now** | not exercised by two domains at N=1 (Waterline §8); adds ops surface; the proven SKIP-LOCKED backend already works. Defer until a second consumer pulls. |
| **Stateless re-derivation each run** | reproduces context-loss; an agent re-derives prior failed attempts (the within-run loss in the incident). Rejected by [AN-7]. |

**Decision:** the result bus is the durable, idempotent, checkpointed P1–P4 engine; it is the single substrate
for state, communication, and recovery; the execution *platform* sits behind it and is pluggable. [Proven/Strong]

---

## 5. Progress governance — the External Goal Supervisor (the heart of v2)

This is the organ whose absence caused the primary incident. It is designed to make that incident *impossible*.

### 5.1 First principles — the five-discipline convergence
The research foundation (§6) shows five independent fields prescribe the *same* mechanism: watchdogs (liveness
≠ progress), circuit breakers (trip after repeated failure, then cooldown), control-theory anti-windup
(saturated actuator + non-responsive error → stop integrating), SRE burn-rate (alert on the *derivative*), and
double-loop learning (re-Orient on stall). The GS is the engineering embodiment of that convergence.

### 5.2 The design — four mechanisms, layered (none sufficient alone) [AN-5]
The GS reads the goal contract's `acceptance:{metric, op, target}` and the append-only goal-delta ledger
(`progress[]{cycle, value, predicted, fix_ref}`) — **measured independently of the worker that produced the
work** [AN-1/AN-3] — and applies, every cycle:

1. **Liveness tick (necessary, not the safety organ).** A scheduled tick advances ready steps and detects a
   *hung* process. **This is the only thing "heartbeat" should mean.** It answers "is work moving?" — never "is
   the goal getting closer?" Conflating the two is the design error the incident proves fatal (§7).
2. **Progress watchdog (the safety organ).** Computes **dGoal/dEffort** — the rate the goal-delta is closing
   against effort/cost burned. *High effort-burn + flat goal-delta = the trip condition.* Multi-window: a
   short window catches thrash-now; a long window catches "10 PRs / 9 hours, net zero." [AN-1]
3. **Layered hard trips.** *All four bind on the goal, not the slice:* (a) max-iteration/turn cap; (b)
   cost/time budget recorded **write-ahead** [AN-8]; (c) **no-progress / loop-fingerprint** detection (the same
   fix applied repeatedly = a non-idempotent retry storm); (d) an **independent goal-verifier** confirming the
   goal is actually met (defeats reward hacking). A determined loop slips any single guard; together they hold.
4. **Reachability re-derivation gate** [AN-4]. Before a goal starts *and* on a stall, a **fresh-context**
   evaluation re-derives "is the target reachable from current inputs?" *without accepting the PO's frame as
   truth.* This is the formal "does a controller even exist for this spec?" check (supervisory-control theory).

### 5.3 The trip action — halt → summon → re-frame (never "one more fix") [AN-6]
On a trip the GS does **not** retry harder and does **not** auto-redirect via an in-loop panel (rejected — §5.5).
It executes, in order:
1. **HALT** the engineering loop (circuit-breaker OPEN; anti-windup clamp).
2. **SUMMON the founder with evidence** — emit a **Feasibility/Strategy Boundary** Founder Action Package: the
   goal-delta ledger (the flat line, machine-visible), the independent verifier's finding, the reachability
   re-derivation, and the decision the founder must make (redirect / accept-lower-bar / kill). This reuses the
   existing FAP + boundary machinery; the *new* boundary class is `feasibility/strategy`.
3. **RE-FRAME** only on the founder's verdict (double-loop): re-order effort, re-scope the goal, or terminate.
   The critic's correction from the incident is honored here — the halt does **not** mean "stop building"; the
   #218–#227 infra fixes were *necessary in the wrong order*. The re-frame *re-prioritizes against the goal*, it
   does not condemn the work.

### 5.4 The invariant that keeps this safe
**The metric STEERS; it NEVER gates exit** (the OS's H9 hard-won invariant, preserved). A goal still clears
only on `objective_complete` OR a `valid_fap_at_boundary` — the goal-delta is *never* a clear condition (that
would re-introduce the human-gated-terminal infinite-idle bug). The GS *surfaces and halts*; it never silently
declares success. [Strong]

### 5.5 Alternatives for the supervisor's locus (rejection with evidence)
| Option | Verdict |
|---|---|
| **In-loop Stop-hook escalation (the current H9)** | **REJECTED as the locus.** Right *signal* (author≠verifier goal-level finding), wrong *locus*: it lives inside the acting agent and depends on that agent stamping a field in the frame it is captured by. Violates [AN-3]. |
| **In-loop auto-redirect §11 panel** | **REJECTED.** A Stop-hook cannot spawn fresh context; the 08:42 panel proved an in-loop panel inherits the frame. The OS already rejected this (H9c). [Proven] |
| **External goal-delta supervisor, halt→summon→re-frame** (recommended) | **ACCEPTED.** The only option consistent with all five disciplines and the field evidence. The human is the escalation target, not eliminated — but summoned *early with evidence* instead of *noticing late*. [Strong] |
| **Pure human supervision (status quo)** | **REJECTED as primary.** It is the baseline that failed (the founder forced the halt twice, at hour 9). Kept only as the GS's escalation *target*, not as the detector. |

### 5.6 Deadlock detection & strategy switching (sub-components, designed)
- **Deadlock / stall detection:** H5 *all-frontiers-blocked-or-complete* (with parallel workers the frontier is
  a SET; a goal may not exit on one blocked branch while another has live work) + no-progress fingerprinting +
  the circuit-breaker on repeated identical failures.
- **Strategy switching = the re-frame (double-loop), triggered by the watchdog**, executed by the PO under the
  founder's verdict. It is *not* an autonomous in-loop strategy-swapper (that needs frame-independence the loop
  cannot supply). [AN-6/AN-11]

---

## 6. State & memory architecture — "perfect memory" as a system property

### 6.1 First principles
"Perfect memory" is *not* a property of an agent (its context is finite and lossy — the incident's within-run
loss proves it). It is a property of the **system**: durable, append-only, retrievable state. The design gives
the workforce perfect memory by giving it the right *stores*, not by keeping agents alive.

### 6.2 The four stores (each with a single owner and a single write discipline)
1. **The Result Bus / run-step store (system of record for *execution*).** Append-only transitions; CAS-guarded;
   the source of truth for "what happened." (§4)
2. **The Goal-Delta Ledger (per goal).** Append-only `progress[]` + the attempt-ledger `{attempt, hypothesis,
   action, goal_delta_before/after, outcome}`. This is what turns blind repetition into *evidence of
   unreachability* and what the GS reads. It cures within-run context-loss directly. [AN-7]
3. **Three-tier knowledge memory (preserved from v4/F6):** portfolio doctrine (noun-free, every project
   inherits) · project memory (carries a project noun) · derived state (never stored; computed at read). Plus
   the **signals corpus** (`signals.jsonl`) as the append-only lesson feed. *Design fix from the record:* the
   signals corpus has 14×-duplication (one milestone's 12 lessons emitted 41×) — v2 dedups at *write* (a
   content-hash on `{pattern, source-milestone}`), so census counts reflect distinct sources, not re-emissions.
4. **The Config/Infra Registry (single source of truth for environment).** §10.4.

### 6.3 The derived-not-stored rule (preserved, sharpened)
Any fact a peer repo consumes (phase, shipped capabilities, contract status, os_version, **goal status**) is
**derived/generated, never hand-maintained** (§7; incident 5 fired off a stale hand-maintained status column).
LAW (ownership/contracts) is amended slowly by signature; STATE is derived at read. v2 adds *goal-state* to the
derived set: the founder's Slack view of "where is project X" is *computed from the ledger*, never a written
status someone forgets to update. [Strong]

---

## 7. Scheduling, the liveness tick, and why "heartbeat" is re-framed (not adopted as proposed)

### 7.1 The decisive correction
The founder's proposal names a "heartbeat." **The evidence forces a re-frame, and this is one of the most
important design decisions in the ADR.** In the incident, the agent emitted output (PRs) continuously and was
**never hung** — a liveness heartbeat would have glowed green through the entire 9-hour failure. The watchdog
literature is explicit: **liveness ≠ progress** (research, Special Focus §1). A "heartbeat" that monitors
*aliveness* measures precisely the wrong thing for the failure mode that actually hurt.

### 7.2 The design — two distinct organs, never one
- **The liveness tick (scheduling).** A scheduled tick (the clock as a callback source, P3 timer-wake) that
  (a) advances ready/blocked-on-timer steps and (b) detects a genuinely *hung* process (no transition within N).
  **Necessary** for the autonomy strata — *something* must advance work when no human pulls a trigger (the
  inert-`enqueue()` / inert-`setTimeout` gaps in the record). It answers "is work moving?"
- **The progress watchdog (governance).** The GS's dGoal/dEffort organ (§5.2.2). It answers "is the *goal*
  getting closer?" It is the safety organ; the tick is not.

**Decision:** adopt a liveness tick/scheduler for advancement; **do not** build a "heartbeat" that is read as a
progress/health signal. The progress signal is the GS's goal-delta, external and independent. [Strong —
directly de-risks the primary incident.]

---

## 8. The execution platform — Vercel vs GitHub Actions vs a dedicated worker

### 8.1 The forcing evidence
The incident's binding constraint was Vercel's **300s `maxDuration`** killing a long job that persisted
all-or-nothing; and the invoice-drain failure was an in-process `setTimeout` **inert on serverless** (it freezes
between requests). The recurring lesson (`signals.jsonl`, handoff §7): *long-horizon work under a short-window
or in-process substrate persists nothing.* The platform is a **first-class design decision**, not an
operational detail.

### 8.2 The three candidates, on the axes that matter
| Axis | Vercel (serverless) | GitHub Actions | Dedicated worker (Node process / queue consumer) |
|---|---|---|---|
| Long-running (>300s) | **NO** (300s hard kill; 25–60s on Hobby) | **YES** (6h job cap) | **YES** (unbounded) |
| Scheduled/cron | limited (Hobby caps crons) | **YES** (cron schedules; already the deploy substrate) | YES (own scheduler) |
| Durable timers / between-request state | **NO** (freezes; `.unref()` timers die) | N/A (ephemeral job) | **YES** (real process) |
| Persistence of the *runner* | none | none (cold each job) | **YES** |
| Ops overhead | lowest | low | **highest** (a host to run/monitor/patch) |
| Already in the substrate | yes (web + APIs) | yes (CI + deploy/trigger) | no (`packages/queue`/`apps/worker` are placeholders) |
| Best at | request/response surfaces (UIs, APIs, the bus completer endpoint) | scheduled + batch orchestration, long jobs, the GS runs | true persistent daemons / high-frequency ticks |

### 8.3 The decision — a hybrid with a hard platform boundary
**Reject "one platform for everything."** Re-derive by *workload shape*:
- **Vercel** keeps the **request/response surfaces**: the product UIs, the API routes, and the **result-bus
  completer endpoint** (a sub-300s POST). It is excellent here and stays.
- **GitHub Actions** runs the **long-running orchestration, the scheduled liveness tick, and the External Goal
  Supervisor** — *now*. Rationale: it has no 300s ceiling, it is *already* the deploy/trigger substrate, the
  300s-vs-6h gap is the decisive field evidence (handoff §6 named GH Actions the recommended lane), and it adds
  no new hosting surface.
- **A dedicated worker** is the **deferred** option, earned only when a workload needs *true persistence or
  high-frequency ticks* GH Actions' per-job cold-start cannot serve (e.g., sub-minute supervision at scale). The
  `packages/queue`/`apps/worker` placeholders are where it lands. *Waterline:* don't build it before a workload
  pulls.
- **The hard boundary rule (a new kernel doctrine):** *no job whose worst-case runtime can exceed the serverless
  ceiling may run behind a serverless route.* A pre-merge lint flags any `maxDuration`-bounded route that calls
  a known-long operation (the exact `runDiscovery` mismatch). [Strong]

Because the result bus (§4) is platform-pluggable, this boundary is enforced *behind* the bus: a step's
executor is annotated with its lane, and the bus dispatches long lanes to GH Actions, short lanes to Vercel.
Changing lanes later (to a dedicated worker) changes a dispatch annotation, not the model.

---

## 9. Verification & autonomous reviews

### 9.1 Author≠verifier — kept, server-bound, extended to the goal
- **Slice level (kept, proven):** the binding gate is the required CI `verify-coverage` check + branch
  protection + CODEOWNERS at the PR/merge (D9) — model-independent, un-bypassable, semantic `impl_fingerprint`
  (D8). The local hook stays a non-blocking advisory (D9). This is the framework's flagship control and it
  *worked* in the incident — it even produced the correct goal-level finding.
- **Goal level (new, [AN-9]):** the independent verifier's *goal-level* finding (`goal_metric_reachable:false`)
  is routed to the **GS**, not to an in-loop hook — giving the goal-level finding the teeth the slice-level one
  has, in the right (external) locus.
- **Verifier-must-be-evaluated (preserved):** a verifier earns the right to *gate* only after it is itself
  calibrated; an un-evaluated verifier may only *advise* (the EXECUTION-MODEL-V1 §10.5 ladder: exists →
  reachable → validated → observable → trusted → enabled). This is the defense against a confident-wrong gate.

### 9.2 §11 consequential review — kept, but never auto-redirect-in-loop
Blind-first, consolidated-second, disagreements surfaced (the mechanism that caught the pool-acquire vs
connection contradiction). **Two hard rules carried from the incident:** (i) lens-independence ≠
premise-independence — every §11 panel on a goal-feasibility question MUST carry a **re-derive-the-premise
lens** that does not accept the stated frame [AN-11]; (ii) panels are **human-triggered or event-fired, never
wired onto a Stop-hook as an auto-redirect** (H9c). Panel economics (§11 caps, refusal rules) prevent the
75-lens-run over-fire.

### 9.3 Reviews feed *gates*, not prose
Every postmortem/learning finding compiles to a *mechanism* (a hook, lint, gate, or doctrine line) or is
explicitly closed as "no framework change" — never left as un-actioned prose (mechanism-over-prose law; the
census-detector-inert and 175-overdue misses are the warnings).

---

## 10. The delivery pipeline — local-first validation through a real environment ladder

This section answers the founder's explicit, central instruction: **work is completed, tested, and validated
locally before promotion; production must never be the primary validation environment.** The incident violated
this directly — the 300s ceiling and the all-or-nothing rollback were *discovered in production* because there
was no environment that reproduced them first.

### 10.1 First principles — why "prod finds it" happened and how to kill it
Human teams tolerate "we'll find it in prod" because building prod-faithful lower environments is expensive
*human* effort. For an AI workforce that cost collapses: an agent can stand up a prod-faithful environment and
run real validation cheaply and repeatably. So the human excuse evaporates and the rule becomes absolute:
**every change is proven on a prod-faithful surface before it can be promoted; production validates nothing
first.** [AN-7, Strong]

### 10.2 The environment ladder (four rungs, each a gate)
```
 LOCAL (dev)        →   QA (ephemeral)     →   STAGING (prod-mirror)  →   PRODUCTION
 born-correct env       isolated, real-DB      prod-faithful: same       state-gated promotion
 real running thing     e2e + author≠verifier  pooler mode, schema,      progressive + closed-loop
 real concurrency       independent verify     migration-parity, soak    canary + auto-rollback
 real DB shape          on the REAL surface    cross-system seam e2e      forward-only migrations
   │  gate: local-validate │  gate: verify+QA   │  gate: staging-soak +   │  gate: deploy-auth state
   │  (the running thing)   │  (real surface)    │  migration-parity +     │  (D7) + lane scope
   ▼                        ▼   seam round-trip   ▼  cross-system green     ▼
```
- **LOCAL** — *the* validation environment. Born-correct env (config from explicit file+flag, never ambient —
  the prod-DB-from-blank-env incident); worktrees day 1; the local DB mirrors prod *shape* (pooler mode,
  applied-migration set, schema) so a local pass *means something*. The change must reproduce on the **running
  thing under realistic conditions** (real concurrency — the pooler saga; real DB — the silent-data-loss
  verifier finding) before it leaves local. [AN-7]
- **QA (ephemeral)** — isolated, real-DB, **author≠verifier on the real application surface** (not raw-SQL
  bypass — the S37 lesson); tag-scoped teardown + cap-independent assertions (the shared-DB flakes); tests must
  *bite* (mutation).
- **STAGING (prod-mirror)** — the environment the incident *lacked*. Prod-faithful: identical pooler mode,
  Vercel scope, the **full applied-migration ledger** (the 0035/`provenance` and 0029/0032 drift), a real
  **cross-system seam round-trip** (the invoice-delivery zero-delivered failure), and an **enforced soak
  window** [AN-7]. Long-lane jobs (>300s) run here on their real platform (§8) so the 300s ceiling is hit *here*,
  never first in prod.
- **PRODUCTION** — promotion is **state-gated, not person-gated** (D7): authorized only when verification +
  approvals + founder-review-if-founder-verifiable + merge-to-main + CI green + lane scope are all satisfied,
  mechanically (`deployment-auth`), with a one-time founder-set lane policy + a FREEZE kill-switch. Deploy ≠
  release (flags); progressive canary is **closed-loop** (the agent watches golden signals and auto-rolls-back);
  **forward-only** migrations authorized in-lane and applied *before* the code deploy; a **migration-parity
  gate** asserts prod's applied-ledger equals the repo before promotion.

### 10.3 Branch & CI/CD strategy (re-derived)
- **Human practice rejected:** long-lived feature branches as an async human review queue. **Reason gone** —
  verification is instant.
- **Re-derived:** short-lived **slice branches** off an integration branch (DEV-first, D1), **auto-merged on
  green** for non-Class-C, non-founder-verifiable slices (this *adopts* what D3 deferred — justified because in
  v2 the binding server-side gate + a CI-bot distinct actor *preserve author≠verifier* without a human in the
  routine merge; the founder's irreducible role stays on Class-C and founder-verifiable changes only, D6). The
  **environment refs** (qa/staging/prod) are pinned promotion targets, not developer branches — answering the
  D4 dev-collapse question pragmatically: keep a stable integration ref, drop the *human-queue* role of
  branches.
- **CI/CD:** the binding `verify-coverage` gate + branch protection (server-side, D9) is the spine; the
  **config-gate** (§10.4) runs pre-build and fails closed listing *all* missing keys at once; a **deploy
  pre-flight** runs the full chain (config + build-shape + migration-state) in **one** pass so the founder never
  hits the N-cycle one-secret-at-a-time saga.
- **Rollback:** deploy≠release means rollback is a flag/traffic switch, not a redeploy; restoreable state +
  the rollback ref are captured before any irreversible change; a post-deploy smoke (concurrency repro) is the
  checked-in guard.

### 10.4 The configuration platform (already built, promoted to a v2 invariant)
The field-proven **config-doctor + declarative config-registry + fail-closed pre-build config-gate** (it
failed closed listing all 4 missing keys at once in rumah-admin PR #17) becomes a v2 invariant: a single
source of truth mapping every key → owner (vercel-env/supabase/github-secret) + validation + per-env required
flag + redacted example + exact fix; it records **per-app pooler mode + rationale** (the Admin-session vs
PLOS-transaction inversion that drifted silently), the canonical Vercel scope (the personal-vs-team drift), and
Supabase refs. Secrets live in platform stores, **never in working trees** (the secrets-in-`.env` exposure).
The env-schema **blank→undefined coercion** doctrine (the empty-optional zod crash) is inherited by every
capability. [Proven]

---

## 11. The AI-native sprint / cycle model — evidence-driven, not calendar-driven

### 11.1 The challenge
Human sprints exist because re-planning is expensive, human attention must be batched, and predictability needs
a calendar. **All three reasons die** when planning is free, attention is abundant, and status is derived. A
fixed two-week sprint applied to an AI workforce is pure ceremony — worse, it *hides* the failure mode that
matters: a sprint can be "on track" (busy) while the goal-delta is flat (the incident).

### 11.2 The re-derived model — the Evidence Cycle
A "sprint" is replaced by an **Evidence Cycle**: the smallest loop that *moves a measured goal-delta or
escalates.* It is bounded by **evidence, not time**.
```
  GROUND (read canonical) → SLICE (thinnest vertical increment toward the goal)
    → BUILD → VERIFY locally (real surface) → PROMOTE through the ladder
    → MEASURE goal-delta (independent) → { advanced? continue : STALL → GS halt→summon→re-frame }
```
- **The cycle closes on evidence:** a verified goal-delta movement (continue) or a no-progress trip (escalate).
  There is no "sprint end date"; there is "the goal moved, or it didn't and we stop and ask."
- **Ceremonies, re-derived:**
  - *Planning* → continuous, free; the PO re-plans each cycle against the ledger. No planning meeting.
  - *Standup* → **deleted**; status is a derived read of the ledger (the founder queries it via Slack any time).
  - *Demo* → the **Founder Review Package**, summoned only for founder-verifiable changes (D6), not scheduled.
  - *Retro* → the **event-fired learning-review** (L0 continuous capture / L1 checkpoint / L2 full review),
    mechanized, not calendar (the 175-overdue miss is why it is event-fired, and the 14×-fanout is why L-levels
    rate-limit it).
- **The cycle has a hard floor:** *no cycle may report "done" while the goal-delta is flat and unexplained* —
  that is precisely the GS trip. Busy-ness is never progress (§7).

### 11.3 Alternatives rejected
| Option | Rejection |
|---|---|
| **Fixed-length sprints** | optimize for calendar predictability the AI workforce doesn't need; mask flat-goal-delta as "on track." Rejected. |
| **No cycle at all (one giant goal run)** | reproduces the 9-hour unbroken loop; nothing forces a goal-delta check. Rejected. |
| **Evidence Cycle (recommended)** | each cycle forces an independent goal-delta read; the GS sits at the cycle boundary. Accepted. [Strong] |

---

## 12. The Founder interaction model — Slack-first, summoned-with-evidence

### 12.1 First principles
The founder is the scarcest resource and the only holder of irreducible authority. The design goal is to make
the founder's surface **small, evidence-rich, and pull-not-push**: the founder is *summoned* at genuine
boundaries with everything needed to decide in zero-technical-knowledge terms, and can *query* state any time —
but is never the system's clock and never the thing that must *notice* a problem [AN-6].

### 12.2 The model
- **One persistent surface per project = the Project Owner.** The founder talks to the PO, not to
  implementation agents. The PO holds the goal and the ledger and is always available to answer "where are we?"
  from derived state.
- **The founder's irreducible actions** (the only ones the model keeps on the human): objectives (start/redirect
  a goal), approvals at the one operational gate (money/comms-out), credentials/consents, strategic/architectural
  rulings, Class-C irreversible gates, and **feasibility verdicts** when the GS summons. Everything else is
  autonomous or checked-in.
- **Boundaries are FAPs** (the existing envelope): status · what's done · what remains · *why I stopped* · exact
  zero-tech steps · rollback · the one-line resume. The new `feasibility/strategy` boundary embeds the goal-delta
  ledger + the reachability re-derivation so the founder decides redirect/accept/kill on evidence.
- **Slack-first (future-facing design, built-toward not built):** the founder's primary channel is Slack to the
  persistent PO. The PO posts: boundary summons (with the FAP), daily/threshold digests (pull-by-exception, not
  a standup), and answers to ad-hoc "status?" queries from derived state. Implementation agents never message
  the founder directly. The architecture supports this *today* because (a) state is derived (so "status?" is a
  query, not a written report) and (b) boundaries are already structured FAPs (so a Slack summons is a thin
  render of an existing artifact). The Slack surface is a *transport* over the existing PO/FAP model — no model
  change needed to add it later. [Plausible→Strong on the architecture; the transport itself is deferred.]

### 12.3 The north star — the Founder Absence Test
The model's success is measured by the OS's own ratified bar: the founder ratifies a bounded objective +
envelope, *leaves*, and on return reconstructs the entire story from standing derived reports — work advanced
within guardrails, every gate enforced, kill-switch honored, zero boundary crossings, and **the GS halted-and-
summoned rather than thrashing** if a goal proved unreachable. Passing this earns the "AI Operating System"
noun (honestly unearned until then — `AUTONOMOUS-EXECUTION-DEFINITION.md`).

---

## 13. Capability lifecycle, inheritance, learning loops, and Company OS integration

### 13.1 Capability lifecycle — built ≠ operating [AN-10]
A capability climbs the governance ladder: **exists → reachable → validated (eval suite, author≠verifier) →
observable (emits to the bus) → trusted (calibration holds on real data) → enabled (may gate autonomously).**
*Built is never allowed-to-gate.* The recurring "verified but inert" failures (census-detector with zero CI
integration; the ~90%-empty capability registry; "nothing calls `enqueue()`") are closed by a **built-means-
operating gate**: a capability cannot be marked done while no mechanism fires it.

### 13.2 Inheritance
Base mints versions (F1); consumers adopt by **pin** at named moments; the scaffolder + version boundary make
inheritance mechanical; promotion into the base is itself a §11 consequential decision (recursive). The
no-backflow lint keeps project nouns out of the agnostic core. *Unchanged from v4 — it works.*

### 13.3 Learning loops
L0 continuous capture (`signals.jsonl`, dedup-at-write) / L1 checkpoint / L2 full review; census-detector
flags patterns recurring across ≥3 *distinct* sources; promotion bar = observed-failure OR second-consumer-pull
(Waterline); findings compile to mechanisms, not prose. The loop is recursive: the GS's feasibility findings
and the postmortems feed it.

### 13.4 Company OS integration
Delivery OS is the **how**; `ecosystem-architecture` owns the **what** (registries/ECRs). The products integrate
over the **result bus** with **executable seam contracts** read-canonical-first [boundary-first]: Admin = system-
of-record/state (emits facts, never ranks), PLOS = communication/LLM, The Room = ranking/attention (consumes
facts). PII never crosses the seam (tenantId-only). The GS and the Evidence Cycle are *per-project* and compose
across the portfolio — each project gets a PO; the founder's Slack surface aggregates them.

### 13.5 Scalability
The model scales because its unit is the *goal*, not the team: N projects = N persistent POs + a shared bus +
one GS pattern instantiated per goal + one founder surface aggregating boundaries. There is no management layer
to scale, no meeting that grows with headcount. The constraints that *do* scale are compute/cost (bounded by the
write-ahead budgets [AN-8]) and the founder's boundary-handling rate (minimized by D6 founder-verifiable
narrowing + the summon-with-evidence design). [Plausible→Strong]

---

## 14. The recommended operating model — OBW-GS (one model)

**Name:** *Owner · Bus · Worker, governed by a Goal Supervisor* (**OBW-GS**).

**The model in one paragraph.** Each objective is owned by a **persistent Project Owner** that holds an
un-delegatable goal contract (objective + acceptance criteria + reachability assertion + write-ahead budget) and
an append-only goal-delta ledger. The PO dispatches **ephemeral worker agents** (main-loop-spawned, G9-clean)
that ground → build → verify-on-the-real-surface (author≠verifier, server-bound) → post to a **durable result
bus** (the proven P1–P4 engine; state + communication + recovery in one) and terminate. The segment is governed
by an **External Goal Supervisor** — frame-independent of the PO — that watches the *goal-delta, not activity*,
separates a **liveness tick** (advancement) from a **progress watchdog** (dGoal/dEffort), applies **four layered
trips**, and on a stall **halts → summons the founder with evidence → forces a feasibility re-frame**, never
"one more fix." Work is validated **locally on a prod-faithful surface and promoted through QA → staging →
production**, each rung a gate, production never validating first; promotion is **state-gated**, releases are
**flag-decoupled, closed-loop canaried, and auto-rolled-back**. Long-horizon work runs on a **non-serverless
lane (GitHub Actions now; a dedicated worker later)** behind the bus, never behind a 300s route. The founder
interacts **Slack-first with the Project Owner**, summoned with evidence at boundaries, and the whole thing is
measured by the **Founder Absence Test**. Capabilities climb a *built-≠-operating* ladder; learning compiles to
*mechanisms, not prose*; the configuration platform is the single source of environment truth.

**Why OBW-GS and not the alternatives (the decisive rejections, consolidated):**
1. **vs. the in-loop H9 supervisor** — rejected: right signal, wrong locus; an in-loop watcher inherits the
   frame (08:42, proven). OBW-GS externalizes the watcher. [Proven]
2. **vs. persistent specialist agent fleets** — rejected as default: ~15× cost, worse coordination, G9-blocked;
   durable state gives "perfect memory" more cheaply. [Strong]
3. **vs. a single platform (all-Vercel)** — rejected: the 300s ceiling *is* the primary incident; OBW-GS puts
   long work on a non-serverless lane behind the bus. [Proven]
4. **vs. calendar sprints** — rejected: they mask flat-goal-delta as "on track"; OBW-GS's Evidence Cycle forces
   an independent goal-delta read each cycle. [Strong]
5. **vs. production-as-validation (status quo)** — rejected by the founder's directive and the incident; OBW-GS
   makes local-first on a prod-faithful surface an absolute gate. [Strong]
6. **vs. a "heartbeat" health signal** — rejected: liveness ≠ progress; the agent was alive throughout the
   failure. OBW-GS splits the two organs. [Strong]
7. **vs. auto-redirect in-loop panels** — rejected (and already rejected by the OS, H9c): a Stop-hook cannot
   spawn frame-independent context. [Proven]

**What OBW-GS preserves (anti-regression):** author≠verifier server-side binding (D9), semantic VERIFY (D8),
the §11 blind-panel-with-surfaced-dissent, the boundary-is-success envelope (§16), state-gated deploy (D7),
the config platform, three-tier memory, the no-backflow lint, version-pin inheritance. *v2 adds the goal-level
organ; it does not weaken the slice-level floor that already works.*

---

## 15. Trade-offs, risks, and the open questions for the design-detail phase

### 15.1 Trade-offs priced
- **Earlier halting vs genuine deep work** — multi-window detection + escalate-to-human (never silent kill)
  preserves the "keep going, it's genuinely hard" option. [AN-6]
- **Bounded autonomy now vs full out-of-loop autonomy later** — OBW-GS ships *bounded* autonomy honestly (GS
  and tick on GH Actions, workers main-loop-spawned) rather than waiting on a runtime that may not come; the
  AI-OS noun stays reserved for the Founder Absence Test.
- **Mechanism coverage vs ceremony cost** — every new goal-keyed mechanism is evidence-rate-limited (§11
  economics) to avoid the next 75-lens over-fire.
- **Determinism vs intelligence in the GS** — hard caps (dumb, reliable) backstop the fallible feasibility
  heuristic, so a wrong reachability call cannot run forever.

### 15.2 Top risks to the program
- **R1 — re-instantiating frame-lock** by sliding the GS back into the loop. *Mitigation:* AN-3 is
  non-negotiable; the GS runs fresh-context, out-of-loop, on a different platform lane.
- **R2 — building the GS before the substrate it watches runs.** *Mitigation:* sequence the bus + liveness tick
  + ledger before the GS.
- **R3 — over-building (Waterline).** The record already shows a large designed-but-inert surface. *Mitigation:*
  build OBW-GS against the *one proven failure*, not an imagined fleet; defer the dedicated worker and persistent
  agents until pulled.
- **R4 — self-host blind spot** (a self-modifying OS blinding its own gates — recorded twice). *Mitigation:*
  control-plane markers + regression guards extend to all v2 tooling.
- **R5 — cost blindness at higher agent volume.** *Mitigation:* write-ahead cost accounting [AN-8] + the cost
  instrument are prerequisites, not afterthoughts.

### 15.3 Open questions (explicitly deferred to the design-detail phase / the panel)
- **O1** — The GS's runtime embodiment given G9: a scripted/gated GH-Actions runner reading state + escalating
  (buildable now) vs awaiting an out-of-loop agent capability. *Lean: scripted runner now.*
- **O2** — Is the Project Owner a thin always-available agent surface or purely a state object the main loop and
  GS read? *Lean: state object + thin surface.*
- **O3** — The exact reachability-test method (LLM heuristic re-derivation must be paired with hard caps; the
  heuristic can be wrong).
- **O4** — No-progress false-positive tuning (multi-window thresholds; what counts as a "loop fingerprint").
- **O5** — Auto-merge-on-green scope (which classes are safe to merge with a CI-bot distinct actor; D3 was
  deferred — v2 proposes adopting it for non-Class-C/non-founder-verifiable, but the exact class-guard needs the
  panel).
- **O6** — Staging fidelity cost: how prod-faithful must staging be before the cost outweighs the residual
  prod-risk it removes.

---

## 16. Decision record (the ADR's formal output)

| # | Decision | Status | Confidence | Basis |
|---|---|---|---|---|
| **OM-1** | Topology = Founder · persistent Project Owner · ephemeral Workers · External Goal Supervisor (OBW-GS) | RECOMMENDED | Strong | §3; [AN-1/3] |
| **OM-2** | The result bus (P1–P4) is the single durable substrate for state+comms+recovery; platform pluggable behind it | RECOMMENDED | Proven | §4 |
| **OM-3** | Progress governance = External Goal Supervisor, goal-delta-keyed, layered trips, halt→summon→re-frame | RECOMMENDED | Strong | §5; [AN-1/3/4/5/6] |
| **OM-4** | "Heartbeat" re-framed into a liveness tick (advancement) + a separate progress watchdog (safety) | RECOMMENDED | Strong | §7 |
| **OM-5** | Execution platform = hybrid; long work on GitHub Actions now (dedicated worker deferred); never >300s behind a serverless route | RECOMMENDED | Strong | §8 |
| **OM-6** | Memory = system property (durable stores + attempt-ledger), not persistent agents | RECOMMENDED | Strong | §6, §3.4 |
| **OM-7** | Delivery pipeline = local-first validation on a prod-faithful surface, promoted local→QA→staging→prod; prod never validates first | RECOMMENDED | Strong | §10; founder directive |
| **OM-8** | Branch/CI-CD = short slice-branches, auto-merge-on-green (non-Class-C), env-pinned promotion refs, server-side binding gate, one-pass deploy pre-flight | RECOMMENDED | Strong (O5 open) | §10.3 |
| **OM-9** | Sprint model = evidence-driven Evidence Cycle, ceremonies deleted/re-derived | RECOMMENDED | Strong | §11 |
| **OM-10** | Founder model = Slack-first to the Project Owner, summoned-with-evidence, Founder Absence Test as north star | RECOMMENDED | Plausible→Strong | §12 |
| **OM-11** | Verification extends author≠verifier to the goal level; §11 never auto-redirect-in-loop; reviews feed gates | RECOMMENDED | Strong | §9 |
| **OM-12** | Config platform + built-≠-operating capability ladder + dedup-at-write learning loop | RECOMMENDED | Proven/Strong | §10.4, §13 |
| **OM-R1** | REJECT in-loop H9 locus, persistent-fleet-as-default, all-Vercel, calendar sprints, prod-as-validation, heartbeat-as-health, auto-redirect panels | REJECTED with evidence | Proven/Strong | §14 |

---

## 17. Status, honest limits, and the path to ratification

- **This ADR is a CANDIDATE design.** It implements nothing. Per the framework's own §11, **a consequential
  architectural decision may not be concluded by a single agent — including this author.** The recommended
  model (OBW-GS) is therefore submitted to an **independent blind panel** (§18, appended below) whose dissents
  are surfaced, then a final consolidation. The founder's ratification is the merge gate.
- **Honest limit (the same §12 discipline):** this document proves the design is *coherent, evidence-grounded,
  and incident-faithful*; it does not prove it is *correct in build* — that is the design-detail phase + the
  proof slices (riskiest-unknown-first: the bus + ledger, then the GS, per R2).
- **The single claim to hold the design to:** replay the Discovery timeline against OBW-GS and the
  `floor=8`-flat-for-9-hours line is *machine-visible and halts-and-summons by 02:06* — from outside the loop,
  with no human required to *notice*. If a design cannot pass that replay, it has not solved the problem this
  program exists to solve.

---

## 18. The independent blind panel — consolidation and surfaced dissents

Per Governance §11 (a consequential architectural decision may not be concluded by a single agent — including
this author), the recommended model was submitted to **four independent lenses, blind to each other**, each
instructed to refute rather than agree. This section consolidates their findings and **surfaces every
disagreement** (§11: a buried disagreement is a process failure). The next section (§19) is the consolidated
recommendation that results.

### 18.1 Per-lens verdicts
| Lens | Verdict | Its sharpest contribution |
|---|---|---|
| **Lead-architect** | SOUND-WITH-CONDITIONS | The supervisor has **no supervisor of its own liveness** (BLOCKER); the 02:06 halt is verifier-*judgment*-dependent, not mechanical; the PO's autonomous re-frame must be *gated on a moving goal-delta*. |
| **Adversarial critic** | SOUND-WITH-CONDITIONS | The frame-lock is **relocated to the metric-definition seam**, not broken (§3.3 contradicts §5.2); "Proven" is borrowed for an inert composition; auto-merge **overrides the D3 board deferral** inside the author's own ADR. |
| **Re-derive-the-premise** | SOUND-WITH-CONDITIONS | On this harness the GS **cannot re-derive feasibility** — that is the 08:42 frame-trap relocated to GitHub Actions (BLOCKER); the incident is **primarily evidence for a *pre-flight* static gate**, not the mid-flight watchdog (BLOCKER). |
| **Platform / ops** | SOUND-WITH-CONDITIONS | "Production validates nothing first" would have **certified the incident's bug GREEN locally** (BLOCKER); the data-plane rollback story is false without expand/contract (BLOCKER); the GS shares a **failure domain** with the substrate it watches. |

**Unanimous:** the *spine* is right — external goal-keyed governance is a real and necessary organ; **liveness ≠
progress** (the single strongest decision, all four endorsed it); metric-steers-never-gates-*success*; long
work off the serverless ceiling; the human is the frame-breaker / escalation target; reject the in-loop
auto-redirect panel; the result bus is the right pluggable substrate and the dedicated worker is correctly
deferred (all four explicitly rejected "worker from day one"). **No lens called the model UNSOUND.** The
disagreements are about *center of gravity, confidence, scope, and honesty of claims* — not about the
direction.

### 18.2 Consolidated conditions (C1–C13) — load-bearing, ordered by severity
Each condition cites the lens(es) that raised it. C1–C4, C10, C11 are BLOCKER-class.

- **C1 [BLOCKER · re-derive, lead-arch, critic] — The supervisor is a *dumb arithmetic tripwire that summons the
  human*; it does NOT "re-derive feasibility with fresh judgment."** On the G9 harness any reachability
  re-derivation is an LLM fed a prompt = the goal's framing, and the 08:42 panel proved a fresh-context
  evaluator *inherits the premise from its problem statement*. **Strike §3.3's "the GS re-derives reachability
  without being told the framing" and §5.2.4-as-GS-judgment.** The arithmetic (liveness tick, dGoal/dEffort, hard
  caps) is buildable and frame-free; the *judgment* (is the goal reachable / re-framed) belongs to the **human**,
  summoned early with evidence. Any LLM reachability heuristic is advise-only, premise-fallible, never a decider.

- **C2 [BLOCKER · re-derive (with lead-arch on the 02:06 over-claim)] — Re-rank the PRIMARY organ: a deterministic
  *pre-flight* reachability + serverless-ceiling gate, with the mid-flight watchdog as BACKSTOP.** Both damning
  facts in the incident — `runDiscovery` > 300s all-or-nothing, and an all-time prod high of 8 (*never* exceeded)
  — were **statically knowable at hour 0**. The §8.3 lane-lint + a pre-execution feasibility/precedent check
  would have **prevented the goal from ever starting** (zero PRs, zero founder interrupt) — strictly cheaper than
  halting at hour ~6. The dGoal/dEffort watchdog remains necessary, but for the *genuinely-not-statically-knowable*
  class (its real justification is the five-discipline convergence, which is about that class). **Restate the §17
  acceptance bar** from "machine-visible halt by 02:06" to: *"the goal **never starts** when unreachability is
  statically knowable; for the residual class, the unbounded 9-hour grind is impossible — a bounded
  arithmetic trip halts and summons the human, from outside the loop."* The literal 02:06 mechanical halt is
  **not** delivered (the real verifier wrote prose, not a structured field); the *bounded* halt is, and that is
  the sufficient win.

- **C3 [BLOCKER · lead-arch + platform] — The supervisor needs its own dead-man's-switch on a *different failure
  domain*.** AN-3 must extend from *logic* independence to *infrastructure* independence: a watchdog on the same
  GitHub account/minutes/best-effort-cron as the substrate it watches goes dark exactly when a runaway burns
  money (the recorded **76-commit billing-outage stall** is the precedent). Add an independent dumb timer (a
  Vercel cron or external uptime monitor, a *different* lane) that alarms the founder if the GS has not posted a
  tick within N. Downgrade OM-5 to **Strong-with-conditions**. *(This clears the Waterline bar because the
  billing-stall is a recorded failure, not a hypothetical — see the surfaced disagreement in §18.3.)*

- **C4 [BLOCKER · critic (lead) + lead-arch + re-derive] — Close the metric-definition frame-lock.** The GS
  reads `acceptance:{metric, target}` *the PO authored* and re-derives reachability *of that target* — so it is
  frame-independent on **target reachability** but frame-**captured** on **metric selection**. Had the contract
  named the proxy the loop was actually moving (per-lead qualify-probability) instead of the true objective
  (lead volume), `dGoal/dEffort` would have read **healthy** and the GS would **never trip**. Two fixes,
  both required: (a) the GS **re-probes the objective metric from its canonical external source under its own
  identity** each cycle (a worker-appended value is steering-only — the H9 `goal-progress.mjs` main-loop write
  cannot be what the GS trusts); (b) a **metric-fitness check at goal-contract authoring** — the acceptance
  metric must be independently argued to be the objective itself or a verified leading proxy (this is the one
  place the original frame can still enter, and it is currently unguarded).

- **C5 [BLOCKER-adjacent · critic + re-derive + lead-arch] — Strip over-claimed confidence; separate
  *necessity-of-function* from *correctness-of-embodiment*.** The five-discipline convergence proves the *organ*
  is needed (Strong); it does **not** prove OBW-GS's *embodiment* is correct (the ADR concedes it "does not prove
  it is correct in build"). The result bus is **Proven as a workflow primitive** but **Plausible as the
  goal-delta substrate a GS reads** — that composition has never run ("nothing calls `enqueue()` yet"), and the
  ADR's own *built ≠ operating* law (AN-10) convicts the "Proven" tag on the extended claim. Re-tag the decision
  table: function = Strong; this-embodiment = **Plausible until the proof-slice runs**.

- **C6 [BLOCKER · critic] — Restore the D3 board deferral; remove auto-merge-on-green from the recommended set.**
  Adopting a board-*deferred* decision inside the author's own ADR is the exact move §17 forbids (a single agent
  concluding a consequential decision). "A CI-bot distinct actor preserves author≠verifier" conflates a
  *mechanism* (automated coverage) with *independent judgment* — and the incident proves green ≠ correct (every
  slice was green for 9 hours). Auto-merge is a **separate autonomy-increasing consequential decision** that
  deserves its own panel. Route it to DEFER (status quo D3).

- **C7 [critic] — Fix "the metric steers, never gates."** Honest restatement: the metric **never gates
  *success*** (it can't silently declare a goal done — the H9 infinite-idle protection holds), **but it DOES
  gate *continuation*** (it halts the loop and summons the founder). Say so plainly; the "never gates" phrasing
  is true only under a private definition.

- **C8 [re-derive + lead-arch + critic] — Scope v2 to the proven-need core; the "complete operating model" is the
  Waterline/AN-12 risk the ADR itself warns against.** The incident pulls for exactly: **(i)** the pre-flight
  reachability + serverless-ceiling gate (C2); **(ii)** the external arithmetic watchdog → halt → summon-human
  (C1) with its dead-man's-switch (C3); **(iii)** the goal-delta ledger *amplifying the already-built H9 M1
  ledger* on the existing bus (not re-founding it); **(iv)** goal-level author≠verifier routing; **(v)** the
  pipeline hardening (C10–C12). **Defer** as build-on-pull: the 4-role *topology framing* (the "Project Owner" is
  a **state object** ≈ the existing M1 ledger, not an org-chart role), the Evidence-Cycle sprint replacement, the
  Slack-first transport, and auto-merge. Re-assert the **de-risk build sequence** (bus/ledger → watchdog →
  pre-flight gate → goal-level verifier) as a first-class output so ratification authorizes the *core*, not the
  whole surface.

- **C9 [lead-arch] — Gate the Project Owner's autonomous re-frame on a moving goal-delta.** The incident *was* a
  9-hour sequence of legitimate-looking "re-order work within the objective" moves (PR #215's inversion;
  #218–#227's re-prioritization). Invariant: **the PO may re-order/re-scope freely only while the goal-delta is
  moving; a flat goal-delta revokes autonomous re-frame and forces escalation.**

- **C10 [BLOCKER · platform] — Make the data-plane rollback real via expand/contract.** Forward-only means a
  migration cannot roll back, so "flip the flag" rolls back *code* against a *changed schema*. Add the rule:
  **every migration is backward-compatible with the immediately-prior code release (expand/contract); code
  rollback must never require a schema rollback; contraction (drops/renames) is a separate later release after
  all old-shape references are gone.** This is also what makes "migrate before code deploy" safe.

- **C11 [BLOCKER · platform] — Condition "production never validates first"; it is FALSE as an absolute.** Local
  has no `maxDuration`, so `runDiscovery` *completes and persists locally* — local-first would have **certified
  the incident's bug green.** Name the irreducible platform-emergent defect classes and assign each a non-local
  catch surface (HE-1…HE-6 below). The honest invariant: *production never takes **production traffic** as its
  first validation; platform-emergent classes are validated on a **staging that IS the real platform at the real
  plan/scope**, drift by the **prod-parity gate**, and the residual fleet-scale class behind a **flag + closed-loop
  canary + auto-rollback.*** Local validates *logic*; only the real platform validates *platform behavior*.

  | # | Platform-emergent defect class | Why local can't catch it | Catch surface |
  |---|---|---|---|
  | HE-1 | `maxDuration` kill + all-or-nothing rollback | local has no execution ceiling | staging on the real Vercel plan + §8.3 lane-lint + AN-7 checkpointing |
  | HE-2 | serverless freeze / `.unref()`-timer death | a local process never freezes | staging on Vercel; cron-driven (not in-process) drivers |
  | HE-3 | cold-start ~25s gateway HTTP-000; fleet-wide pool-acquire starvation | one local process ≠ N instances on a shared pooler | staging under prod-representative concurrency; binding post-deploy concurrency smoke |
  | HE-4 | plan-tier silent clamps (Hobby 60s, 2-cron cap) | pure account property | staging on the **same plan tier + scope** as prod |
  | HE-5 | build-shape: `next build` reads a runtime-only secret at module load | local build has the var / imports differently | the real Vercel build in QA/staging; build-shape lint |
  | HE-6 | prod↔repo migration drift | not a runtime property at all | the bidirectional content-hashed prod-parity gate — **not** staging |

- **C12 [platform · SF2/SF4/SF5/SF6] — Harden the pipeline against the recorded specifics:** migration-parity is
  **bidirectional + content-hashed** (catches prod-ahead-of-repo, e.g. the test-data-seeded-into-prod incident);
  the config registry extends from env-*keys* to **platform/project settings** (Node version, plan tier,
  scope/org-id, framework preset, region, pooler mode, cron count) and the **numeric blank→default** doctrine
  (`Number("")===0` silently zeroing a timeout is a fail-*open*, worse than the empty-string crash); **staging =
  same plan/scope/pooler class as prod under prod-representative concurrency** (single-user smoke will not
  reproduce HE-3); the **post-deploy health/smoke gate is release-binding** (no `continue-on-error` — the recorded
  ALARM-but-shipped is the G-shadow pattern).

- **C13 [critic] — Reconcile with on-disk reality.** `docs/verify/VERIFY-goal-delta-gate.md` on this branch shows
  the **in-loop H9 Stop-hook escalation is already built** — the very locus §5.5 rejects. The ADR must state the
  migration path: the in-loop H9 gate is the **interim/transitional** form (right signal, in-loop locus); the
  out-of-loop arithmetic poll + pre-flight gate is the **target**. Do not present the rejected locus and the
  recommended one without acknowledging the repo ships the former.

### 18.3 Surfaced disagreements (NOT smoothed — §11)
- **Center of gravity: pre-flight gate vs mid-flight supervisor.** The re-derive lens holds the pre-flight static
  gate is the highest-leverage organ for *this* incident and the supervisor is over-invested; the lead-architect
  holds the supervisor (for the not-statically-knowable class) is the load-bearing general organ and the spine is
  correctly minimal. **Resolution (carried into §19):** they are not in conflict — they address different goal
  classes. *Both* organs ship; the **pre-flight gate is primary** (cheapest, prevents this incident outright) and
  the **arithmetic watchdog is the backstop** for goals whose unreachability only emerges mid-run. This is the
  single most important correction the panel makes.
- **Does the supervisor break the frame at all?** Re-derive says no — only a human (or a static fact) breaks it;
  the GS is a tripwire that *fetches* the human. Lead-architect agrees the 02:06 path is judgment-dependent but
  credits the externalized *locus* as real. **Resolution:** adopt the re-derive framing (C1) — the GS does not
  judge feasibility; it makes the flat line undeniable and summons the human early. The "externalization"
  win is real but narrower than the candidate claimed.
- **Infrastructure independence vs Waterline.** Platform lens demands a GS dead-man's-switch (C3); a cost/Waterline
  reading would resist it and resist same-plan staging as speculative spend. **Resolution:** both clear the
  Waterline bar because each maps to a *recorded* failure (the 76-commit billing stall; the Hobby-clamp/pool-
  starvation incidents) — they are failure-pulled, not speculative.
- **Scope.** The critic would go furthest (return the whole 12-decision bundle as research-accepted-build-on-pull);
  the lead-architect holds the *spine* is correctly minimal and only the *bundling* needs sequencing. **Resolution:**
  C8 — ratify the proven-need core now; defer the topology framing, Evidence Cycle, Slack, and auto-merge as
  build-on-pull. Both lenses are satisfied by sequencing rather than deletion.
- **Auto-merge.** A pragmatist reading defends it as obvious for an AI workforce; the critic holds the line
  (green ≠ correct; it overrides a board deferral). **Resolution:** C6 — defer; it is a separate consequential
  decision needing its own panel. *(Surfaced, not smoothed: the author's candidate was wrong to adopt it here.)*

---

## 19. FINAL conditioned recommendation — OBW-GS/c (authoritative)

This supersedes §0, §5, §14, and §16 where they conflict. It folds in C1–C13. The model keeps its bones and
corrects its center of gravity, its claims, and its scope.

### 19.1 The model in one paragraph (corrected)
Each objective carries a **goal contract** — objective + a **fitness-checked, externally-probeable acceptance
metric** + an **explicit pre-flight reachability/precedent assertion** + a write-ahead budget — held as a
**persistent state object** (the existing H9 M1 ledger, amplified; *not* a new "role"). Before any work begins, a
**deterministic pre-flight gate** refuses goals whose unreachability is statically knowable — the
serverless-ceiling lint (no >300s work behind a 300s route) and a precedent check ("has the pipeline ever
produced this?"). Ephemeral **workers** (main-loop-spawned, G9-clean) ground → build → verify-on-the-real-surface
(author≠verifier, server-bound) → post to the **durable result bus** and terminate; their "memory" is the
durable ledger. An **external arithmetic progress watchdog** — a scheduled, state-reading runner that **re-probes
the acceptance metric from its canonical external source**, separates a **liveness tick** from a **dGoal/dEffort
progress signal**, and applies **layered hard caps** — trips on *effort-without-progress* and, never judging
feasibility itself, **halts the loop and summons the human with evidence** to re-derive reachability (the human is
the frame-breaker; the watchdog only fetches them early). The watchdog has its **own dead-man's-switch on a
different failure domain**. Work is validated **locally for logic and on a prod-faithful staging for
platform behavior** (production never takes production traffic first; the named platform-emergent classes
HE-1…HE-6 are caught off-local), promoted **state-gated** with **expand/contract migrations** and a **bidirectional
prod-parity gate**, released **flag-decoupled, closed-loop-canaried, auto-rolled-back**, with a **binding**
post-deploy health gate. Long work runs on a **non-serverless lane behind the bus** (GitHub Actions now, dedicated
worker deferred). The founder is summoned with evidence at boundaries (Slack-first, build-on-pull).

### 19.2 The corrected organ ranking (the panel's headline change)
1. **PRIMARY — the deterministic pre-flight gate** (reachability/precedent + serverless-ceiling lint). Cheapest,
   judgment-free, would have prevented the incident at hour 0. [C2]
2. **BACKSTOP — the external arithmetic progress watchdog** (liveness≠progress, layered caps, dGoal/dEffort) for
   the not-statically-knowable class, **summoning the human** on a trip; with its own dead-man's-switch. [C1, C3]
3. **The human** is the feasibility/re-frame decider; the system fetches them early with evidence. [C1]

### 19.3 The revised decision record (corrected confidence + status)
| # | Decision | Status | Confidence (function / embodiment) |
|---|---|---|---|
| **OM-2′** | Result bus = single durable substrate; pluggable lane behind it | RATIFY-CORE | Proven (as primitive) / **Plausible (as goal-delta substrate — must run)** [C5] |
| **OM-PF** *(new)* | **Pre-flight reachability + serverless-ceiling gate = the PRIMARY organ** | RATIFY-CORE | Strong / Plausible-until-built [C2] |
| **OM-3′** | External arithmetic watchdog → halt → **summon human**; it does NOT judge feasibility | RATIFY-CORE | Strong (function) / **Plausible (embodiment)** [C1] |
| **OM-3a** *(new)* | Watchdog **dead-man's-switch** on a different failure domain | RATIFY-CORE | Strong / Plausible [C3] |
| **OM-4′** | Liveness tick ≠ progress watchdog (two organs) | RATIFY-CORE | Strong | 
| **OM-MX** *(new)* | Metric **re-probed externally under GS identity** + **fitness check at authoring** | RATIFY-CORE | Strong / Plausible [C4] |
| **OM-9v** *(new)* | PO autonomous re-frame **revoked on a flat goal-delta** | RATIFY-CORE | Strong [C9] |
| **OM-11′** | Goal-level author≠verifier routed to the watchdog (interim: the on-disk in-loop H9 → target: out-of-loop poll) | RATIFY-CORE | Strong / reconcile [C13] |
| **OM-5′** | Hybrid platform; long work on GH Actions now; worker deferred | RATIFY-CORE | **Strong-with-conditions** [C3] |
| **OM-7′** | Local-for-logic + prod-faithful staging; **production never validates *traffic* first** (HE-1…HE-6 named) | RATIFY-CORE | Strong [C11] |
| **OM-8′** | Pipeline: expand/contract rollback · bidirectional content-hashed parity · config=platform-settings · binding post-deploy gate | RATIFY-CORE | Strong [C10, C12] |
| **OM-12** | Config platform invariant; built-≠-operating ladder; dedup-at-write learning | RATIFY-CORE | Proven / Strong |
| **OM-1, OM-9, OM-10** | 4-role *topology framing*, Evidence Cycle, Slack-first transport | **DEFER — build-on-pull** | Plausible [C8] |
| **OM-8(auto-merge)** | Auto-merge-on-green | **DEFER — separate §11 decision (restore D3)** | — [C6] |
| **OM-R1′** | REJECT: in-loop auto-redirect panels · liveness-as-progress · all-Vercel · prod-as-validation · persistent-fleet-default · **and the claim the supervisor judges feasibility** | REJECTED | Proven/Strong |

### 19.4 The corrected acceptance bar (replaces §17's "single claim")
Replay the Discovery timeline against OBW-GS/c:
1. **Pre-flight (primary):** the serverless-ceiling lint flags `runDiscovery`>300s-behind-a-300s-route and the
   precedent check finds an all-time high of 8 → **the goal is refused before any PR.** This is the sufficient,
   judgment-free win for *this* incident.
2. **Backstop (for the general class):** were unreachability *not* statically knowable, the flat goal-delta is
   machine-visible from the first cycle (metric re-probed externally), the unbounded 9-hour grind is
   **impossible**, and a bounded arithmetic trip **halts and summons the human** from outside the loop — with the
   dead-man's-switch guaranteeing the watchdog itself was alive to do so.
*A design passes only if it both (1) refuses the statically-unreachable goal up front AND (2) makes the unbounded
grind impossible for the residual class. Halting "by 02:06" is not claimed; **preventing the start, and bounding
the grind, are.***

### 19.5 De-risk build sequence (the only thing ratification authorizes — research §12 order)
**Ratify the core, in this order; defer the rest to build-on-pull.**
1. Result bus + goal-delta ledger **operating** (amplify the on-disk H9 M1 ledger) — prove it runs as the
   substrate before any confidence transfers (C5).
2. The **pre-flight gate** (serverless-ceiling lint + reachability/precedent check) — primary, cheapest, prevents
   this incident class (C2).
3. The **external arithmetic watchdog** (liveness≠progress, layered caps, external metric re-probe) + its
   **dead-man's-switch** (C1, C3, C4).
4. **Goal-level author≠verifier** routing; reconcile the interim in-loop H9 with the target out-of-loop poll (C13).
5. The **pipeline hardening** (expand/contract, bidirectional parity, config-as-platform-settings, binding
   post-deploy gate, named HE exceptions) (C10–C12).
6. *Build-on-pull, each its own decision:* topology framing, Evidence Cycle, Slack transport, auto-merge.

### 19.6 Status
**OBW-GS/c is the single recommended operating model**, conditioned by C1–C13 and scoped to the proven-need core
above. It is a **design**; it implements nothing. The next step is **founder ratification of the core + the
de-risk sequence**, after which the design-detail phase resolves the open questions (O1–O6 + the panel's) and the
proof slices begin riskiest-unknown-first. The honest limit stands: this document proves the model is coherent,
evidence-grounded, incident-faithful, and **independently stress-tested**; it does not prove it correct in build —
that is what the proof slices, run author≠verifier, are for.

*End of ADR. Four independent lenses reviewed the recommendation; all returned SOUND-WITH-CONDITIONS; the
conditions are folded in above; the disagreements are surfaced in §18.3, not smoothed. One model is recommended:
**OBW-GS/c.***
