---
artifact: RUNTIME-SPECIFICATION (the definitive, buildable architectural specification for the Delivery OS Runtime)
id: RS-DOS-v1
subject: The complete Delivery OS Runtime — every lifecycle, flow, state machine, message contract, and the end-to-end walkthrough, specified so an engineering team can build without inventing further architecture
date: 2026-06-28
status: ARCHITECTURALLY COMPLETE — candidate Definition of Done for the Architecture Phase (design-only; extends RA-DOS-v1). SIX rounds of independent blind review hardened it (runtime panel · completeness · consistency · operating-model invariants · infrastructure/freeze gate). PART III (§35–§40): planner→executor data contracts, MetricProbe substrate, core-only walkthrough+DoD, state-machine totality, ~16 reconciliations. PART IV (§41–§43): the seven operating-model principles made explicit as binding invariants OM-INV-1…7 (all SOUND; model is CORE, the unattended-execution BUILD is gated; "never stops until achieved" challenged for the slow-asymptotic class). PART V (§44–§53): infrastructure independence by contract (I-Provider/I-Placement/I-Surface/I-Resource/I-Ops/I-SelfEval/I-Version/I-LegacyGuard) — interfaces core, sophisticated builds deferred-until-pulled. §54–§56: the freeze gate's one fundamental gap closed (Data Classification & Trust Boundary — data_class carrier + trust-boundary rule + tenancy isolation, so I-Provider passes its §44 acceptance test), the "core-adjacent" re-inflation slip removed, and the FREEZE DECISION rendered: architecturally complete. Implements NOTHING; the Master Migration Blueprint is the deferred next step, pending approval of this DoD.
extends: docs/reviews/RUNTIME-ARCHITECTURE-2026-06-28.md (RA-DOS-v1 — the layered model + the §17 conditions, which BIND this spec)
binds:
  - "RA-DOS-v1 §17 is in force: SPECIFICATION COMPLETENESS ≠ BUILD AUTHORIZATION. This document SPECIFIES every component fully (so nothing is invented later); §17's roadmap still governs what RATIFICATION AUTHORIZES first (the Phase 0–3(+3.5) safety core) vs what is panel-gated build-on-pull (the Project-Owner organ, Sprint Engine, Slack)."
  - "All prior adversarial walk-backs (ADR §18-19 C1–C13; three-proposals §11; sprint §8) hold."
scope_guard: Design only — no code, no scripts, no wiring. The deliverable is the complete runtime specification. It does NOT start implementation planning or the Master Migration Blueprint; those follow ratification.
---

# Delivery OS Runtime Specification (RS-DOS-v1)

> **Purpose.** RA-DOS-v1 gave the *layered architecture* and the *decisions*. This document gives the
> *buildable detail*: the lifecycle and state machine of every runtime component, every message it sends, every
> state transition, the orchestration / supervision / failure-recovery flows, the scaling and governance
> interactions, the runtime's own Definition of Done, and a complete walkthrough from **"Founder submits a
> goal"** to **"Founder receives the completed result"** — specifying, at every stage, *what happens
> internally, who owns the decision, which component is responsible, how components interact, and how the system
> behaves under normal and failure conditions.* When ratified, an engineering team can build the complete
> runtime from this document without making new architectural decisions.

> **The one rule that prevents this expansion from re-inflating scope (§17).** *Specifying* a component (so it
> is buildable without invention) is **not** *authorizing it for the first build*. This spec describes the
> Project-Owner organ, the Sprint Engine, and the Slack surface **in full** — and they remain **build-on-pull,
> each gated by its own §11 panel** (RA-DOS-v1 §17.7). Ratification of this *specification* authorizes building
> **only the Phase 0–3(+3.5) safety core**; the fully-specified-but-deferred components are clearly tagged
> **[BUILD: panel-gated]** throughout.

---

## 0. Reading guide & notation
- **Component tags:** **[BUILT]** (on disk, operating) · **[DESIGNED]** (specified, not built) · **[MISSING]**
  (specified, must ship in Phase 1) · **[BUILD: core]** (Phase 0–3.5, ratification-authorized) ·
  **[BUILD: panel-gated]** (fully specified here, but its build is a separate §11 decision).
- **Lifecycle classes** (RA-DOS §3): **P** persistent state · **S** scheduled/level-triggered · **E**
  event-driven · **X** ephemeral.
- **State machines** are written `STATE —event/guard→ STATE`. **Ownership** = the single component that owns the
  decision at that step (the ownership matrix is §15).
- **The durable bus is the only communication channel.** No component calls another directly; all interaction is
  a durable, idempotent, CAS-guarded write/read on the Result Bus (the message catalog is §8). This is the
  load-bearing invariant that makes every flow crash-recoverable.

---

## 1. The runtime in one paragraph (the spine this spec details)
A **Founder** submits a goal through **Slack**. A durable **Goal Contract** is created and owned by a **Project
Owner** (durable state + a scheduled reconciler + ephemeral boundary-intelligence). A **Pre-flight Feasibility
Gate** refuses the goal if it is statically unreachable (→ summon the Founder). Otherwise the PO runs the
objective as a sequence of **evidence-bounded Sprints**: each sprint is *planned* (objective + frozen,
fitness-checked acceptance criteria + work packages), *executed* by **ephemeral specialist agents** spawned
through the **Claude Code Runtime** (G9: the runtime session is the spawner) over the **Result Bus**, *monitored*
by a cheap **engine tick** and an independent **Goal Supervisor** (dGoal/dEffort), and closed by a **formal,
independent, three-way completion review** (complete → DoD-validated stop · incomplete-but-reachable → next
sprint · unreachable → halt-and-summon). Work ships through **local→QA→staging→prod** under **state-gated**
deployment; **author≠verifier** binds at the slice, the goal, and the orchestration seam; a **dead-man's-switch**
guards the supervisor; and the Founder is **summoned with evidence** only at genuine boundaries. The objective
completes, or it reaches a Founder boundary — never an infinite loop.

---

## 2. The component register (every runtime component, at a glance)
Each row links to its full specification section. *Status/build tags carried from RA-DOS §17.*

| # | Component | Class | Status | Build | Spec |
|---|---|---|---|---|---|
| C1 | Founder Experience (Slack operating layer + single-screen + FAP envelope) | E | seed [BUILT] | panel-gated | §3 |
| C2 | Project Owner (state + reconciler + boundary-intelligence) | P+S+X | partial | core (state/tick) + panel-gated (organ) | §4 |
| C3 | Claude Code Runtime (the G9 spawner session) | X | [BUILT] (harness) | core (spike) | §5 |
| C4 | Specialist execution agent | X | [BUILT] | core | §6 |
| C5 | Verification agent (author≠verifier) | X | [BUILT] | core | §6 |
| C6 | Review agent (§11 lenses / sprint completion review) | X | [BUILT] | core (slice) + panel-gated (sprint review) | §6 |
| C7 | Goal Supervisor (progress watchdog) | S | [DESIGNED] | core | §7 |
| C8 | GS Dead-man's-switch (external monitor) | S | [DESIGNED] | core | §7 |
| C9 | Pre-flight Feasibility Gate | S/X | [DESIGNED] | core (PRIMARY) | §7 |
| C10 | Sprint Engine (Evidence Cycle) | S | [DESIGNED] | panel-gated | §9 |
| C11 | Result Bus (run/step engine + completer) | P+E | [BUILT] | core | §8 |
| C12 | Durable stores: goal-delta ledger · attempt-ledger+breaker · idempotency · dead-letter · portfolio-cost | P | [MISSING]/[DESIGNED] | core (Phase 1) | §8 |
| C13 | Engine-step tick (advance ready steps) | S | [BUILT] (`/v1/heartbeat`) | core | §7 |
| C14 | Scheduler substrate (GitHub Actions cron + external monitor) | S | [BUILT] (cron precedent) | core | §7 |
| C15 | Dispatch router (`dispatch-route` + dispatch-log) | X | [BUILT] | core | §6 |
| C16 | Verify Gate (CI-binding, D9) + DoD validator | E | [BUILT] | core | §12 |
| C17 | Learning Engine (L0/L1/L2) | E/S | [BUILT] | core | §12 |
| C18 | Config platform + registries (config/capability) | P+E | [BUILT] | core | §8/§11 |
| C19 | Delivery pipeline (local→QA→staging→prod + state-gated deploy) | E | partial | core (Phase 3.5) | §11 |
| C20 | Memory (3-tier + signals corpus) | P | [BUILT] | core | §8 |

---

## 3. The Founder Experience (C1) — complete specification

**Purpose.** The Founder is the scarcest resource and the only holder of irreducible authority. The experience
is **pull-by-exception, summon-with-evidence**: the Founder is interrupted only at genuine boundaries, always
with everything needed to decide in zero-technical terms, and can query state any time — but is **never the
system's clock** and **never the thing that must *notice* a problem.**

**The Founder's irreducible decisions (the only ones kept on the human):** (1) submit/redirect an objective;
(2) approve at the one operational gate (money/comms-out); (3) credentials/consents; (4) strategic/architectural
rulings; (5) Class-C irreversible gates (merge-to-main, prod-deploy, payments, contracts, secrets); (6)
**feasibility verdicts** when the system summons "this objective may be unreachable." Everything else is
autonomous-with-audit.

**The three interaction modes (all over Slack — C1 [BUILD: panel-gated], seed exists):**
| Mode | Direction | Trigger | Contract |
|---|---|---|---|
| **Submit** | Founder → runtime | the Founder types a goal | creates a Goal Contract (§4.2) |
| **Summon** | runtime → Founder | a boundary FAP is emitted | a Block-Kit card rendering the FAP (§3.1) |
| **Query** | Founder ↔ runtime | "status?" / "where is X?" | a derived read of the single-screen (§3.2) — never a written report |

### 3.1 The Boundary FAP (the summon envelope) — what the Founder receives
A Founder Action Package, rendered as a Slack card, emitted **at** a boundary, **before** the segment terminates.
Machine-readable frontmatter (re-checked by the goal-stop hook) + a zero-tech body:
`status · what-I-completed (linked to commits/VERIFYs) · what-remains · WHY-I-stopped (the boundary + its
evidence) · exactly-what-to-do (numbered, zero-tech) · rollback · the resume command`. Boundary classes (§7.4):
`approval · merge-to-main · credentials · deploy-auth · manual-testing · legal · payment · feasibility/strategy
· cross-repo`. The **feasibility/strategy** FAP additionally embeds the goal-delta ledger (the flat line, made
visible) + the reachability re-derivation, so the Founder decides **redirect / accept-lower-bar / kill** on
evidence. Approvals are **identity-bound** (the approver's identity, not channel membership).

### 3.2 The single-screen (the Query surface) — the 8 questions, derived
A read-only surface (the missing V6 Pillar-3 north star) answering, in ≤2 minutes, *from derived state only*:
what was requested · who performed it · why they were selected · what skills+knowledge were used · who verified
it · did it pass · what changed · is the outcome complete. **Derived from the ledgers** (dispatch-log,
goal-delta ledger, VERIFY artifacts), never a hand-written status (the stale-status incident class).

### 3.3 Founder-experience guarantees (normal & failure)
- **Normal:** the Founder sees only *submit acknowledgements*, *boundary summons*, and *answers to queries*. No
  routine progress chatter (agents are *on* the loop, not *in* it).
- **Failure — Slack down:** boundary summons fall back to a **non-SaaS channel** (SMS/email) per a **per-action
  fail policy** (Class-C boundaries **fail-closed**: the action waits; non-irreversible boundaries may
  **fail-safe** to a queued summon). A chat outage must **never** silently unleash *or* permanently stall the
  fleet.
- **Failure — prompt injection:** the chat channel is **never an instruction source for privileged actions**;
  authority comes only from the signed control path. A message that tries to direct an agent is inert.
- **Failure — summon storm (N projects summon at once):** the summon queue is **triaged** (Class-C and
  feasibility boundaries first; §13 scaling).

---

## 4. The Project Owner (C2) — complete runtime & lifecycle

**The single owner of every project** (one PO per project), specified in its three lifecycle classes (the
resolution of the "persistent PO" debate, RA-DOS §3):
- **C2-STATE [P, core]** — the durable Goal Contract + sprint state + the goal-delta & attempt ledgers. *This is
  the accountability locus; it is what "owns" the project.*
- **C2-LOOP [S, core as a tick-upgrade / panel-gated as a distinct organ]** — the level-triggered reconciler
  that advances the state each tick.
- **C2-MIND [X]** — ephemeral boundary-intelligence (a bounded Claude session) invoked **only** to *plan a
  sprint* and *run a completion review*.

**Ownership rule (load-bearing, AX-3):** the PO **delegates work, never the outcome**; it validates goal
*movement* but **never judges feasibility** (that verdict belongs to the GS → Founder); a **flat goal-delta
revokes its autonomous re-frame** (C9). The PO **plans, never self-spawns** (G9 — spawning is the Claude Code
Runtime's).

### 4.1 The Goal Contract (C2-STATE schema) — the durable record
```
GoalContract {
  goal_id, objective(text), submitted_by, submitted_at, start_ref,
  acceptance: { metric, op, target, metric_source(canonical external probe), fitness_attestation },
  reachability_assertion(pre-flight verdict + evidence),
  budget: { max_turns, max_wallclock, max_cost, portfolio_cost_ref },
  clears_on: ["objective_complete", "valid_fap_at_boundary"],   // structural; never names a human gate
  state: <PO lifecycle state §4.3>,
  current_sprint_id, sprint_history[],
  ledgers: { goal_delta_ref, attempt_ledger_ref }               // → C12 durable stores
}
```

### 4.2 PO creation (Submit → Contract)
Founder submits → **C2-MIND** parses the objective into a Goal Contract: derives the objective, the **acceptance
metric + its canonical external source + a metric-fitness attestation (C4b)**, the budget, the reachability
assertion (pre-filled by the pre-flight gate §7.3). *Owner of this decision:* C2-MIND drafts; the **pre-flight
gate adjudicates reachability**; the Founder owns the objective. The Contract is written to C2-STATE (durable).

### 4.3 The PO lifecycle state machine (C2-STATE)
```
CREATED ─submit/contract-drafted→ FEASIBILITY
FEASIBILITY ─preflight:unreachable→ HALTED(feasibility FAP → Founder)        [terminal-until-resume]
FEASIBILITY ─preflight:reachable→ ACTIVE
ACTIVE ─tick/no-open-sprint→ PLANNING
PLANNING ─sprint-planned→ EXECUTING
EXECUTING ─tick/all-work-posted OR GS-early-trip→ REVIEWING
REVIEWING ─review:complete→ DONE(DoD-validated)                              [terminal: success]
REVIEWING ─review:incomplete-but-reachable→ PLANNING(next sprint)
REVIEWING ─review:unreachable→ HALTED(feasibility FAP → Founder)            [terminal-until-resume]
ANY ─H1-cap-tripped→ FAILED(cap FAP → Founder)                              [terminal: failure]
ANY ─founder-freeze→ SUSPENDED ─founder-resume→ (prior state)
HALTED ─founder-decision(redirect)→ PLANNING(amended contract)
HALTED ─founder-decision(accept-lower-bar)→ REVIEWING(re-evaluate)
HALTED ─founder-decision(kill)→ CLOSED                                       [terminal]
```
*Every transition is a durable write; the reconciler (C2-LOOP) is the only mutator and acquires the bus lease
(no out-of-band mutation). On crash, the next tick re-reads state and resumes (crash-equivalent to fresh start).*

### 4.4 The reconciler (C2-LOOP) — what one tick does (level-triggered)
Each scheduled tick, statelessly, over durable state:
1. **Read** the Goal Contract + the current sprint state + the goal-delta ledger (the *verified* observed state,
   never a worker self-report).
2. **Compute desired-vs-observed** for the current PO state (the diff). Deterministically (no LLM) decide "am I
   at a boundary?" (a sprint needs planning, or all work is posted and a review is due).
3. **Act idempotently** to close the gap: dispatch missing work packages (via C15 → C3 spawns); collect posted
   results; **interrupt a stalled *worker*** (no transition within N → bounded restart → breaker → dead-letter);
   advance the sprint/PO state machine.
4. **At a boundary only:** invoke **C2-MIND** (a bounded Claude session) to *plan the next sprint* or *trigger
   the completion review* (the expensive intelligence; everything else is cheap/deterministic — the no-op-cheap
   guarantee that prevents cron-launched-LLM-every-tick cost runaway).
5. **Never** judge feasibility, **never** re-frame on a flat delta (→ hand to the GS / Founder).
*Failure:* a reconciler crash loses nothing (no essential RAM state); the next tick resumes. A late tick is safe
(reads durable state — the resync property), which is why best-effort GH-Actions cron suffices.

### 4.5 Communication (PO ↔ everything) — all via the bus (§8)
PO writes: `SprintPlan`, `WorkPackage` (→ dispatch), `ProgressQuery`. PO reads: `WorkResult`/`VERIFY`,
`ProgressSample`, `GoalDeltaVerdict` (from the GS), `FounderDecision`. PO emits to the Founder: `BoundaryFAP`
(via C1). **No direct calls** — every interaction is a durable bus message.

---

## 5. The Claude Code Runtime (C3) — lifecycle

**Purpose.** The execution substrate: the main loop that *spawns* agents (the **G9 ceiling**: only the main loop
spawns; reconcilers/engines plan, never self-spawn out-of-loop). A runtime session is **one bounded `/goal`
segment**.

**Lifecycle (X):**
```
SPAWNED(by the reconciler at a boundary, OR by the Founder via Slack) — headless `claude -p`, given the
   spawnPrompt (objective + contract + injected skills/knowledge)
 → RUNNING(the main loop; bounded by the H1 cap turn/wallclock/cost) — may spawn specialist sub-agents (G9)
 → POSTS its result to the bus (objective-complete | boundary-FAP | cap-tripped)
 → TERMINATED (never idles; never waits for a human)
```
**The load-bearing harness fact (the autonomy-noun risk, RA-DOS §17.4):** a *scheduled* job (the reconciler on
GitHub Actions) launching a **headless Claude session** that reads the bus, dispatches a specialist, and posts a
verified result — must be **proven by the Phase-0 spike** before the auto-sprint design is built. The **safety
core (Phases 0–3) does not depend on it** (deterministic scripts + arithmetic + human-summon); only the
**autonomy noun** (unattended sprinting) does.
**Failure:** a session crash holds no essential state (its progress is durable on the bus via posted steps); the
reconciler re-launches the segment from durable state. A session that hits the H1 cap forces a `failure` FAP.

---

## 6. Agent lifecycles (C4 specialist · C5 verifier · C6 reviewer · C15 dispatch)

**Dispatch (C15 [BUILT, core]).** For each work package, `dispatch-route` resolves the **owner** (ownership
policy), the **agent**, and the **skills+knowledge to inject**, emitting a `DispatchPlan` + `spawnPrompt` and
writing `dispatch-log.jsonl`. *Injection is firewalled from adoption (G9 C2): injected count never touches the
adoption ladder.* The Claude Code Runtime (C3) spawns from the plan.

**C4 — Specialist execution agent (X).**
```
DISPATCHED → GROUNDING(read canonical contract + consumer code + source-of-truth; record the shape — read-canonical-first)
 → BUILDING(one vertical slice to the contracts; production code only)
 → SELF-VERIFYING(local) → POSTING(WorkResult to the bus) → TERMINATED
```
*Owner:* builds only; **never validates or marks its own work done**. *Failure:* a hang → tick detects (no
transition within N) → bounded restart → durable circuit-breaker (in the attempt-ledger) → dead-letter → boundary
FAP. A crash → the blocked step holds no lease → re-read → relaunch.

**C5 — Verification agent (X) — author≠verifier.**
```
DISPATCHED(disjoint write-scope from C4: tests/e2e/evals only) → VERIFYING(on the REAL application surface, real
   concurrency/DB shape) → EMIT VERIFY{impl_fingerprint, machine_probe, goal_metric_reachable, metric_value}
 → POSTING → TERMINATED
```
*Owner:* **owns the "observed state"** the reconciler and the GS trust (never the acting agent's self-report).
The `goal_metric_reachable:false` finding routes to the **GS** (goal-level author≠verifier). *Defects flow
author-ward* (back to C4 within the sprint).

**C6 — Review agent (X).** Two uses: (a) **§11 lenses** for consequential decisions (blind-first, consolidated,
dissent-surfaced; human/event-triggered, **never** an in-loop auto-redirect); (b) the **sprint completion
review** [BUILD: panel-gated] — independent (not the PO), **stakes-gated** (fires the expensive review only for
Class-C/founder-verifiable/cross-system objectives; the cheap default is the existing verify-gate + the GS),
adjudicating the **three-way verdict** against the *frozen* acceptance criteria, re-probing the metric under its
own identity + re-checking metric-fitness (C4b). *Owner:* verdicts only; owns no files.

---

## 7. Supervision & gating components (C7 GS · C8 dead-man's-switch · C9 pre-flight · C13 tick · C14 scheduler)

### 7.1 The engine-step tick (C13 [BUILT: `/v1/heartbeat`, core]).
**Liveness only.** A scheduled tick (Vercel cron ~5 min, sub-300s) that advances ready/blocked-on-timer durable
steps and detects a *hung* process (no transition within N). **It is NOT the progress signal** (liveness ≠
progress — the incident agent was alive throughout). Acquires bus leases; mutates step state only through the
bus protocol.

### 7.2 The Goal Supervisor (C7 [DESIGNED, core]) — progress governance, independent of the PO.
A scheduled job (GitHub Actions cron), an **independent evaluation** from the PO reconciler (different state
reads, different logic — *never the same job*, or the driver grades its own progress). Each run:
1. **Re-probe the acceptance metric from its canonical external source under the GS's own identity** (not the
   PO/worker-written value).
2. **Append a ProgressSample** to the goal-delta ledger `{cycle, value, predicted, fix_ref}`; compute
   **dGoal/dEffort**.
3. **Layered hard trips** (all bind on the goal): the H1 cap · the write-ahead budget (portfolio-cost ledger) ·
   the **no-progress/loop-fingerprint** detector (flat delta / same fix repeated) · the independent
   goal-verifier (`goal_metric_reachable:false`).
4. **On a trip:** **HALT** the loop (circuit-breaker OPEN) → **SUMMON the Founder** (feasibility/strategy FAP) →
   the Founder re-derives reachability. **The metric STEERS, never gates *success*** (it can force *stop*, never
   silently declare *done*).
**Open problem carried (RA-DOS §15.1):** a *slow-asymptotic* goal (positive-but-practically-infinite delta)
reads "reachable" and is bounded **only by the H1 cap**, not the GS. Named, unsolved; a rate-of-convergence
floor is a future panel.

### 7.3 The Pre-flight Feasibility Gate (C9 [DESIGNED, core, PRIMARY]).
Before sprint 1 of any goal (and re-run on a HALTED→PLANNING resume): the **serverless-ceiling lint** (no >300s
work behind a 300s route — the exact `runDiscovery` mismatch) + a **precedent/reachability check** ("has this
ever been produced; is the target reachable from current inputs?"). **The PRIMARY incident fix** — it refuses
the statically-unreachable goal at *hour 0*, judgment-free, before any effort. *Owner:* adjudicates the Goal
Contract's reachability assertion; on `unreachable` → PO state HALTED → feasibility FAP.

### 7.4 The Dead-man's-switch (C8 [DESIGNED, core]).
An independent dumb timer on a **clamp-free external uptime monitor** (NOT Vercel cron — HE-4 plan clamp): if
the GS has not posted a tick within N, it **alarms the Founder** (the supervisor itself failed — the 76-commit
billing-outage class). *This is the watchdog's watchdog; AX-3 extended to infrastructure.*

### 7.5 The three scheduled tiers (independence is the invariant).
| Tier | Job | Substrate | Cadence | Independent of |
|---|---|---|---|---|
| 1 | engine-step tick (liveness) | Vercel cron | ~5 min | — |
| 2a | PO reconciler (drives work) | GitHub Actions cron | coarse (min–tens of min) | the GS |
| 2b | Goal Supervisor (judges goal-delta) | GitHub Actions cron | coarse | the PO reconciler |
| 3 | dead-man's-switch (watches the GS) | external monitor | coarse | the GS (different failure domain) |
*2a and 2b may share the GH-Actions substrate but are **separate jobs with separate state reads** (or frame-lock
returns). All mutation of durable state goes through the bus lease protocol (no out-of-band writes).*

---

## 8. The communication fabric & durable stores (C11 bus · C12 stores · C18/C20 registries/memory)

### 8.1 The Result Bus (C11 [BUILT, core]) — the only channel.
The durable run/step engine (P1–P4): a 7-state run/step machine, SKIP-LOCKED tick, CAS lease, recovery; **one**
block-on-correlation **await** primitive; **one** idempotent **completer**. Every component interaction is a
durable, CAS-guarded, idempotent write/read here. *A blocked step holds no lease* (crash-while-blocked is
trivial). **No direct component-to-component messaging exists.**

### 8.2 The message catalog (every message that crosses the bus)
| Message | Producer → Consumer | Purpose | Idempotency key |
|---|---|---|---|
| `GoalContract` | C1/C2-MIND → C2-STATE | create/amend the durable goal | goal_id |
| `SprintPlan` | C2-MIND → bus → C15 | objective+criteria+work packages | goal_id+sprint_id |
| `DispatchPlan`+`spawnPrompt` | C15 → C3 | owner+agent+skills+knowledge per work package | dispatch_id |
| `WorkResult` | C4 → completer | a built slice | dispatch_id |
| `VERIFY` | C5 → completer | independent verification (+goal_metric_reachable) | dispatch_id+fingerprint |
| `ProgressSample` | C7/C13 → goal-delta ledger | {value,predicted,fix_ref} | goal_id+cycle |
| `GoalDeltaVerdict` | C7 → C2-STATE / FAP | trip / no-trip | goal_id+cycle |
| `BoundaryFAP` | C2/C7 → C1 → Founder | a summon | goal_id+boundary_class |
| `FounderDecision` | C1 → bus | approve/deny/redirect/accept/kill | goal_id+decision_seq |
| `CallbackEnvelope` | any worker → completer | the uniform await-resume | awaitingEventId+idempotencyKey |
The **CallbackEnvelope** (the one completer contract): `{awaitingEventId, source(system|agent|timer|domain|human),
result, status(ok|failed), idempotencyKey}`. In-transaction, idempotent (dup = no-op), CAS-guarded
(advance only where `awaiting_event_id = mine AND state = blocked`), callback-before-block handled.

### 8.3 The durable stores (C12 [MISSING]/[DESIGNED, core Phase 1]) — homed per RA-DOS §17.2
| Store | Holds | Invariant | Folds into |
|---|---|---|---|
| **Goal-delta ledger** | append-only `progress[]` | the GS's input; metric externally re-probed | new (`goal-progress.mjs` — [MISSING], ship Phase 1) |
| **Attempt ledger + circuit-breaker state** | `{attempt,hypothesis,action,delta,outcome}` + breaker open/closed+count+cooldown | **breaker state is DURABLE, never reconciler RAM** (else a restart resets the runaway) | extends the goal-state |
| **Idempotency / de-dup store** | consumed intent-keys + TTL | **write-ahead-intent: durably record intent BEFORE the side-effect, confirm AFTER** | the bus |
| **Dead-letter terminal** | poison-step records | breaker-exhausted → durable record → emit boundary FAP | a `failed-terminal` rung on the bus state machine |
| **Portfolio cost ledger** | aggregate spend across N goals | bounds a runaway fleet (the billing-outage class) | new per-portfolio ledger |

### 8.4 Registries & memory (C18 [BUILT] · C20 [BUILT]).
**Config registry** = the single config source (schema+template from delivery-os; per-key owner/validator/
required/fix; per-app pooler/scope/refs); CI cross-checks the 3 planes. **Capability registry** = `*.capability
.json` + the governance ladder. **Memory** = three-tier (portfolio doctrine / project memory / derived-state-
never-stored) + the signals corpus (dedup-at-write). **The "event bus" is a transactional outbox + level-
triggered pull (ECR-0006), not push pub/sub** — a deliberate strength.

---

## 9. The AI-native Sprint runtime (C10 [DESIGNED, BUILD: panel-gated]) — fully specified

The sprint = the **Evidence Cycle**; the boundary is **evidence** (acceptance criteria evaluable), capped by H1
(**no fixed duration**). *Specified in full here; its build is a separate §11 doctrine panel (§17 / sprint-§8).*

### 9.1 Sprint state machine
```
PLAN ─criteria-frozen+fitness-checked(C4b)+work-packaged→ PRE-FLIGHT
PRE-FLIGHT ─unreachable→ HALT(feasibility FAP)        PRE-FLIGHT ─reachable→ EXECUTE
EXECUTE ─all-work-posted OR GS-early-trip→ REVIEW
REVIEW ─complete→ DONE(DoD-validated)
REVIEW ─incomplete-but-reachable→ (PO opens next sprint: PLAN)
REVIEW ─unreachable/insufficient→ HALT(feasibility FAP → Founder)
```
### 9.2 The three-way completion review (the doctrine that survived sprint-§8)
Independent (C6, not the PO) · stakes-gated · against the **frozen** criteria · metric re-probed under its own
identity. Verdict ∈ {**complete** → DoD-validated stop · **incomplete-but-reachable** → next sprint (re-plan
from verified state, **discard the stale tail** — anti-windup) · **unreachable** → halt → summon Founder}.
**"Auto-start until done" is bounded** by this verdict + the H1 cap; the slow-asymptotic case is the named open
problem (§7.2).

---

## 10. The complete runtime execution flow (component interaction, normal path)

```
 Founder ──submit(Slack)──▶ C1 ──GoalContract──▶ C2-STATE
                                                   │
                              C2-MIND drafts contract; C9 pre-flight adjudicates reachability
                                                   │ reachable
                                                   ▼
 ┌──────────── SPRINT (repeat until DONE or HALT) ────────────────────────────────────────┐
 │ C2-MIND ──SprintPlan──▶ bus ──▶ C15 dispatch ──DispatchPlan/spawnPrompt──▶ C3 runtime    │
 │ C3 spawns C4 specialists ──build──▶ post WorkResult; C5 verifies ──VERIFY──▶ completer   │
 │ (monitor, every tick:) C13 advances steps · C7 GS re-probes metric → ProgressSample,     │
 │                        dGoal/dEffort → trip? ──no──▶ continue   ──yes──▶ HALT+summon      │
 │ C2-LOOP reconciles desired-vs-verified-observed; at boundary → C6 completion review       │
 │ review verdict ─complete→ DoD(C16) → DONE   ─reachable→ next sprint   ─unreachable→ HALT  │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
                                                   │ DONE (or HALT/boundary)
 work ships local→QA→staging→prod (C19, state-gated D7) ──▶ C1 ──result/summary──▶ Founder
```
*Every arrow is a durable bus message (§8.2). Every monitor cycle reads durable state. The Founder appears only
at submit, at boundaries, and at the final result.*

---

## 11. The delivery pipeline (C19) — local→QA→staging→prod, state-gated

| Rung | Validates | Gate | Owner of go/no-go |
|---|---|---|---|
| **local** | *logic* on the running thing (real concurrency/DB shape; born-correct env) | local-validate | C4/C5 |
| **QA** | author≠verifier on the **real surface** (no raw-SQL bypass); tag-scoped isolation | verify-gate (CI-binding, D9) | C5/C16 |
| **staging** | **platform-emergent classes HE-1…HE-6** (same plan/scope/pooler; migration-parity; cross-system seam round-trip; soak) | staging-soak + bidirectional content-hashed parity | C16/C19 |
| **prod** | the residual, behind a closed-loop canary | **state-gated `deployment-auth` (D7)** + binding post-deploy health gate (no continue-on-error) | the SDLC *state* (not a person); Class-C → Founder |
*Migrations are **expand/contract** (code rollback never needs a schema rollback); forward-only, applied before
code; in the lane. Rollback = deploy≠release (flags) + restoreable ref captured first. **C11 correction:**
production never takes production *traffic* first; local validates logic; staging catches platform-emergent.*

---

## 12. Governance interactions (where every gate fires)

| Gate | Fires | Owner | Fail mode |
|---|---|---|---|
| Pre-flight feasibility (C9) | before sprint 1 / on resume | the gate | unreachable → HALT+summon |
| Verify gate (C16, D9) | every slice (CI-binding) | CI/CODEOWNERS | unverified → merge blocked (fail-closed) |
| Goal Supervisor (C7) | every tick | the GS (independent) | trip → HALT+summon |
| §11 panel (C6) | consequential decisions (human/event-triggered) | the panel; Founder ratifies | refuses below its gates |
| DoD validator (C16) | sprint completion | derived `verify_status` | below `verified` → not DONE |
| Learning triggers (C17) | L0 every slice · L1 sprint boundary · L2 heavy | the learning engine | N-merge backstop blocks |
| Founder boundaries | Class-C / founder-verifiable | the Founder | fail-closed (the action waits) |
*author≠verifier holds at the **slice** (C16), the **goal** (C7 consumes C5's `goal_metric_reachable`), and the
**orchestration** seam (the reconciler trusts the verifier's observed state, never the worker's).*

---

## 13. Scaling architecture

- **Unit = the goal, not a team.** N projects = N Goal Contracts, each with one PO; **stateless reconcilers
  scale horizontally**; the durable bus is the only shared spine. No management layer to scale.
- **The two real bottlenecks (named):** (1) the **shared Postgres bus** under SKIP-LOCKED contention at
  portfolio scale → read-replicas / partition by project later (deferred until pulled); (2) the **founder-summon
  queue** → triage/prioritize boundary FAPs (Class-C + feasibility first).
- **Backpressure / admission control** (spawn-rate + bus-queue-depth bounds at N>1) — named, deferred (N=1
  Waterline). **Cost** is bounded by the portfolio-cost ledger (§8.3).

---

## 14. Failure & recovery flows (every class → detection → recovery → escalation)

| # | Failure | Detection | Recovery | Escalation |
|---|---|---|---|---|
| F1 | specialist hang/loop | tick: no transition within N | bounded restart from durable state | breaker (durable) → dead-letter → boundary FAP |
| F2 | specialist/session crash | blocked step holds no lease | tick re-reads; reconciler relaunches | — (self-heals) |
| F3 | reconciler crash | next scheduled tick | re-read durable state (crash-equiv to fresh start) | — |
| F4 | **GS silent** (cron/billing) | **dead-man's-switch** (external monitor) | — | **alarm Founder** (supervisor failed) |
| F5 | goal statically unreachable | pre-flight gate | refuse before sprint 1 | feasibility FAP → Founder |
| F6 | goal stall (flat delta) | GS dGoal/dEffort trip | HALT loop | feasibility FAP → Founder |
| F7 | goal slow-asymptotic | **H1 cap** (the GS misses it — open problem) | forced completion review | cap FAP → Founder |
| F8 | verification fail | C5 VERIFY fail | defect flows author-ward; re-dispatch in-sprint | — |
| F9 | deploy unsafe state | `deployment-auth` (fail-closed) | no promotion | boundary FAP (deploy-auth) |
| F10 | post-deploy unhealthy | binding health gate (ALARM) | auto-rollback (flag) | boundary FAP |
| F11 | migration drift | bidirectional parity gate | block promotion | — |
| F12 | double-execution risk | idempotency store (write-ahead-intent) | dup = no-op | — |
| F13 | cost runaway | portfolio-cost ledger trip | HALT | budget FAP → Founder |
| F14 | Slack down at a boundary | summon timeout | non-SaaS fallback; per-action fail policy (Class-C fail-closed) | SMS/email |
| F15 | breaker exhausted | dead-letter terminal | record poison-step | boundary FAP |
*The unifying property: **no failure is silent** — every class is detected by a component **external to the
failing unit**, recovered from **durable state**, and escalates to the **Founder with evidence** only when no
automatic recovery exists.*

---

## 15. The ownership matrix (who owns every decision)

| Decision | Owner | Never |
|---|---|---|
| what the objective is | **Founder** | the runtime |
| is the objective reachable (pre-execution) | **Pre-flight gate (C9)** → Founder on unreachable | the PO (self-assertion) |
| how to decompose into sprints/work | **C2-MIND** (boundary intelligence) | a per-tick LLM |
| which agent/skills for a work package | **dispatch-route (C15)** | the orchestrator's memory |
| whether a slice is verified | **C5 verifier (author≠verifier)** | the building agent (C4) |
| whether the goal is moving | **Goal Supervisor (C7), independent** | the PO/driver |
| whether to halt and summon | **C7 → Founder** | the acting loop |
| whether the objective is reachable (mid-run) | **Founder** (summoned with evidence) | the machine |
| sprint completion verdict | **C6 independent review** | the PO |
| Definition of Done | **C16 (derived verify_status)** | self-assertion |
| deploy authorization | **SDLC state (D7)**; Class-C → Founder | a person/signature |
| promote a lesson to the framework | **scaled §11 panel** → Founder | a single agent |
| any irreversible Class-C act | **Founder** | any agent |

---

## 16. Definition of Done & success criteria for the runtime

**The runtime is DONE when, per phase, an independent VERIFY confirms on the real surface (carried from RA-DOS
§13/§14, with the §17 additions):**
- **DoD-1** durable spine is the sole state; killing any reconciler/agent/session loses no progress.
- **DoD-2** a statically-unreachable goal is **refused at the pre-flight gate before any sprint** (incident replay).
- **DoD-3** an effort-without-progress loop is **halted from outside the loop and summons the Founder**, with the
  **dead-man's-switch proving the supervisor was alive** to do so.
- **DoD-4** no >300s work behind a serverless route; long work is durable/checkpointed/idempotent.
- **DoD-5** production validates no *traffic* first; HE-1…HE-6 each have a non-local catch surface.
- **DoD-6** author≠verifier holds at slice (CI-binding), goal (GS), orchestration (verifier-owned observation).
- **DoD-7** the Founder operates via Slack: summoned with evidence; the 8-question screen answerable in ≤2 min
  from derived state.
- **DoD-8** zero competing/hidden legacy behavior (one of each model; no inert scaffolding; no drift).
- **DoD-9 (new)** every failure class F1–F15 is detected externally, recovered from durable state, and escalates
  only when no auto-recovery exists — *no silent failure*.
- **DoD-10 (new)** the durable circuit-breaker / idempotency / dead-letter / portfolio-cost stores exist and a
  reconciler restart does **not** reset a breaker or double-execute.

**Success criteria:** the Discovery incident is impossible (refused at pre-flight, or bounded-halt-and-summon
from outside the loop); the prod/migration incident class is impossible (staging + parity + state-gated deploy);
Founder burden falls without relaxing safety; single models, no hidden legacy; built = operating; the autonomy
noun is reserved for the Founder Absence Test.

---

## 17. The complete walkthrough — "Founder submits a goal" → "Founder receives the completed result"

The centerpiece: exactly what happens internally at every stage, the owner of each decision, and the failure
branches. (Stages S1–S12; *italic = failure branch*.)

**S1 — Submit.** Founder types a goal in Slack. **C1** validates identity, creates a `GoalContract` message →
**C2-STATE** (durable). *Owner: Founder (objective).* PO state: `CREATED`.

**S2 — Contract.** **C2-MIND** (a bounded Claude session) parses the objective → acceptance metric + canonical
external source + **metric-fitness attestation (C4b)** + budget. PO state: `FEASIBILITY`.

**S3 — Pre-flight (the PRIMARY safety gate).** **C9** runs the serverless-ceiling lint + precedent/reachability
check. *Normal:* reachable → PO state `ACTIVE`. ***Failure F5:*** unreachable → PO state `HALTED`; a
**feasibility FAP** is emitted to the Founder (with the evidence). **The Discovery incident dies here — at hour
0, before any effort.** Founder decides redirect/accept/kill.

**S4 — Sprint plan.** The reconciler tick sees `ACTIVE`/no-open-sprint → invokes **C2-MIND** to plan sprint 1:
frozen objective + acceptance criteria + work packages. Sprint state: `PLAN→EXECUTE`. *Owner: C2-MIND (plan);
the frozen criteria are metric-fitness-checked.*

**S5 — Dispatch.** Each work package → **C15** resolves owner+agent+skills+knowledge → `DispatchPlan`+spawnPrompt
→ **C3** spawns a **C4 specialist**. *Owner: dispatch-route.*

**S6 — Build & verify.** **C4** grounds (read-canonical-first) → builds one slice → posts `WorkResult`. **C5**
(author≠verifier, disjoint scope) verifies on the **real surface** → posts `VERIFY`. ***Failure F8:*** verify
fail → defect flows author-ward → re-dispatch. ***Failure F1/F2:*** C4 hangs/crashes → tick detects → bounded
restart from durable state → (breaker → dead-letter → FAP if exhausted).

**S7 — Monitor (every tick, in parallel with S5–S6).** **C13** advances ready steps (liveness). **C7 GS**
(independent) re-probes the metric under its own identity → appends a `ProgressSample` → computes dGoal/dEffort.
*Normal:* progressing → continue. ***Failure F6:*** flat delta → **GS trips → HALT → feasibility FAP → Founder**
(the incident's mid-run cure, from *outside* the loop, no human needed to notice). ***Failure F4:*** if the GS
itself goes silent, **C8 dead-man's-switch alarms the Founder.** ***Failure F7:*** slow-asymptotic → the H1 cap
eventually forces a review (the named open problem).

**S8 — Completion review.** Reconciler sees all work posted (or a GS early-trip) → Sprint `REVIEW`. **C6**
(independent, stakes-gated) adjudicates the **three-way verdict** against the frozen criteria. *Owner: C6, never
the PO.*

**S9 — Branch.** *complete* → **C16 DoD** validation (derived `verify_status`) → Sprint `DONE`. *incomplete-but-
reachable* → PO opens the next sprint (S4), re-planning from verified state, discarding the stale tail. *unreach-
able* → PO `HALTED` → feasibility FAP → Founder.

**S10 — Ship.** On objective-complete, the slices ship through **C19**: local→QA→staging (HE-1…HE-6 caught
here)→prod, **state-gated (D7)**; Class-C (merge-to-main, prod-deploy) → **Founder boundary** (a summon).
***Failure F9–F11:*** unsafe state / unhealthy / drift → fail-closed; no promotion; auto-rollback. ***Failure
F14:*** Slack down → non-SaaS fallback (Class-C fail-closed).

**S11 — Complete or boundary.** PO state `DONE` (objective complete) OR a Founder boundary (Class-C act the
machine cannot perform). The boundary = STOP = SUCCESS; the next autonomous segment is a fresh `/goal` after the
Founder acts.

**S12 — Result.** **C1** delivers the result/summary to the Founder via Slack (and the 8-question single-screen
reflects it, derived). The Founder receives the completed result — having been interrupted only at S1, at genuine
boundaries, and here.

**Invariant across all 12 stages:** every interaction is a durable bus message; every decision has the single
owner of §15; every failure is detected by a component external to the failing unit and recovered from durable
state; the Founder is summoned only with evidence, only at boundaries.

---

## 18. Internal-consistency assertions (what the spec guarantees about itself)
- Every component in §2 has a lifecycle (§3–§9), a place in the flow (§10/§17), an owner in the matrix (§15), and
  a failure path (§14).
- Every message in §8.2 has a producer and consumer that exist in §2; no component communicates off-bus.
- Every state machine (§4.3 PO, §9.1 sprint, §8.1 run/step) terminates (objective-complete | boundary | cap) —
  no infinite loop.
- Every "who decides" in §17 matches §15; author≠verifier holds at all three seams.
- The §17 build-authorization separation holds: panel-gated components (C2-organ, C10, C1-Slack) are *specified*
  but tagged **[BUILD: panel-gated]**, not authorized by ratifying this spec.

---

## 19. Status & the approval gate
**CANDIDATE specification.** It is the complete, buildable architecture; it makes no new architectural decisions
later by design. Per the founder directive, it is **not** implementation planning and **not** the Master
Migration Blueprint — those follow once this spec is *complete, internally consistent, and approved*. §16 (the
appended panel) challenges its completeness and internal consistency before approval. The honest limit: this
proves the architecture *specifiable and consistent*; the proof slices (author≠verifier, post-ratification)
prove it *correct in build*.

---

# PART II — the deepened specification (every behavior, fully defined)

> Part I (§1–§19) specified the components and the spine. Part II specifies **how the complete system behaves**
> — the full Founder journey, the PO decision model, the Claude Code runtime in detail, every agent runtime, the
> sprint runtime, the complete state-machine set, the communication model, sequence diagrams, per-component
> failure behavior, scaling, security, the capability runtime, the runtime interfaces, and the Founder UX. The
> §17 separation holds throughout: **specifying ≠ authorizing**; panel-gated components are fully specified and
> tagged. The two genuine *empirical* unknowns (the headless-invocation spike; slow-asymptotic convergence) are
> flagged **[VALIDATE]** — they are not undecided architecture, they are facts to confirm in the proof slices.

## 20. The complete Founder Journey (area 1)

The Founder's end-to-end experience, every interaction · decision point · approval · escalation · notification.

| Stage | What the Founder does/sees | Decision the Founder owns | What the runtime does | Notification |
|---|---|---|---|---|
| **J1 Submit** | types a goal in Slack (`/goal …` or natural language) | *the objective* | C1 creates the Goal Contract; C2-MIND drafts acceptance metric + fitness | ✅ "Goal received — I'll come back when I need you or when it's done." |
| **J2 Feasibility** | (usually nothing) | — | C9 pre-flight adjudicates reachability | only if unreachable → **J2-esc** |
| **J2-esc Unreachable** | reads a **feasibility FAP** card | **redirect / accept-lower-bar / kill** | PO `HALTED`; waits | ⛔ "This objective isn't reachable as stated — here's why, here are your options." |
| **J3 Autonomous run** | nothing (no progress chatter) | — | sprints execute under GS supervision | (silent; queryable any time) |
| **J3-q Query** | asks "status?" / "where is X?" | — | derived read of the 8-question screen | 📊 the single-screen, ≤2 min to read |
| **J4 Stall** | reads a **feasibility/strategy FAP** (flat goal-delta) | **redirect / accept / kill** | GS halted the loop | ⚠️ "We've stopped making progress toward X — here's the evidence and the decision." |
| **J5 Operational gate** | approves/denies a **money/comms-out** action | **approve / deny** (identity-bound) | the action waits (fail-closed) | 🔔 an Approve/Deny card with the exact action + evidence |
| **J6 Class-C gate** | approves a **merge-to-main / prod-deploy / payment / contract** | **approve / deny** | state-gated; waits for the human | 🔒 a Class-C card |
| **J7 Strategic ruling** | answers an **architectural/strategic** question | the ruling | a §11 panel informs; the Founder decides | 🧭 a one-screen verdict + signature line |
| **J8 Credentials** | supplies a **secret/OAuth/access grant** | the grant | a presence-probe detected the gap | 🔑 zero-tech provisioning steps |
| **J9 Supervisor failure** | reads a **dead-man's-switch alarm** | (acknowledge / investigate) | the GS went silent; nothing is watching | 🚨 "The supervisor stopped responding — autonomous work is paused." |
| **J10 Complete** | reads the **result/summary** | (accept) | objective complete; DoD validated | ✅ "Done — here's what was delivered, verified, and shipped." |

**Journey invariants:** the Founder is interrupted **only** at J2-esc, J4–J9 (genuine boundaries) and J10
(completion) — **never for routine progress**. Every interruption is **summon-with-evidence** (the decision +
the evidence + the zero-tech action, in one card). Every boundary is **resumable** (`/goal resume`). The Founder
can **Query (J3-q) any time** without interrupting the run. **The felt experience:** *"I ask for outcomes, not
tasks; I'm left alone unless a decision is genuinely mine; when I'm needed I'm handed everything to decide in
under two minutes; and I can look in whenever I want and understand the whole state at a glance."*

## 21. The Project Owner runtime — decision model, replanning, escalation, recovery, shutdown (area 3)

Beyond §4. The PO's *internal logic*, fully specified.

### 21.1 The decision model (what the PO decides, and how)
At each boundary, **C2-MIND** runs a deterministic-where-possible decision procedure:
1. **Prioritization.** Order the remaining work packages by `(unblocks-most-downstream, closes-most-goal-delta,
   lowest-risk-first)` — de-risk-early (§9 Governance): the thinnest vertical slice that moves the acceptance
   metric, riskiest-unknown-first. *Ties broken by dependency order.*
2. **Sprint sizing.** The next sprint = the smallest set of work packages whose completion makes the acceptance
   criteria **independently evaluable** (evidence-bounded; never a fixed duration). If a single package can't be
   independently checked, it is split until it can.
3. **Replanning trigger.** Re-plan at a sprint boundary from **verified state**, **discarding the stale plan
   tail** (anti-windup — never accumulate plan authority across sprints). Re-plan **only while the goal-delta is
   moving**; a flat delta **revokes** autonomous replanning → escalate (C9).
4. **What the PO never decides:** feasibility (→ GS/Founder); whether a slice is verified (→ C5); whether to halt
   (→ GS); any Class-C act (→ Founder).

### 21.2 The escalation ladder (cheapest-reversible-first)
The PO escalates by the *minimum* intervention that fits the signal:
`nudge (re-order work, no founder) → re-plan (new sprint, no founder) → GS-trip (halt + summon: feasibility) →
Founder boundary (Class-C / strategic)`. It **never** jumps to "summon" for something a re-plan handles, and
**never** auto-continues past a flat delta or a Class-C act. *Escalation is rate-limited by evidence (§11
economics) to avoid the 75-lens over-fire.*

### 21.3 Recovery behavior
The PO holds **no essential RAM state** (everything is in C2-STATE + the ledgers). On a reconciler crash, the
next tick re-reads durable state and resumes at the exact PO/sprint state (crash-equivalent to fresh start). A
**half-applied boundary** (e.g., a sprint plan written but dispatch not yet emitted) is reconciled idempotently:
the tick re-derives desired-vs-observed and emits only the missing actions (de-dup keys prevent double-dispatch).

### 21.4 Shutdown behavior (the lifecycle the founder asked for)
The PO has explicit terminal shutdown, never a dangling process:
- **DONE (success):** objective complete + DoD validated → emit the result (J10) → **archive** the Goal Contract
  (durable, read-only) → release any leases → the reconciler stops scheduling this goal (no idle loop).
- **HALTED (boundary):** emit the FAP → **suspend** (the contract is durable; the reconciler does not tick a
  halted goal until `/goal resume`).
- **FAILED (cap):** emit the failure FAP → archive → stop.
- **CLOSED (founder kill):** archive → release → stop.
- **SUSPENDED (freeze):** all scheduling paused; durable state frozen; resumes to the prior state on un-freeze.
*In every terminal state: leases released, no orphaned workers (in-flight agents are drained or dead-lettered),
the ledgers sealed, the single-screen reflects the terminal state. No PO ever lingers as an idle daemon.*

## 22. The Claude Code Runtime — execution-runtime architecture (area 4)

How Claude Code is *used as the execution runtime* (deepening §5). **[BUILT harness; the headless invocation is
[VALIDATE] — the Phase-0 spike].**

1. **Started by:** the PO reconciler at a boundary (headless `claude -p`), OR the Founder via Slack (a `/goal`).
   *Under G9, this session IS the main loop for its segment — the only thing that may spawn sub-agents.*
2. **Receives context via the spawnPrompt** (assembled by `dispatch-route`, never ad-hoc): the objective + the
   relevant slice of the Goal Contract + the **injected skills and knowledge** (content-bound, cited@hash;
   injection firewalled from adoption, G9 C2) + the durable-state handles (bus refs, ledger refs) it may read.
   *It does NOT carry prior-session memory in context — memory is the durable ledger it reads (the within-run
   context-loss cure).*
3. **Plans work** by reading the current durable state (desired-vs-observed) and selecting the next slice — it
   does not re-derive the whole plan (that's the PO's boundary intelligence); it executes the dispatched package.
4. **Spawns specialist sub-agents** (G9: in-loop) for the slice's sub-tasks, each with its own dispatched
   context.
5. **Returns results** by posting `WorkResult`/`VERIFY` to the bus completer (the only output channel) — never a
   side-effect outside the bus without an idempotency key.
6. **Ends** when: the dispatched work is posted (normal), a boundary is hit (emit FAP), or the **H1 cap** trips
   (forced failure FAP). **It never idles or waits for a human** — it terminates and the reconciler picks up the
   durable state next tick.
*Failure:* crash → no essential state lost (progress is on the bus) → reconciler relaunches from durable state;
cap-trip → failure FAP.

## 23. Specialist / Research / Review / Verification agent runtimes (area 5)

Four ephemeral agent types (deepening §6), each with communication · ownership · retries · recovery · memory ·
termination.

| Agent | Owns | Communication | Retries/Recovery | Memory | Terminates when |
|---|---|---|---|---|---|
| **Specialist (C4)** | building one slice (production code) | reads dispatch context; posts `WorkResult` | hang→tick restart (bounded)→breaker→dead-letter; crash→re-read | reads the durable ledger + injected knowledge; holds none | slice posted / boundary / cap |
| **Research (C4-R) [DESIGNED]** | read-only investigation (no production writes) | posts a `ResearchResult` (findings + citations) | same bounded-restart; idempotent (read-only = safely re-runnable) | reads sources; writes findings to the durable store | findings posted |
| **Verification (C5)** | independent verification on the real surface | disjoint write-scope (tests/e2e/evals); posts `VERIFY` | re-run on flaky (within retry budget); a real fail is not a retry | reads the impl + acceptance criteria; owns "observed state" | VERIFY posted |
| **Review (C6)** | conformance/simplicity/scope verdict; §11 lens; sprint completion verdict | posts a `Verdict`; owns no files | — (a verdict is single-shot) | reads the artifact + the frozen criteria | verdict posted |
*All four are **ephemeral, hold no essential state** (memory = the durable ledger), are **spawned by the Claude
Code Runtime (G9)**, communicate **only via the bus**, and are subject to **bounded restart + circuit breaker +
dead-letter** (durable, §8.3). Research agents are the safe-to-retry class (read-only); irreversible work stays
human-gated.*

## 24. The AI-native Sprint runtime — full lifecycle (area 6) [BUILD: panel-gated]

Deepening §9. Specified in full; built per its own §11 doctrine panel.
- **Creation:** the PO opens a sprint when the goal is `ACTIVE`/no-open-sprint, or after an
  `incomplete-but-reachable` review.
- **Planning:** freeze objective + acceptance criteria (metric-fitness-checked, C4b) + work packages (§21.1
  sizing/prioritization).
- **Execution:** dispatch → C4 build → C5 verify, in parallel where independent.
- **Continuous supervision:** the engine tick (liveness) + the GS (dGoal/dEffort); the GS may force an **early
  completion review** on a flat delta.
- **Intermediate reviews:** *optional, stakes-gated* mid-sprint checkpoints for long sprints (a thin verify of a
  partial increment) — **not** a wall-clock organ (that was cut, sprint-§8); they ride the existing verify-gate.
- **Completion review:** the independent three-way verdict (§9.2).
- **Automatic replanning / follow-up sprints:** `incomplete-but-reachable` → the PO auto-opens the next sprint,
  re-planning from verified state, discarding the stale tail.
- **Final completion:** `complete` → DoD validation → goal `DONE`. **Bounded** by objective-complete OR
  feasibility-boundary OR the H1 cap (the slow-asymptotic case is **[VALIDATE]/open**, §7.2).

## 25. The complete state-machine set (area 7)

All runtime state machines in one place (the prior ones + the missing ones).
- **Project/Goal (C2-STATE)** — §4.3.
- **Sprint (C10)** — §9.1.
- **Run/step (C11 bus)** — `pending → executing → blocked → executing → completed | failed-terminal | recovered`
  (CAS-guarded; blocked holds no lease).
- **Claude Code Runtime (C3)** — `SPAWNED → RUNNING → POSTED → TERMINATED` (+ `RUNNING → CAP-TRIPPED → failure
  FAP`; + `crash → (reconciler relaunch)`).
- **Agent (C4/C4-R/C5/C6)** — `DISPATCHED → WORKING → POSTED → TERMINATED` (+ `WORKING → STALLED → RESTARTED(n) →
  DEAD-LETTERED`; + `crash → re-read → relaunch`).
- **Review (C6)** — `REQUESTED → ADJUDICATING → {complete | incomplete-reachable | unreachable} → POSTED`.
- **Deploy (C19)** — `local-ok → qa-ok → staging-ok → prod-authorized(D7 state) → released | rolled-back`
  (each rung fail-closed; Class-C → Founder).
*Every machine has explicit terminal states; none can loop forever (each is bounded by completion, a boundary, or
the H1 cap).*

## 26. The communication model (area 8) — who may talk to whom, how, under which rules

**The one rule (restated, load-bearing):** **no component calls another directly; every interaction is a durable,
idempotent, CAS-guarded write/read on the Result Bus.** The permitted edges:

| From → To | Mechanism | Rule |
|---|---|---|
| Founder → C1 | Slack (Socket Mode) | identity-bound; never an instruction source for privileged acts |
| C1 → C2-STATE | bus (`GoalContract`/`FounderDecision`) | authenticated; the goal API is the boundary |
| C2-MIND → bus → C15 | `SprintPlan`/`WorkPackage` | the PO plans; it never spawns (G9) |
| C15 → C3 | `DispatchPlan`+`spawnPrompt` | injection firewalled from adoption (G9 C2) |
| C3 → C4/C4-R/C5/C6 | in-loop spawn (G9) | only the main-loop session spawns |
| C4/C4-R/C5/C6 → completer | `CallbackEnvelope` | idempotent (dup=no-op), CAS (advance-where-mine-and-blocked) |
| C7/C13 → goal-delta ledger | `ProgressSample` | the GS re-probes the metric under its own identity |
| C7 → C2-STATE / C1 | `GoalDeltaVerdict` / `BoundaryFAP` | the GS judges; the PO never judges its own progress |
| C8 → C1 | alarm | a different failure domain than the GS |
| any scheduler → C11 | bus lease (SKIP-LOCKED/CAS) | **no out-of-band mutation of step state** |
**Forbidden edges (explicitly):** agent↔agent direct messaging; the PO spawning agents; any component mutating
bus state without a lease; chat directing a privileged action; a worker writing a side-effect without an
idempotency key. *These forbidden edges are what make every flow crash-recoverable and injection-safe.*

## 27. Sequence diagrams (area 9)

**(a) Normal execution.**
```
Founder→C1: submit        C1→C2: GoalContract        C2-MIND→C9: feasibility(reachable)
C2-MIND→bus: SprintPlan    bus→C15: dispatch          C15→C3: spawnPrompt
C3→C4: spawn               C4→completer: WorkResult   C5→completer: VERIFY(ok)
C7(tick)→ledger: ProgressSample(moving)               C2-LOOP→C6: completion review
C6→C2: verdict(complete)   C16: DoD ok                C19: ship (state-gated)   C1→Founder: result
```
**(b) Failure recovery (specialist hang).**
```
C4: (no transition N)   C13(tick): STALLED detected   C2-LOOP: bounded restart from durable state
C4': WorkResult         …if restart budget exhausted→ breaker OPEN(durable)→ dead-letter→ C2→C1: boundary FAP
```
**(c) Blocked execution (await an external callback).**
```
C4→completer: emit task, step→BLOCKED (no lease held)   …time passes…
external→completer: CallbackEnvelope(matches awaitingEventId)   completer(CAS): BLOCKED→EXECUTING   C2-LOOP: continue
(crash while blocked → re-read state; nothing to un-stick)
```
**(d) Founder approval (Class-C).**
```
C2/C19→C1: BoundaryFAP(class=merge-to-main)   C1→Founder: Approve/Deny card (identity-bound)
Founder→C1: approve   C1→bus: FounderDecision   deployment-auth: state now satisfied   C19: promote
(Slack down → non-SaaS fallback; Class-C fails-closed = waits)
```
**(e) Deployment.**
```
DONE→C19: local-ok→qa-ok(verify-gate)→staging(HE-1..6 + parity)→ deployment-auth(D7 state check)
→ prod canary (closed-loop) → binding health gate: ok→released | ALARM→auto-rollback(flag)
```
**(f) Project completion.**
```
C6: verdict(complete)→C16: DoD(derived verify_status=verified)→C2: DONE→archive contract→release leases
→C1→Founder: result + single-screen reflects DONE→ reconciler stops scheduling this goal (no idle loop)
```

## 28. Failure & recovery per component (area 10)

| Component | On failure | Detected by | Recovers via | Escalates |
|---|---|---|---|---|
| **Project Owner (reconciler)** | crash mid-tick | next scheduled tick | re-read durable state (crash-equiv fresh) | — |
| **Claude Code Runtime** | session crash / cap-trip | the reconciler / H1 cap | relaunch from durable state / forced failure FAP | cap → Founder |
| **Workers (C4/C5/…)** | hang / crash | tick (no transition) / no lease | bounded restart / re-read | breaker→dead-letter→FAP |
| **Result Bus / queue** | DB unavailable | health probe | the bus IS the durable store; on recovery, all reconcilers resume (no state lost) | infra alarm |
| **GitHub Actions (reconciler/GS lane)** | cron late / job fail / **billing** | the **dead-man's-switch** (different domain) | a late tick is safe (resync); a failed job re-runs next cron | **GS-silent → Founder alarm** |
| **Scheduler (engine tick)** | tick missed | level-triggered backstop | next tick re-derives; events only accelerate | — |
| **Governance (a gate)** | gate unreachable | fail-closed by construction | block (never fail-open) | the blocked boundary surfaces |
| **Goal Supervisor** | silent | dead-man's-switch | — | **Founder alarm** (autonomous work pauses) |
*The invariant: **every component's failure is caught by something external to it**, recovered from **durable
state**, and **no failure is silent** (the P-substrate/P-operate incident class is structurally killed).*

## 29. Scaling architecture (area 11) — 1 → hundreds of projects → thousands of agents

| Scale | What changes | Bottleneck | Mitigation (deferred until pulled) |
|---|---|---|---|
| **1 project** | one PO, one bus | none | — (N=1 Waterline) |
| **Tens** | N POs (stateless reconcilers, horizontal); one shared bus | reconciler cron concurrency | parallel reconciler jobs; per-project lease scoping |
| **Hundreds** | N goal contracts; thousands of ephemeral agents | **shared Postgres bus** (SKIP-LOCKED contention); **founder-summon queue** | partition the bus by project / read-replicas; **summon triage** (Class-C + feasibility first); **admission control** (spawn-rate + queue-depth bounds) |
| **Thousands of agents** | high spawn rate | cost; rate limits | **portfolio cost ledger** budget bounds; backpressure; per-project concurrency caps |
**Why it scales:** the unit is the **goal**, not a team; reconcilers are **stateless** (scale horizontally); the
only shared spine is the **durable bus**; there is **no management layer** to scale. **Founder attention is the
ultimate scarce resource** — bounded by D6 founder-verifiable narrowing + summon-with-evidence + summon triage,
so 100 projects do **not** mean 100× the interruptions.

## 30. Security architecture (area 12)

- **Authority boundaries:** the Founder holds all irreducible authority (§3); agents **draft**, humans **act** on
  any outward/irreversible Class-C act (send/charge/publish/delete/merge/deploy). No agent holds an unguarded
  Class-C tool.
- **Approval flow:** identity-bound (the approver's identity, not channel membership); a Class-C boundary is a
  durable bus gate that **fails closed** until a `FounderDecision` clears it.
- **Permissions:** least-privilege tools per agent (dispatched scope); the permission classifier is a **4th
  enforcement layer** (a refused token mint / premature prod action is correct, not an error).
- **Deploy authority:** **state-gated (D7)** — authorized by SDLC state against a once-set lane policy +
  FREEZE kill-switch; **never** a per-deploy signature; migrations expand/contract + parity-gated.
- **Secret management:** secrets live in **platform stores** (Vercel/GitHub/Supabase), **never** working-tree
  `.env`; the config registry records *presence/owner*, never values; the GS's prod-read uses a **least-privilege
  read-only** credential; chat-exposed secrets are rotated.
- **Execution isolation:** ephemeral agents run in isolated sessions (worktrees day-1 for file work); the bus is
  the only cross-agent channel; **prompt injection is a control-plane attack surface** — chat/fetched content is
  **never** an instruction source for privileged actions; authority comes only from the signed control path.
- **Audit:** the durable bus + dispatch-log + the transcript are the append-only audit of every autonomous
  action (who/what/why/verified) — the cheapest answer to "what did the fleet do."

## 31. The Capability runtime (area 13) — discovery · versioning · invocation · composition · inheritance

- **Discovery:** capabilities are `*.capability.json` in the **capability registry** (C18); `capability-route`
  resolves by id/facets; `dispatch-route` injects the right skills/knowledge per work package (content-bound,
  cited@hash).
- **Versioning:** the **base mints versions** (F1); a version cut = base changelog + tag + the inheritance
  trigger; consumers adopt by **pin** at named moments. A capability climbs the **governance ladder** (exists →
  reachable → validated → observable → trusted → enabled) and earns the right to **gate** only when calibrated
  (verifier-must-be-evaluated; advise-until-enabled).
- **Invocation:** by id via the dispatched spawnPrompt (skills) or `knowledge-route` (knowledge); injection is
  **firewalled from adoption** (G9 C2 — injected count never proves adoption; organic cited recurrence does).
- **Composition:** a higher capability **composes lower ones by id** (e.g., a goal-success verifier composes
  domain verifiers) — never re-implements them; the dedup gate prevents bespoke duplicates.
- **Inheritance:** mechanical — a framework change → version bump → the scaffolder + version boundary →
  **every future project inherits**; the **no-backflow lint** keeps project nouns out of the agnostic core;
  promotion into the base is a **scaled §11 panel** (recursive). **Built ≠ operating** (AX-9): a capability
  with no firing mechanism is not done.

## 32. Runtime interfaces (area 14) — the logical interface catalog (no code)

Each interface = `(producer, consumer, payload, mechanism, guarantee)`. *Logical contracts, not signatures.*

| Interface | Producer→Consumer | Payload | Mechanism | Guarantee |
|---|---|---|---|---|
| **I-Goal** | C1→C2-STATE | GoalContract | bus | durable; one per goal_id |
| **I-Plan** | C2-MIND→C15 | SprintPlan/WorkPackage | bus | idempotent per sprint_id |
| **I-Dispatch** | C15→C3 | DispatchPlan+spawnPrompt | bus | logged; injection-firewalled |
| **I-Work** | C4→completer | WorkResult | CallbackEnvelope | idempotent; CAS |
| **I-Verify** | C5→completer | VERIFY(+goal_metric_reachable) | CallbackEnvelope | independent; fingerprinted |
| **I-Progress** | C7/C13→ledger | ProgressSample | bus append | metric externally re-probed |
| **I-Verdict** | C7→C2/C1 | GoalDeltaVerdict/BoundaryFAP | bus | the GS judges, not the PO |
| **I-Summon** | C2/C7→C1→Founder | BoundaryFAP | Slack card | identity-bound; resumable |
| **I-Decide** | C1→bus | FounderDecision | bus | authenticated |
| **I-Deploy** | C19↔deployment-auth | state signals | bus | state-gated (D7); fail-closed |
| **I-Lease** | any scheduler↔C11 | step lease | SKIP-LOCKED/CAS | no out-of-band mutation |
| **I-Alarm** | C8→C1 | GS-silent alarm | external monitor | different failure domain |
*Every component pair that must interact has exactly one interface here; there are no implicit/undocumented
interactions (the consistency assertion, §18).*

## 33. The Founder user experience (area 15) — seen · hidden · when · feel

- **What the Founder sees:** submit acknowledgements; **boundary summons** (feasibility, Class-C, operational,
  strategic, credentials, supervisor-alarm); **answers to queries** (the 8-question single-screen); the **final
  result**. Each is one self-contained, zero-tech, decision-ready card or screen.
- **What is intentionally hidden:** sprint mechanics, dispatch, agent spawns, verification internals, the bus,
  the reconciler ticks, retries/recoveries, every green per-slice gate — **all the activity.** The Founder sees
  *outcomes and decisions*, never *tasks and progress* (agents are *on* the loop, not *in* it).
- **When updates are sent:** **only** at genuine boundaries (a decision is genuinely the Founder's) and at
  completion — plus **pull-on-demand** queries. **No standups, no progress pings, no dashboards to watch.**
- **The final operating feel:** *"I run a company by stating objectives and making the few decisions only I can
  make. The system does everything a machine can, leaves me alone until it genuinely needs me, hands me a
  two-minute decision with all the evidence when it does, never thrashes silently, never surprises me in
  production, and tells me when it's done. I can look in any time and understand the whole state at a glance — but
  I never have to."* This is the **Founder Absence Test** as a daily experience: the system advances real work
  across the Founder's absence, summons with evidence, and is fully reconstructable from the single screen.

---

# PART III — data contracts, core scope, and consistency (the panel-required completions; AUTHORITATIVE)

> Two blind lenses (completeness/buildability + consistency/re-inflation) returned **BUILDABLE-WITH-CONDITIONS /
> CONSISTENT-WITH-FIXES.** Their findings are **conceded** and resolved here. **Part III supersedes Parts I–II
> where they conflict.** It (35) defines the missing planner→executor data contracts; (36) defines the
> MetricProbe substrate and pulls it into the core; (37) adds the **core-only walkthrough + core-only DoD** that
> closes the narrative-level firewall breach; (38) makes the state machines total; (39) reconciles every internal
> contradiction authoritatively; (40) is the consolidation. The two genuine empirical unknowns stay **[VALIDATE]**.

## 35. The planner→executor data contracts (closes completeness B1/B2/B4, SF7)

The one root cause of the six under-specified areas: the seam between the LLM planner (C2-MIND) and the
deterministic reconciler was named but not schematized. Defined here.

### 35.1 `WorkPackage` (the unit of dispatchable work)
```
WorkPackage {
  wp_id, sprint_id, objective_slice(text),
  contract_refs[](canonical contracts/consumer code/SoT to ground on),
  depends_on[](wp_id),                       // dependency edges → downstream-unblocking
  goal_delta_estimate(0..1),                 // expected contribution to the acceptance metric
  risk_class(low|med|high),                  // de-risk-early ordering
  owner_policy_hint(agent/domain-pack),
  acceptance_handle(see §35.4),              // how THIS package's done-ness is checked
  kind(build|investigation|verify|review)    // routes to C4 | C4-R | C5 | C6
}
```
*This makes buildable:* the reconciler's desired-vs-observed diff (§4.4), the §21.1 prioritization
`(unblocks-most-downstream via depends_on, closes-most-delta via goal_delta_estimate, lowest-risk via
risk_class)`, and dispatch idempotency (`wp_id`).

### 35.2 `SprintPlan` (the frozen plan)
```
SprintPlan {
  sprint_id, goal_id, frozen_objective, frozen_acceptance(see §35.4),
  fitness_attestation_ref(§36.4), work_packages[](WorkPackage), budget_slice
}
```

### 35.3 C2-MIND output contract + the deterministic plan-validation gate (closes B2)
C2-MIND (the LLM boundary-intelligence) **emits a structured `SprintPlan` only** (never free prose acted on
directly). Before `PLANNING → EXECUTING`, the reconciler runs a **deterministic plan-validation gate** (no LLM):
- schema-valid · `depends_on` is **acyclic** · every WorkPackage has an `acceptance_handle` · `Σ budget_slice ≤`
  the contract cap · every `kind` routes to a real agent.
- **On fail → PO state `PLANNING → HALTED(plan-invalid FAP → Founder)`** (the totality fix, §38). *This is what
  makes the "deterministic executor downstream of an LLM planner" guarantee real rather than hollow.*

### 35.4 Two acceptance modes (closes B4 — the non-numeric-goal gap)
A goal/sprint/work-package declares one mode at authoring (C2-MIND chooses; the fitness check §36.4 validates):
- **METRIC mode:** `{metric, op, target, probe(§36)}`. Evaluated **deterministically by the GS** (re-probe value;
  compare). *(e.g., `floor ≥ 20`.)*
- **CRITERIA mode:** an enumerated, frozen list of **independently-checkable criteria**, each a *boolean probe*
  (§36) or a *VERIFY-artifact handle* (C5). `complete` ⇔ **all** criteria probes pass. *(e.g., "invoice delivery
  works" → {migration 0035 applied (probe); delivery row created on send (VERIFY); callback flips status
  (VERIFY); idempotent on re-send (VERIFY)}.)*
The **completion review (C6)** adjudicates the three-way verdict over the *evaluated* criteria/metric, never a
subjective read. *This is how a non-numeric goal reaches a concrete `complete`/`incomplete`/`unreachable`.*

### 35.5 Research agent wiring (closes SF7/CL-4)
A WorkPackage with `kind=investigation` routes to **C4-R (RC-research)**, which posts a **`ResearchResult`**
(findings + citations) consumed by **C2-MIND at the next planning boundary**. Registered in §39's catalog
reconciliation. Read-only ⇒ safely retriable.

## 36. The MetricProbe substrate + I-Probe (closes B3 — pulled into the CORE)

The GS is core; it cannot be built around an undefined probe. **Specified and moved to Phase 1/3 core.**

### 36.1 `MetricProbe` (a registered, versioned probe descriptor)
```
MetricProbe {
  probe_id, type(sql|http|script), target(query|endpoint|script_ref),
  expected_shape, credential_ref(least-privilege, read-only), version
}
```
Stored on the GoalContract (`acceptance.metric_source` = a `probe_id`). The GS invokes it **under its own
identity** with the least-privilege read-only credential — *the independent observation the whole safety case
rests on.*

### 36.2 `I-Probe` interface (added to §32)
`(producer: C7 GS → consumer: MetricProbe runtime; payload: probe_id; mechanism: direct read under GS identity;
guarantee: independent of the acting agent, least-privilege, versioned).`

### 36.3 The pre-flight reachability evaluator contract (closes the C9 black box)
The pre-flight gate (RC-preflight) has two parts, both specified:
- **Serverless-ceiling lint — deterministic** (a static check: any work whose worst-case runtime can exceed the
  lane ceiling behind a serverless route → `unreachable`). Buildable as-is.
- **Reachability/precedent check — LLM, with a deterministic decision rule:** inputs = {the acceptance
  metric+probe, the current measured value, the historical max (precedent), the available inputs/levers}. The LLM
  emits a **structured verdict** `{reachable: bool, confidence, evidence}`; the **deterministic rule**:
  `reachable=false → HALTED(feasibility FAP)`; `reachable=true ∧ confidence ≥ θ → ADMIT`; **malformed or
  `confidence < θ` → fail-closed → summon Founder** (never silently admit). *Fail-closed at the primary safety
  gate.*

### 36.4 The metric-fitness (C4b) contract
At each sprint plan: an LLM check `is <metric> the objective itself or a verified leading proxy?` → structured
`{fit: bool, rationale}`; deterministic rule: `fit=false → block the plan, escalate (independent reviewer/Founder
decides the metric)`; malformed/low-confidence → fail-closed. *Reduces but does not eliminate the metric-selection
frame-lock (the honest limit, RA-DOS §15.3); backstopped by the hard caps.*

## 37. Core-only scope — the walkthrough and DoD the Phase 0–3.5 safety core satisfies ALONE (closes consistency B-1/B-2)

The decisive consistency finding: Parts I–II told the *only* end-to-end story through the panel-gated Sprint
Engine + Slack + PO-organ, and baked Slack into DoD-7 — so the ratifiable core could not satisfy the runtime's
own DoD. Fixed here.

### 37.1 The CORE-ONLY walkthrough (human-present; no panel-gated component)
*What ratification of Phase 0–3.5 actually buys — buildable today, deterministic, valuable in the human-present
model regardless of the autonomy noun:*
```
S1′ Founder starts a /goal (Claude Code session, present — OR a fallback channel; NOT the panel-gated Slack surface)
S2′ C2-MIND drafts the GoalContract (acceptance mode + probe + fitness)        [Phase 1]
S3′ Pre-flight gate (RC-preflight) — serverless-ceiling lint + reachability — refuse-or-admit (fail-closed)  [Phase 2, PRIMARY]
S4′ The session executes work (the EXISTING delivery loop: build → author≠verifier on the real surface → DoD)  [BUILT]
S5′ The Goal Supervisor (RC-gs, arithmetic, external metric re-probe) + the engine tick watch goal-delta;
    on flat-delta → HALT → summon (FAP) via the non-SaaS fallback; the dead-man's-switch guards the GS  [Phase 3]
S6′ Ship through local→QA→staging→prod, state-gated (D7); Class-C → human-gated boundary  [Phase 3.5]
S7′ DONE (DoD validated) — or a Founder boundary (FAP via fallback). The Founder is summoned with evidence.
```
*No autonomous Sprint loop, no PO-organ auto-sprinting, no Slack surface — those are the panel-gated autonomy
layer ON TOP of this core. The core is the goal-governed, supervised, safely-shipped delivery loop in the
human-present model. The full Parts I–II walkthrough (§17) is this core PLUS the panel-gated autonomy layer.*

### 37.2 DoD split — the CORE DoD (satisfiable without any panel-gated component)
| | Core DoD (Phase 0–3.5; ratifiable) | Panel-gated capability DoD (each its own §11) |
|---|---|---|
| state | DoD-1 (durable spine sole state) | — |
| feasibility | **DoD-2** (pre-flight refuses unreachable) | — |
| supervision | **DoD-3** (halt-and-summon from outside the loop + dead-man's-switch) | — |
| substrate | DoD-4 (no >300s on serverless) | — |
| validation | DoD-5 (prod never validates traffic first; HE-1…6) | — |
| author≠verifier | DoD-6 (slice/goal/orchestration) | — |
| failure | DoD-9 (no silent failure) + DoD-10 (durable breaker/idempotency/dead-letter/cost) | — |
| founder summon | **DoD-7′ (CORE):** the Founder is summoned with evidence at boundaries via the **non-SaaS fallback channel**; FAPs are well-formed and resumable | **DoD-7-Slack (panel):** the Slack operating layer + 8-question single-screen |
| autonomy | — | **DoD-AUTON (panel):** unattended auto-sprinting passes the Founder Absence Test |
*The core has a Definition of Done it can fully satisfy with zero panel-gated components. The Founder Absence
Test + the Slack single-screen are the panel-gated capability DoD, not the core's.*

### 37.3 Tagging discipline (closes the narrative breach)
Every panel-gated component, **at every point of use** (not only §2): the Sprint Engine (RC10), the PO-organ
auto-loop (RC2-organ), the Slack surface (RC1-slack), the C6 sprint-review — are **[BUILD: panel-gated]** in §1,
§10, §17, §20, §25, §27 by this reference. The §17 (Parts I–II) walkthrough is explicitly the **core + the
panel-gated layer**; §37.1 is the **core alone**. *Specifying them in full ≠ authorizing their build (§17/§19).*

## 38. State-machine totality (closes SF5 / CL-9 / CL-12)

Every state defines a transition for `{component-error, dead-letter, founder-freeze}` (or explicitly no-ops and
stays). The added/corrected transitions:
- `CREATED —contract-draft-fail→ HALTED(infra FAP)`
- `FEASIBILITY —gate-error(≠unreachable)→ HALTED(infra FAP)`
- `PLANNING —plan-invalid(§35.3)→ HALTED(plan-failure FAP)`
- `EXECUTING —breaker-exhausted/dead-letter→ HALTED(dead-letter FAP → Founder)`  *(the missing F15→PO seam)*
- `REVIEWING —no-verdict→ HALTED(review-failure FAP)`
- **H1-cap reconciliation (CL-9):** `ANY —H1-cap→ FORCED-REVIEW` → the three-way verdict runs with a
  `cap_tripped` input → almost always `unreachable → HALTED(cap FAP)`; a clean `complete` is still possible. *(The
  cap forces a review; the review — not the cap — decides terminal. Replaces the §4.3 "cap→FAILED" direct edge.)*
- **Intermediate review (CL-12):** add `EXECUTING —stakes-gated-checkpoint→ EXECUTING` (a no-op-on-pass
  mid-sprint verify that rides the existing verify-gate; it does not change sprint state — it can only raise a
  defect that re-dispatches). *Not a new state-changing organ.*
*Totality rule stated: a building team needs no invented transitions — every state×event is defined here or is an
explicit no-op-and-stay.*

## 39. Consistency reconciliations (authoritative; supersedes Parts I–II per row)

| # | Contradiction | Authoritative resolution |
|---|---|---|
| CL-1/S-1 | pre-flight per-sprint vs sprint-1-only | **Serverless-ceiling lint (deterministic): every sprint plan.** **Reachability/precedent (LLM): sprint-1 + HALTED→resume + on a GS flat-delta re-derivation only** (cost discipline). §9.1's per-sprint `PRE-FLIGHT` state = the cheap lint; §17-S4 is corrected to include it. |
| **B-3**/CL-2 | C13 listed as a `ProgressSample` producer (violates liveness≠progress) | **Split the message:** `LivenessSample` (producer **C13 only** — "work is moving") vs `ProgressSample` (producer **C7 GS only**, externally re-probed — "the goal is moving"). C13 is removed from every `ProgressSample` producer set (§8.2/§26/§32). |
| CL-3/S-2 | "no direct calls" vs C3→C4 spawn | **One sanctioned direct edge:** the **G9 in-loop spawn** (C3 → its sub-agents). *All other* interaction is via the bus. §0/§8.1/§18/§26 are read with this carve-out: "no off-bus *data/result* channel; the sole direct edge is OS-level spawn." |
| CL-4/S-3 | C4-R / `ResearchResult` unregistered | **Registered:** RC-research in the component register; `ResearchResult` in the message catalog (producer C4-R → consumer C2-MIND) and as an interface (§35.5). |
| CL-5/S-4 | `ProgressQuery` vestigial | **Deleted.** Progress reaches the PO by reading `ProgressSample` from the ledger; there is no separate query message. |
| CL-6 | `WorkPackage` message status | **A WorkPackage is a field of `SprintPlan`, not a separate bus message** (§35.2); dispatch keys on `wp_id`. |
| CL-7/S-5 | C9 has no comm contract; §27(a) shows a direct C2-MIND→C9 arrow | **Reachability rides the GoalContract `reachability_assertion` field, written by the pre-flight gate; add a `FeasibilityVerdict` producer (RC-preflight) → consumer (C2-STATE) to the catalog/§32.** The §27(a) arrow is the gate writing that field. |
| CL-8/S-6 | halt owner = C7 only (§15) | **Halt is owned by three (by trigger):** RC-gs (no-progress), RC-preflight (unreachable), RC-review (review-unreachable) — all route to the Founder. §15 broadened. |
| CL-10/S-8 | §18 overclaims every-component-has-a-failure-path | **§28 extended** with rows for RC-preflight(C9), RC-dispatch(C15), RC-verifygate(C16), RC-learning(C17), RC-config(C18), RC-memory(C20), RC1: each is fail-closed (a gate/registry that can't read → block, never fail-open). |
| CL-11/S-9 | BoundaryFAP vs C8 alarm split | **Unified family:** all Founder summons are `BoundaryFAP` with a `boundary_class`; the dead-man's-switch emits `BoundaryFAP{class=supervisor-failure}`. One type, one render path. |
| CL-13 | agent machine granularity §6↔§25 | **Canonical:** `DISPATCHED→WORKING→POSTED→TERMINATED`; the §6 sub-steps (GROUNDING/BUILDING/SELF-VERIFYING) are **internal phases of WORKING**, not top-level states. |
| CL-14 | freeze missing from the Founder journey | **Added J0-FREEZE:** the Founder may FREEZE (kill-switch) at any time → PO `SUSPENDED`; un-freeze resumes. (A standing Founder authority, §30.) |
| CL-15 | BoundaryFAP idempotency key collision on repeat same-class boundaries | **Key = `goal_id + boundary_class + boundary_seq`** (a monotonic per-goal counter) — two `merge-to-main` summons never dedup to one. |
| CL-16/S-9 | C-number namespace collision (component Cn vs panel Cn vs G9 Cn) | **Components are renamed `RC1…RC20` (Runtime Component)** by this reference; bare `Cn` in Parts I–II = the runtime component `RCn`; panel findings stay `C1–C13`; G9 findings stay `G9-Cn`. A building team reads component ids as `RC`. |
| S-11/RI-2 | retained "single owner of every project" daemon rhetoric | **Dropped** (per RA-DOS §17.1): the PO is the durable goal-contract **state** (the accountability locus) + the scheduled loop + ephemeral mind — **not** a single always-running owner-agent. The three-class decomposition stands; the daemon rhetoric is removed. |

## 40. Final panel consolidation & status

**Both lenses: the spine and the Phase 0–3.5 safety core are sound; the conditions are about the planner→executor
data contracts (now filled, §35–§36), the core-only scope/DoD (now added, §37), state-machine totality (§38), and
~16 local contradictions (now reconciled, §39).** With Part III, the document:
- **meets the buildability bar for the authorized scope** — the Phase 0–3.5 core is specified end-to-end (schemas,
  probe substrate, core walkthrough, core DoD, total state machines) with **no architectural question a team must
  invent**; and
- **fully specifies the panel-gated autonomy layer** (PO-organ, Sprint Engine, Slack) to design depth with its
  data contracts, **honestly fenced** (core-only walkthrough + core-only DoD + point-of-use tags) so
  *specification ≠ authorization* now holds at the narrative and DoD levels, not just the register.
- The two genuine empirical unknowns stay **[VALIDATE]** (the headless-invocation spike; slow-asymptotic
  convergence) — facts to confirm in proof slices, not undecided architecture.

**Status: CANDIDATE specification, ready for founder review of (a) the Phase 0–3.5 core for ratification and (b)
the fully-specified panel-gated layer for its per-component §11 panels.** It makes no new architectural decisions
later *for the core*; the panel-gated layer's *build* (not its architecture) is each its own panel. The honest
limit: proof slices (author≠verifier, post-ratification) prove it correct in build. Only after this specification
is approved does the **Master Migration Blueprint** map it onto the existing codebase — which is the explicitly
deferred next step, not started here.

*(End of Part III. Part IV makes the operating-model principles explicit.)*

---

# PART IV — the Operating Model Invariants (the seven principles, made explicit; AUTHORITATIVE)

> The founder asked that seven operating-model principles be investigated and, if sound, made explicit before the
> architecture is frozen. **Finding: all seven are architecturally sound and already present in the design — they
> were under-explicit because the prior panels (correctly) fenced the *unattended-autonomous-execution BUILD* as
> panel-gated, which obscured that the *ownership MODEL itself* is core.** This Part states the seven as binding
> invariants (OM-INV-1…7), each with the honest refinement and the **core-doctrine vs panel-gated-build** tag.
> **The decisive distinction (which resolves the recurring tension):** the *ownership model* — a project is never
> ownerless, supervision never stops, DoD is the objective — is **CORE DOCTRINE, not deferred**; the single thing
> still gated is the *build of the unattended-autonomous-execution mechanism* (a reconciler launching headless
> sessions to auto-open sprints with no human present), behind its §11 panel + the headless-invocation
> `[VALIDATE]` spike. **The model is core; only that build is sequenced.**

### OM-INV-1 — A project is never ownerless (persistent operational ownership). **[CORE DOCTRINE]**
*From intake to DoD, one Project Owner is continuously responsible.* **How it is satisfied:** ownership IS the
durable **RC2-STATE** goal-contract object (§4.1) — it exists from the first `GoalContract` write until a terminal
state (DONE/CLOSED), owns planning/prioritization/supervision/replanning/acceptance (§21), and **persists through
every process restart** (§5/§14/§21.3). **Refinement (the honest challenge):** "persistent" means a **durable
state object continuously reconciled**, *not* an always-running in-memory process — a daemon is SPOF + state-loss
+ idle-cost (rejected by Kubernetes/Temporal/DBOS evidence; RA-DOS §17). Ownership never lapses **because the
state is durable**, not because a process never sleeps. *The state-object PO is core; the auto-loop organ build is
OM-INV-3.*

### OM-INV-2 — Continuous supervision, not fire-and-forget. **[SUPERVISION = CORE · unattended auto-continuation = panel-gated build]**
*The PO continuously observes, collects evidence, monitors progress, interrupts stalled/misaligned work, requests
intermediate reviews, redirects, and continues until the goal is met or a Founder decision is required.* **How it
is satisfied:** while a goal is `ACTIVE`, the **engine tick** (liveness) + the **Goal Supervisor** (progress —
external metric re-probe, dGoal/dEffort) run **every cycle** (§7); a stalled worker is interrupted (bounded
restart, §14-F1); the GS halts-and-summons on no-progress (§7.2); intermediate stakes-gated reviews ride the
verify-gate (§38). **Refinement (scoped to prevent re-admitting the rejected per-tick driver):** "continuous" =
**level-triggered reconciliation reading durable state each tick**, *not* an LLM driving every tick
(cost/non-determinism — intelligence at boundaries). The core can detect and interrupt a **stalled** worker
(deterministic: no transition within N) and **halt on a flat goal-delta** (the GS) — it **cannot** detect
fine-grained "**misaligned-but-active**" work without exactly the per-tick LLM driver §11 rejected, and
**unattended "redirect / re-plan / continue"** is the **gated** boundary-intelligence (the PO-organ), not a core
capability. The clause "continue until the goal is achieved **or a Founder decision is required**" is sound —
*"or a Founder decision"* IS the feasibility/Class-C escape (the anti-incident bound). **Core vs build:** the
*supervision* (tick + GS + halt-summon + stalled-worker restart) is **CORE**; *unattended misalignment-redirect
and auto-continuation with no human present* is the autonomy-layer build (panel-gated + the headless
`[VALIDATE]` spike).

### OM-INV-3 — The AI-native Sprint Loop; execution never stops merely because agents finished their tasks. **[PRINCIPLE = CORE · sprint-engine build = panel-gated]**
*Every sprint = planning → execution → continuous supervision → sprint review → completion OR automatic next
sprint.* **This invariant has two halves; the split is the whole honesty of it (the §43 fix):**
- **The GATING half — CORE.** *Tasks-finished is never `done`; only the objective-gate decides.* Satisfied in the
  core (human-present) by (a) the GS enforcing goal-governance (a flat goal-delta halts-and-summons, never a
  silent stop) and (b) within a `/goal` session, the present main loop pursuing the objective to the H1 cap, not
  stopping because one task finished. *The runtime is goal-governed, not task-governed.* This is core, and it is
  the discovery-incident cure.
- **The GENERATIVE half — PANEL-GATED BUILD.** *The unattended **auto-creation of the next sprint with no human
  present** (the §9.2 three-way verdict's `incomplete-but-reachable → next sprint` actuated automatically) is the
  Sprint Engine (RC10) + the PO-organ auto-loop — `[BUILD: panel-gated]` (§24/§37.3), and §37.1 explicitly states
  the core has **no autonomous sprint loop**.* Across a segment boundary the **core** continues via a fresh
  `/goal` after the Founder acts (§17-S11); the **unattended** auto-create is the gated actuator (its §11 panel +
  the headless `[VALIDATE]` spike). **Do not read §9.2 as a core satisfier — it is the gated mechanism.**
**Bound (non-negotiable, on the built loop):** `objective-complete OR feasibility-boundary (unreachable →
halt-summon) OR the H1 cap` — never infinite; the **slow-asymptotic** case (positive-but-creeping delta) is
bounded **only by the cap** and is the named `[VALIDATE]`/open cost-runaway problem (§7.2, §43-D).

### OM-INV-4 — Founder involvement boundaries. **[CORE DOCTRINE]**
*The Founder is involved only for strategic decisions, priority changes, irreversible actions, or final approval;
the PO absorbs operational complexity.* **How it is satisfied:** the Founder is summoned only at genuine
boundaries (Journey J2-esc, J4–J9, completion; §20), via summon-with-evidence; D6 founder-verifiable narrowing
means non-founder-verifiable work auto-continues after automated verification; all routine activity is hidden
(§33). **No refinement needed — sound and core.**

### OM-INV-5 — Persistent ownership across runtime restarts. **[CORE DOCTRINE — the strongest thread]**
*If runtimes/workers/machines fail, the PO retains ownership and continues orchestration after recovery without
losing context or requiring Founder intervention.* **How it is satisfied:** the durable-state/stateless-compute
law — a crash loses **no essential RAM state** (everything is in RC2-STATE + the ledgers); the next scheduled
tick re-reads durable state and resumes at the exact PO/sprint state (crash-equivalent to fresh start; §4.3, §14
F1–F3, §21.3, §28); a blocked step holds no lease (crash-while-blocked is trivial). **No Founder intervention is
required for recovery.** *Sound, core, and validated by the consistency lens as the spec's cleanest thread.*

### OM-INV-6 — Runtime ownership rules — never ambiguous. **[CORE DOCTRINE]**
*Define which runtime owns each responsibility; the PO is the single owner of project execution.* **How it is
satisfied (the ownership matrix, §15, made explicit here):**
| Owns | Runtime | Never owns |
|---|---|---|
| **the project** (objective, planning, prioritization, supervision, replanning, acceptance) | **RC2-STATE (Project Owner)** | building, verifying, deploying |
| **a /goal segment's execution** (the main loop; spawns sub-agents, G9) | **RC3 (Claude Code Runtime)** | the project; feasibility |
| **performing one task** (a slice / investigation) | **RC4 / RC4-R (specialist / research)** | validating its own work |
| **verifying results** (author≠verifier, the observed state) | **RC5 (verification)** | building |
| **judging goal-delta / halting** | **RC7 (Goal Supervisor), independent** | driving work |
| **irreducible decisions** (objective, feasibility verdict, Class-C, final approval) | **the Founder** | operational detail |
*Ownership is single-valued and durable; author≠verifier holds at the slice, goal, and orchestration seams.
Sound, core.*

### OM-INV-7 — Definition of Done for autonomous delivery = the objective met, not tasks finished. **[CORE DOCTRINE — the heart]**
*A project is complete only when the original business objective and acceptance criteria are satisfied; if not,
the PO automatically creates the next sprint.* **Two halves again (the §43 fix):**
- **The DoD-GATING semantic — CORE, the heart of the entire program.** DoD = the acceptance criteria (§35.4
  metric/criteria mode), validated **independently** (RC5/RC6/RC16, derived `verify_status`); **task-completion
  alone is never `done`** (the discovery incident's central lesson — the loop "completed tasks" while `floor=8`
  never moved). This gate is core and operates human-present: when the objective is not met, the runtime does
  **not** declare done — it continues (human-driven) or **the GS halts-and-summons**. *This is the invariant that
  makes the incident impossible, and it is core.*
- **The GENERATIVE half — PANEL-GATED.** *The PO **automatically** creating the next sprint **with no human
  present** is the gated actuator (consistent with §37.2, which places `DoD-AUTON` / auto-sprinting in the
  panel-gated capability DoD, not the core DoD).* It is satisfied only post-§11-panel + post-`[VALIDATE]`-spike.
**Feasibility escape (non-negotiable on the built loop):** `unreachable → halt → summon Founder` — without it,
"auto-create until the goal is achieved" *is* the 9-hour incident with ceremony. **The DoD-gating principle is
CORE; the unattended auto-creation build is panel-gated.**

### OM-INV summary — what is now explicit, and what remains gated
- **CORE DOCTRINE (binding invariants, not deferred):** OM-INV-1 (persistent-state ownership, never ownerless) ·
  OM-INV-2 supervision (tick + GS, continuous) · OM-INV-4 (Founder boundaries) · OM-INV-5 (ownership across
  restarts) · OM-INV-6 (explicit ownership rules) · OM-INV-7 **principle** (DoD = objective, not tasks). *These
  are the operating model; they are core and now explicit.*
- **PANEL-GATED BUILD (fully specified; build sequenced, not the model):** the *unattended-autonomous-execution
  mechanism* — the PO-organ auto-loop (RC2-organ) + the Sprint Engine (RC10) + the Slack operating surface (RC1)
  — gated on their §11 panels + the headless-invocation `[VALIDATE]` spike. *The model they implement is core;
  their build is sequenced.*
- **None of the seven is architecturally unsound.** Each is incorporated; each refinement is a *clarification*
  (persistent = durable state, continuous = level-triggered, auto-continue = bounded by the feasibility escape),
  not a rejection. The honest line held: **the ownership MODEL is core and explicit; only the unattended-build
  SEQUENCING is gated** — which is what every prior panel was actually protecting.

---

## 43. Final adversarial check on Part IV — findings, the honest founder sentence, and the challenge (AUTHORITATIVE)

An independent lens reviewed Part IV: **DISTINCTION-HOLDS-WITH-FIXES.** The verdict confirmed the
ownership-model-vs-unattended-build distinction is **architecturally real** (declarative ownership *state* vs the
*actuator* that reconciles it — the L0-vs-L2 split the whole document rests on), and that the tags + the §41
summary preserve the firewall. But it caught **OM-INV-3 and OM-INV-7 citing the panel-gated Sprint Engine (§9.2,
RC10) as the satisfier of a *core* invariant** — the same DoD-7/Slack breach recurring at the invariant layer.
**Conceded and fixed** above (OM-INV-2/3/7 now split the core *gating* half from the gated *generative* half).

### 43-C — The one sentence to the founder, stated sharply (not buried)
> **The ownership MODEL and the goal-governed Definition of Done you asked for — a project is never ownerless,
> supervision never stops, completion means the *objective* met not the *tasks* finished — are CORE and now
> explicit (OM-INV-1…7). The literal thing asked for four times — the system *automatically creating the next
> sprint, unattended, with no human present, until DoD* — is **fully specified but its BUILD is still gated**,
> behind exactly one unproven harness fact (the headless-invocation `[VALIDATE]` spike) and its §11 panel. We are
> NOT deferring the model. We are de-risking the single empirical unknown before building the autonomy noun.**

Stated plainly so it cannot be misread: **you have the model; the unattended-execution machine is one spike away
from being buildable, not one decision away from being deferred.** The human-present core (§37.1) honors every
invariant *today* — it pursues the objective, refuses unreachable goals, halts-and-summons on no progress, never
declares done on mere task-completion, and recovers across restarts — with the Founder driving the cross-segment
continuation. The autonomy build replaces "the Founder starts the next segment" with "the reconciler does,
unattended." That replacement is the whole of what is gated.

### 43-D — The challenge the founder asked for: "execution never stops until the objective is achieved" is unsound *as an absolute*
A rigorous reviewer must push back on this framing, not just accommodate it. **"Never stop until achieved" is
sound only carrying all three bounds** — `objective-complete OR feasibility-boundary OR the H1 cap`. For the
**slow-asymptotic class** (a goal whose metric creeps positively but never practically arrives, or a mis-chosen
proxy that "moves" while the true objective doesn't), **the GS does not trip (it trips on *flat*, not
slow-positive), so the only operative stop is budget-exhaustion at the H1 cap.** That means the requested loop's
failure mode there is **"burn the budget to the cap," not "stop gracefully"** — a real, named **cost-runaway
property of the very loop being requested** (§7.2, §15.1; `[VALIDATE]`/open). The honest position: *do not build
the unattended auto-loop believing "it stops when done" is universally true* — for the slow-asymptotic class it
stops only when the money runs out, and closing that gap (a rate-of-convergence floor: require the delta to
*project* hitting the target within budget, not merely be positive) is **an unsolved problem owing its own
evidence and §11 panel**, not a footnote. This is the one place the founder's framing is not yet architecturally
safe, and it is surfaced here as a precondition of the autonomy build, not filed away.

### 43-E — What holds (the net)
- **All seven principles are architecturally sound and now explicit;** none was rejected (the refinements are
  clarifications, not rejections).
- **The ownership MODEL (OM-INV-1/4/5/6 + the gating halves of 2/3/7) is CORE doctrine** — not deferred, honestly
  core, and satisfiable by the human-present Phase 0–3.5 core today.
- **Only the unattended-autonomous-execution BUILD is gated** — fully specified, sequenced behind its §11 panel +
  the headless `[VALIDATE]` spike; the firewall (tags, §37.2 DoD split, the §41 summary, and now the OM-INV-2/3/7
  body splits) holds at every level — register, narrative, DoD, and invariant.
- **One genuine architectural caution stands (43-D):** "never stops until achieved" is unsafe for the
  slow-asymptotic class; the rate-of-convergence floor is the open problem to close before/with the autonomy build.

*(End of Part IV. Part V adds the infrastructure-independence and runtime-operations interfaces — the freeze-gate
concerns.)*

---

# PART V — Infrastructure Independence & Runtime Operations (the freeze-gate concerns; AUTHORITATIVE)

> The founder's final review named nine foundational concerns. **Finding: each is a genuine gap at the
> *interface/abstraction* level — the spec is buildable but is *coupled* to Claude / Slack / GitHub Actions /
> Vercel in places and is not yet infrastructure-independent by contract.** Part V closes them by specifying
> **stable Runtime interfaces (contracts/responsibilities), not technologies** — this is *not* a redesign of core
> behavior; it is the abstraction boundary the concerns correctly identify as missing. **Discipline held:** the
> *interfaces* are the architecture (specified now); the *sophisticated implementations* (a second provider, a
> second execution environment, a global scheduler, multi-version coexistence) are **builds deferred-until-pulled
> (Waterline)** — the current single implementations are the only adapters built today. Two honest constraints
> are stated and not papered over: the **G9 ceiling** limits *orchestration*-provider/environment-independence
> (only the Claude Code main loop spawns), and **autonomous self-modification is forbidden** (self-evaluation
> produces evidence; humans + §11 decide).

## 44. The Infrastructure Independence principle (concern 9 — the umbrella)
**The Runtime depends only on CONTRACTS (responsibilities), never on a named technology. Every infrastructure
dependency sits behind a stable Runtime interface; the named technologies (Claude, OpenAI, Ollama; GitHub
Actions, Vercel, workers; Slack, Web, CLI) are *interchangeable adapter implementations* of those interfaces.**
Swapping or adding an implementation behind an interface **must not change Runtime behavior** — that is the
acceptance test for every interface in §53. *Today the current implementations are the only adapters built; the
interface guarantees a second can be added (pulled by need) without touching the core.*

## 45. Resource Management (concern 1) — `I-Resource`
**Responsibility:** govern finite resources across all projects. **Contract:**
- **Global scheduling / admission control:** new work is *admitted, queued, or refused* against capacity (a
  bus-queue-depth + concurrency check) — fail-safe: refuse-or-queue beats overload.
- **Concurrency limits:** per-project + global caps on live agents / spawn-rate (backpressure).
- **Queue management:** the durable bus IS the queue; `I-Resource` sets its depth bounds + drain priority.
- **Budgets:** token/cost via the **portfolio-cost ledger (already core, §8.3)**; **compute/GPU** budgets enter
  only with local model servers (§47) — until then the runtime is token/cost-bound, not GPU-bound (stated, not
  invented).
- **Prioritization under contention:** a priority class — `Class-C/founder-waiting > active-goal > background` —
  decides who gets capacity first.
- **Throttling + graceful degradation:** under pressure, **shed background work first, preserve Class-C and the
  safety organs (GS, dead-man's-switch) always** (safety never degrades).
**Tag:** the *interface* + the basic caps/budget are **core-adjacent** (cost safety is needed even at small N —
the cost ledger is already core); the *sophisticated global scheduler* is **scale-pulled** (N=1 Waterline).

## 46. Distributed Runtime / Execution Placement (concern 2) — `I-Placement`
**Responsibility:** the **PO never knows *where* execution happens.** The PO/dispatch emits a work request with
**requirements** (lane: short/long · isolation · provider/privacy hint · resource class); the **Placement
service selects the execution environment** — a Claude Code session, a GitHub runner, a worker process, a local
compute node, or a future node — and the bus is the platform-pluggable substrate behind it. **Contract:**
`requirements → selected-environment` (opaque to the PO). **Honest constraint (G9):** the *orchestration* main
loop (the spawner) is currently Claude-Code-bound; **work placement** (specialists/verifiers/research) is the
pluggable surface. **Tag:** the *interface* is core doctrine (the PO is placement-blind by design); the
*multi-environment build* is pulled by need (today: Claude session + GitHub runner).

## 47. LLM Provider Abstraction (concern 3) — `I-Provider`
**Responsibility:** **the Runtime never depends on a single model provider.** A work request carries a **task
profile** (reasoning-depth · latency-need · **privacy-class** · cost-ceiling · suitability); the **Provider
Selector** picks `Claude | OpenAI | Gemini | Ollama/vLLM | OpenRouter | future` by a policy over
*(quality, latency, privacy, cost, availability, suitability)*. **Contract:** `task-profile → provider+model`.
**Privacy is a first-class selection axis** (e.g., **PII → a local Ollama/vLLM, never a 3rd-party API** — ties to
security §30). **Honest constraint (G9):** the *orchestration* main loop is Claude Code today; the
**work agents** (specialist/verify/research) are the provider-pluggable surface; a future runtime can swap the
orchestrator when the harness allows. **Tag:** the *abstraction* is core doctrine; the *multi-provider build* is
pulled by the first real driver (a privacy requirement or a cost/quality optimization).

## 48. Human Interaction Layer (concern 4) — `I-Surface`
**Responsibility:** **Slack is the first interface, not the only one.** The Runtime emits **structured artifacts**
(`BoundaryFAP`, result, single-screen data, approval request); the **Interaction Surface** —
`Slack | Web UI | CLI | API | the non-SaaS fallback | future` — is a **pluggable renderer + input adapter**;
**Runtime behavior is surface-independent.** **Contract:** `emit artifact ↔ receive FounderDecision`. *This
cleanly resolves the Slack panel-gating: the **abstraction is core doctrine** (the Runtime is surface-independent
— the CLI/fallback are core surfaces the Phase 0–3.5 core uses); the **specific Slack operating surface** is one
panel-gated adapter.* **Tag:** abstraction core; each surface is a pluggable build.

## 49. Runtime Observability / Mission Control (concern 5) — `I-Ops`
**Responsibility:** a **portfolio-wide, READ-ONLY** observability layer, **derived from the durable stores** (not
a new control plane), covering: active projects · Project-Owner states · agents (live/stalled/dead-lettered) ·
sprint progress · queues (depth/wait) · health · failures (F1–F15 rates) · resource usage · costs · token usage ·
execution history. **It OBSERVES; control stays with the POs/GS/Founder.** The per-project **single-screen
(§3.2)** is the project view; **Mission Control is the portfolio view** (same derived-not-stored discipline).
**Tag:** a read model over the durable spine — architecturally clean, build is straightforward; its *rich UI* is
an `I-Surface` adapter (§48). Core-adjacent (operations need it); rich visualization scale-pulled.

## 50. Runtime Self-Evaluation (concern 6) — `I-SelfEval` (evidence only; NEVER self-modifying)
**Responsibility:** the Runtime continuously evaluates **its own operational behavior** (distinct from the
**Learning Engine §12**, which mines *project-delivery* lessons): it analyzes the observability data (dispatch-log,
F1–F15 failure frequencies, cost ledger, goal-delta histories, agent dead-letter rates, queue waits) for
**recurring bottlenecks · inefficient workflows · failing agents · architectural weaknesses**, and **produces
improvement EVIDENCE** (candidates routed to the capability ledger / a §11 panel). **Hard rule (non-negotiable,
the framework's mechanism-vs-policy + anti-incident discipline): it produces evidence; it NEVER modifies itself
autonomously — humans + §11 decide every change.** **Contract:** `observability → improvement-evidence`.
**Tag:** an analysis read-layer + evidence producer; build pulled by operational scale. *The runtime-operational
complement to the project-lesson Learning Engine.*

## 51. Runtime Versioning (concern 7) — `I-Version`
**Responsibility:** **multiple Runtime versions coexist safely; projects migrate independently.** **Contract:**
- **Versioned contracts:** the message catalog (§8.2) + `GoalContract` + the durable schemas carry a version;
  evolution is **expand/contract** (a v2 runtime reads a v1 goal contract; a v1 runtime tolerates v2's additive
  fields) — *the same expand/contract discipline already core for migrations (§11/C10), applied to the runtime's
  own contracts.*
- **Adopt-by-pin (F1):** each project pins a runtime version and **migrates independently**; the base mints
  versions; the no-backflow lint keeps the core agnostic.
- **The durable state is the compatibility boundary:** the bus/ledgers are version-tolerant, so a v1-project and a
  v2-project **coexist on the same durable spine.**
**Tag:** the *expand/contract contract discipline* is core doctrine; the *multi-version coexistence build* is
pulled by the first real version transition.

## 52. Legacy-Conflict Detector & Override Protection (concern 8) — `I-LegacyGuard`
**Responsibility:** a **STANDING** runtime capability (beyond the one-time Legacy Architecture Audit) that
**detects conflicting legacy behavior that could override the new runtime** during and after migration:
- a **competing scheduler/cron** writing bus state **out-of-band** (violating the bus-lease invariant);
- a **hidden execution path** (a `setTimeout` loop, an un-gated deploy path);
- a **legacy ownership model** (a project advancing with **no Goal Contract / no PO state** — an "ownerless"
  project, violating OM-INV-1);
- any **out-of-band mutation** of step state.
**Override protection is already partly enforced by invariants** (the **bus-lease invariant** = no out-of-band
mutation; **single-owner** = no ownerless project; **state-gated deploy** = no un-gated deploy). `I-LegacyGuard`
makes detection **standing and active**: scan → **fail-closed block / alert**. **Contract:** `scan → conflict
report → block/alert`. **Tag:** the *override-protection invariants* are **core** (already enforced); the *active
legacy-conflict scanner build* is a **migration-phase capability** — it is the runtime's hook into the **Master
Migration Blueprint** (the next phase), so its build naturally lands there.

## 53. The Infrastructure-Independence interface catalog (concern 9 — the adapters)
Every infrastructure dependency → its stable interface → its interchangeable implementations. **The Runtime
depends only on the middle column.**
| Dependency | Interface | Interchangeable implementations (current **bold**) |
|---|---|---|
| LLM model | `I-Provider` (§47) | **Claude**, OpenAI, Gemini, Ollama/vLLM, OpenRouter, … |
| Execution environment | `I-Placement` (§46) | **Claude Code session**, **GitHub runner**, worker, local node, … |
| Human interaction | `I-Surface` (§48) | **Slack** (panel-gated), **CLI/fallback** (core), Web UI, API, … |
| Scheduler substrate | `I-Schedule` (§7.5) | **GitHub Actions cron**, **Vercel cron**, **external monitor**, future orchestrator |
| Deploy target | `I-Deploy` (§11, D7) | **Vercel+Supabase**, … |
| Durable store | the Result Bus (§8.1) | **Postgres**, … |
| Resources | `I-Resource` (§45) | the portfolio ledger + caps |
| Observability | `I-Ops` (§49) | the derived read model |
**Acceptance test for every row:** swapping/adding an implementation **does not change Runtime behavior** (§44).
*Today each row has one or two built adapters; the architecture is infrastructure-independent **by contract**,
and a second adapter is a build pulled by need — never a redesign.*

## 54. Data Classification & Trust Boundary (closes the freeze-gate's one fundamental gap — Cond-1/Cond-2)

The final adversarial review returned **FREEZE-WITH-CONDITIONS**: the core is freeze-ready and Part V is clean
(no redesign, no over-build, honest deferral), but **one fundamental, narrow, contract-level gap** stood — the
`I-Provider`/`I-Placement` **data-trust edge** was *asserted* ("PII → local Ollama, never a 3rd-party API") and
*not specified*, so `I-Provider` failed the §44 acceptance test ("adding an implementation must not change Runtime
behavior") at the PII/secrets boundary. **Conceded and closed here, additively (no redesign):**

### 54.1 `data_class` — the classification carrier (extends §4.1 GoalContract and §35.1 WorkPackage)
A required field on both the durable **GoalContract** (the goal's maximum sensitivity) and each **WorkPackage**
(that unit's sensitivity):
```
data_class ∈ { PUBLIC, INTERNAL, CONFIDENTIAL, PII, SECRET }
```
**Owner:** **C2-MIND classifies at plan time**; the **deterministic plan-validation gate (§35.3) REJECTS an
unclassified package → HALTED(classification-required FAP)** — fail-closed, in the existing discipline. *The
privacy selection axis (§47) now has a real, durable carrier — the gap that made §44 fail is closed.*

### 54.2 The Trust-Boundary rule (constrains `I-Provider` §47 and `I-Placement` §46)
**Selection is a CONSTRAINT first, an optimization second.** `data_class` **gates** which provider/environment is
even eligible, *before* quality/latency/cost optimize within the eligible set:
| `data_class` | Eligible provider (`I-Provider`) | Eligible execution env (`I-Placement`) |
|---|---|---|
| PUBLIC / INTERNAL | any | any |
| CONFIDENTIAL | contractually-bound providers only (DPA in place) | co-located or contractually-bound nodes |
| **PII / SECRET** | **trusted-domain only — local Ollama/vLLM; NEVER a 3rd-party API** | **co-located/trusted nodes only — never an external node** |
*A selection that would place PII/SECRET work on an ineligible provider/node **fails closed** (the work waits or
the goal halts-and-summons) — never silently downgrades the boundary.*

### 54.3 Multi-tenancy isolation (the contract §29 asserted but did not specify)
- **Goal-scoped bus access:** an agent's read/write on the durable bus is **scoped to its own `goal_id`**; a
  project-A agent **cannot read** project-B's GoalContract, ledgers, results, or secrets. *Lease-scoping (§29) is
  concurrency; this is the missing **data-isolation** contract — row-level access keyed on `goal_id`/`tenantId`.*
- **Per-project credential scoping:** each project's secrets are isolated; the least-privilege credentials an
  agent holds are scoped to its goal. Cross-project data on the shared spine is **`tenantId`-only** beyond a
  goal's own scope (the existing seam discipline).

### 54.4 Descriptor reconciliation (closes Cond-2 / NOTE-A) — extends §35.1 `WorkPackage`
Part V's prose descriptors are folded into the canonical schema (the §39 discipline):
```
WorkPackage += {
  data_class(§54.1),
  placement_req { lane(short|long), isolation, resource_class },     // → I-Placement (§46)
  provider_profile { reasoning_depth, latency_need, privacy=data_class, cost_ceiling, suitability }  // → I-Provider (§47)
}
```
*Now the placement and provider selectors have real, schematized inputs — no invented fields at build time.*

### 54.5 Precondition gates (closes Cond-1(c)) — the honesty fix
The previously-decorative guarantees become **explicit precondition gates**, in the `[VALIDATE]`/panel idiom:
**no 3rd-party-provider adapter, no external-execution-node adapter, and no N>1-tenant adapter is buildable until
the data-classification + trust-boundary + tenancy-isolation model (§54.1–§54.4) is implemented behind its own
§11 panel.** At N=1 (single Claude provider, single store, single trust domain) the gap is *vacuous today*; this
converts three asserted guarantees into honestly-gated ones.

## 55. The remaining condition resolutions (Cond-3 + the carried NOTEs)
- **Cond-3 / NOTE-B — kill the "core-adjacent" tag (anti-re-inflation).** §17.7 enumerates the authorized core
  exactly (Phase 0–3.5). `I-Resource` *caps/admission/global-scheduler* (§45) and the `I-Ops` *read model* (§49)
  are **NOT** in that enumeration → re-tagged **DEFERRED build (pulled by operational scale / N>1), each its own
  ratification**; only the *portfolio-cost ledger* + the *preserve-safety-organs-always* rule (already §8.3 /
  §17.7-Phase-1) are core. *"Core-adjacent" is removed — it was the one back-door re-inflation slip, and the
  document's own §17/§40 lesson predicted it.*
- **NOTE-D — per-adapter security conditions on `I-Surface`.** Identity-binding + prompt-injection defense (§30)
  are **per-adapter acceptance conditions on every `I-Surface` implementation** (CLI/Web/API/fallback), not
  Slack-only.
- **NOTE-F — sharpen the G9 framing (concern 9 honesty).** Infrastructure independence abstracts *work-execution,
  interaction surface, scheduler, store, deploy* — but **NOT the runtime's decision INTELLIGENCE**: C2-MIND
  planning, C6 completion review, the §36.3 reachability LLM, and the §36.4 fitness LLM are all **Claude under
  G9**. The runtime's *brain* is Claude-bound (a future runtime beyond the harness could swap it, §15.2); the
  founder is not over-sold — independence is of the *infrastructure around* the brain, not the brain.
- **NOTE-C — admission states (§38 totality honesty):** admission-control `QUEUED/REFUSED` PO states are added
  *with* the deferred global scheduler (§45); §38's totality holds for the core (admission never refuses at N=1).
- **NOTE-E — bus-version skew (§51):** **the Result Bus run/step contract is the one globally-versioned spine**;
  project-scoped contracts version independently (pin-per-project). Deferred-until-the-first-bus-version-change.

## 56. FREEZE DECISION — the Runtime Specification is architecturally complete

With §54–§55 closing the one fundamental gap (the data-trust edge) and the two tidy conditions (descriptor
reconciliation; the "core-adjacent" re-tag), **no fundamental architectural question remains open.** The final
adversarial review's own standard is met: the headline infrastructure-independence concern (`I-Provider`) now
passes its §44 acceptance test, because `data_class` is a durable contract field and the trust boundary is
specified, not asserted.

**Therefore: the Delivery OS Runtime Specification (RA-DOS-v1 + RS-DOS-v1, Parts I–V) is hereby ARCHITECTURALLY
COMPLETE and ready to become the official DEFINITION OF DONE for the Architecture Phase**, on these explicit,
honest terms:
- **The Phase 0–3.5 safety CORE is fully specified, internally reconciled (§39), totalized (§38), and buildable
  without inventing architecture** — and it is what ratification authorizes.
- **The full operating model (OM-INV-1…7) is CORE doctrine and explicit;** the **unattended-autonomous-execution
  build** (PO-organ auto-loop, Sprint Engine, Slack surface, and now the multi-provider/multi-node/multi-tenant
  adapters) is **fully specified and honestly gated** on its §11 panels + the empirical `[VALIDATE]` items.
- **Two genuine empirical unknowns remain flagged, not hidden:** the headless-invocation spike (Phase 0) and
  slow-asymptotic convergence (§43-D). These are facts to confirm, not architecture to invent.
- **Infrastructure independence holds by CONTRACT** (§44/§53) for execution/surface/scheduler/store/deploy/
  provider, with the honest exception that the decision *intelligence* is Claude-bound under G9 (§55/NOTE-F).

Six rounds of independent blind review (the runtime panel · completeness · consistency · the operating-model
invariants · the infrastructure/freeze gate) hardened this specification; every finding across all six was
conceded and resolved or honestly fenced — the firewall between *specifying the model* and *authorizing the
build* held to the end, and the one back-door re-inflation slip ("core-adjacent") was caught and closed at the
freeze gate itself.

**The Architecture Phase is complete. The next phase — explicitly deferred until this Definition of Done is
approved — is the Master Migration Blueprint, which maps this approved Runtime Architecture onto the existing
codebase (and is the natural home of the `I-LegacyGuard` build, §52).**

> **Post-freeze note (2026-06-28):** §56 froze the architecture. Before the Master Migration Blueprint was
> finalized, the founder requested one final architectural review (Configuration & Secret Management). That
> review reopened the freeze for exactly one concern, under blind two-lens §11 discipline, and produced **§57** —
> a founder-authorized, additive extension. §56's freeze stands for everything it covered; §57 adds one
> first-class concern it left implicit. No prior section is redesigned.

---

## 57. Configuration & Secret **Readiness** (`I-Config`) — post-freeze authorized extension (AUTHORITATIVE)

### 57.0 Provenance & determination
The founder observed that across the PLOS implementation, missing/duplicated/inconsistent/incorrectly-managed
configuration and secrets repeatedly caused deployment failures, runtime failures, and blocked implementations —
*often enough to suspect a missing platform capability, not a deployment detail.* This section is the reviewed
answer. Two independent blind lenses ran: a **null-hypothesis skeptic** (argue it is an adoption/enforcement
failure, not a missing capability; a sprawling Config/Secret *Platform* would violate Waterline at N=1) and a
**coverage-and-gap map** (classify each concern against the frozen spec). **They converged:** config/secret
*readiness* belongs as **cleanly-scoped extensions of the existing gates (C9, D7, C13) + a formalization of the
§54 trust boundary — NOT a new subsystem, and NOT the speculative operational platform.**

**Determination — JUSTIFIED, narrowly.** The decisive first-principle is the Runtime's own invariant (§12,
OM-INV): **verification is operationally enforced, not remembered.** Today config/secret correctness is
*remembered* — implicit in §30, scattered across two registries + two validators (CONFLICT-05), with a live
prod-write bypass (CONFLICT-03). For a runtime that spawns ephemeral agents and (later) deploys unattended, a
*remembered* precondition is the same failure class the Runtime was built to eliminate (liveness ≠ correctness).
Therefore **the Runtime must ALWAYS KNOW its config/secret requirements and BLOCK on them as a first-class,
gate-bound contract.** What is **rejected** (the skeptic's valid half, honored): rotation orchestration, health-
monitoring daemons, a full multi-provider abstraction framework, self-healing/auto-remediation, cross-repo
replication — these are operational tooling, **build-on-pull at N≫1**, recorded in **Future ADR Candidates**
(§57.8), and **out of the frozen core**.

### 57.1 The principle — *config & secret readiness is enforced, not remembered*
The Runtime answers, as first-class durable facts (not tribal knowledge), the founder's six questions for every
goal and every deploy: **(1)** which capabilities require which config/secrets; **(2)** which secrets are
required; **(3)** which environments require them; **(4)** whether they currently exist; **(5)** whether they are
valid; **(6)** whether deployment or execution must be blocked. This is the contract; §57.2–§57.6 specify it.

### 57.2 The Config & Secret Registry (formalizes C18 §8.4 + §54; resolves CONFLICT-05)
**One canonical registry schema** (the existing `config-registry.json` + `config-doctor` is the seed
implementation; the two divergent registries/validators consolidate to it). It records **metadata, never
values**: `{ key, owner, source_provider ∈ {vercel|github|supabase|local|…}, data_class(§54.1), env_scope ⊆
{local,dev,QA,staging,prod}, validation_rule, required_per_env }`. **Secrets are config entries with
`data_class ∈ {PII, SECRET}`** and therefore bind to the **§54.2 trust boundary** (a SECRET may be sourced/used
only within a trusted domain; never tree-resident — §30). *The "Central Secret Registry" is this: a secret-
metadata + trust formalization over the existing platform stores, not a new vault.*

### 57.3 Capability config/secret requirements (extends §31 capability registry + §54.4 WorkPackage)
Each capability descriptor (`*.capability.json`, §31) declares, additively (the §39/§54 discipline):
```
capability += { requires_config: [key…], requires_secret: [key…] }   // each entry: {key, data_class, env_scope, rule}
WorkPackage += { config_req: [key…] }                                 // resolved from the capabilities a package uses
```
*This is what makes "**which** capabilities require **which** config/secrets" a first-class, queryable Runtime
fact — read by dispatch-route (C15) and the plan-validation gate (§35.3), not rediscovered per incident.*

### 57.4 `I-Config` — the readiness oracle (added to §32 catalog and §53)
A logical interface (no code): `readiness(scope, env) → { key → PRESENT | MISSING | INVALID | DRIFTED }`,
evaluated over the registry against the live provider planes. **Interchangeable implementations:** `config-doctor`
(current), future providers — passing the §44 acceptance test (swapping the readiness provider does not change
Runtime behavior). Catalog row (extends §53): *Config/secret readiness | `I-Config` (§57) | **config-doctor**
(Vercel/GitHub/Supabase/local planes), …*

### 57.5 Readiness as a NAMED, fail-closed precondition of the existing gates (the enforcement — answers Q6)
*The integration finding of both lenses: bind to the gates, do not build a parallel subsystem.*
- **C9 Pre-flight (§7.3) — reachability input.** A goal whose `requires_config/requires_secret` (for its
  `data_class` and target env) are `MISSING/INVALID` is **statically unreachable** → `HALTED(config-missing FAP)`
  at hour 0, before any effort. *(The PRIMARY-gate now also refuses the config-unreachable goal — the cheapest
  possible catch of the founder's incident class.)*
- **D7 Deploy (§11) — state invariant.** Promotion to an env is **fail-closed** on any `MISSING/INVALID` required
  config/secret for that env. *This makes the previously-implicit `config-doctor → deploy` binding EXPLICIT in
  the spec: "deployment blocks when required configuration is missing" is now a stated gate, not a convention.*
- **C13 Startup (§7.1) — the named startup invariant (closes the gap the map found MISSING).** Before the Runtime
  dispatches the **first** work of a goal, it validates the config/secrets for that work's `data_class`; on
  failure it **halts-and-summons** rather than spawning an agent into a mis-configured environment. *Startup
  readiness is now an explicit precondition, not an implicit assumption.*

### 57.6 `I-LegacyGuard` binding (§52) — standing detection of the incident anti-patterns
`I-LegacyGuard` **standingly** detects and surfaces (to the founder audit/boundary; **evidence-only, never
autonomous remediation** — §50 discipline): **tree-resident secrets**; **prod-write / gate bypass kill-switches**
(e.g. the `ALLOW_PROD_DB_WRITE` class — CONFLICT-03); **configuration drift** (live plane ≠ registry);
**missing or duplicate/shadowed keys** across registries/environments. *The incidents become continuously
caught, not periodically remembered.*

### 57.7 The §44 acceptance test & scope line
`I-Config` passes §44: adding a second readiness provider or a fourth source-plane changes no Runtime behavior —
the gates depend only on the `PRESENT/MISSING/INVALID/DRIFTED` verdict. **CORE (this extension, buildable in the
migration):** §57.2 registry consolidation · §57.3 capability requirements · §57.4 `I-Config` oracle · §57.5 three
gate preconditions · §57.6 `I-LegacyGuard` detections. Each reuses built mechanism (`config-doctor`, the gates,
the capability registry) — additive, no redesign.

### 57.8 Future ADR Candidates (DEFERRED — out of the frozen core; build-on-pull at N≫1; do NOT modify the Runtime)
Recorded here so the architecture is not over-built (the skeptic's valid half): **(F-CSM-1)** automated secret-
**rotation** orchestration (cadence/leak/compromise-triggered) — recorded-failure-pulled or N≫1; **(F-CSM-2)**
secret **health-monitoring** daemon (staleness/expiry/validity re-probe) → `I-Ops` (§49), operational scale;
**(F-CSM-3)** config-**change audit-trail** reader (Vercel/GitHub audit ingestion) → `I-Ops`; **(F-CSM-4)** full
multi-provider **abstraction framework** beyond the existing planes → pulled when a 4th platform is adopted;
**(F-CSM-5)** cross-repo config **consistency auto-validation** → `I-Version` adopt-by-pin (§51); **(F-CSM-6)**
**break-glass** policy machinery beyond the existing **Class-C founder boundary** (§3.1/§12) — the audited,
time-limited, immutable-ledger break-glass that *replaces* `ALLOW_PROD_DB_WRITE` is a **migration task** (it
closes CONFLICT-03), but a richer break-glass *workflow* is deferred; **(F-CSM-7)** secret-**compromise recovery
playbook** → ops runbook + §12 learning, recorded-failure-pulled; **(F-CSM-8)** **self-healing/auto-remediation**
of config — explicitly **rejected** for the Runtime (evidence-only, §50). *None of F-CSM-1…8 is required for the
core to be correct; each is pulled by a real need with its own ratification.*

### 57.9 The one sentence to the founder
*You were right to suspect a missing capability — but the missing piece was not a platform; it was making
config & secret **readiness** something the Runtime is **structurally forced to know and to block on** at the
gates it already has, rather than something an implementer must remember — so this extension makes that
knowledge and that block first-class (`I-Config`, §57.2–§57.6), and deliberately leaves the operational
machinery (rotation, health-monitoring, self-healing) as build-on-pull so the architecture is hardened, not
bloated.*

*(End of §57 — founder-authorized, additively extends C9/D7/C13/§31/§52/§54; §44-clean; no prior section redesigned.)*

*End of specification.*
