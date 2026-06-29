---
artifact: PLAN — Phase 4 (Execution Unification) · Discovery pipeline port onto the engine
id: PLAN-P4-DISCOVERY-PORT-v1
date: 2026-06-29
status: SCOPING SPEC — read-only investigation output. Builds nothing; it is the spec the 4.2→4.9 slices work against.
authoritative inputs (frozen): RUNTIME-CONFLICT-LEGACY-AUDIT (CONFLICT-01) · DISCOVERY-BLUEPRINT · MASTER-MIGRATION-BLUEPRINT (Phase 4) · MASTER-IMPLEMENTATION-ROADMAP · IMPLEMENTATION-TRACKER
role: the per-stage spec + seam map + parity surface + cutover plan for porting the PLOS discovery "second runtime" onto the ONE Runtime.
scope_guard: NO code changed; NO redesign of the engine or the discovery stages. This sequences the port of EXISTING logic onto the EXISTING engine.
repo shorthand: ADM=rumah-admin · PLOS=property-lead-os · DOS=delivery-os
---

# Phase 4 — Discovery Pipeline Port (the spec for 4.2 WRAP → 4.9 retire)

> **The object.** CONFLICT-01: the PLOS discovery pipeline is a complete *second runtime* — its own cron
> scheduler, its own `lead.status` state machine, its own stage orchestrator, its own inline agent loops — with
> **no `workflow_run`, no SKIP-LOCKED lease, no outbox emit.** Phase 4 brings it INTO the one Runtime, stage by
> stage, proving parity at every step, and collapses its crons (which also resolves the Hobby cap-2 conflict).
> **It is the single largest migration object.** This plan is the map.

---

## 0. The load-bearing finding that shapes everything (read first)

**The C11 Result Bus engine is ALREADY vendored and LIVE inside PLOS.** It is not an admin-only thing we must
reach across repos for. `apps/web/lib/engine/runtime.ts` builds a `CapabilityRuntime` via
`createCapabilityRuntime(...)` imported from the byte-identical vendored engine at
`property-lead-os/.claude/os/engine/index.js` (CI drift-gated against DOS source). Today it carries **one**
CapabilityPack — `mailboxDunningPack`.

Two PLOS crons **already run THROUGH this engine**: `/api/cron/dunning-sweep` and `/api/cron/admin-events-drain`
both `enqueue(...)` + `drainEngine(getEngineRuntime())` (`apps/web/lib/engine-drain.ts`). **Only the two discovery
crons bypass it** — `/api/cron/discovery-sweep` and `/api/cron/discovery-seed` call `runDiscoverySweep(...)` /
`runDiscovery(...)` directly. So:

- **"The second runtime" is specifically `discovery-sweep` + `discovery-seed`** (+ their stage libs), NOT all of PLOS.
- **The port target for 4.2–4.6 is the PLOS-local C11 engine** — discovery becomes a **CapabilityPack** alongside
  dunning. This needs **no new cross-repo dependency**: the engine is already here, and the dunning pack is the
  working template.
- The deeper *goal-governance* organs (C2/C7/C9/C10/C12 — `po-autoloop-c2.ts`, `sprint-engine-c10.ts`,
  `goal-contract.ts`, the 0052/0053 durable stores) live in **`ADM/src/` and admin's DB**, NOT yet in PLOS.
  Whether discovery becomes a *governed GOAL* (vs. just an engine workflow) is a **distinct, founder-relevant
  decision** — see §7 (Open Questions Q1). Phase 4's WRAP/port is C11-level; the goal-governance wrapping is the
  consolidation target, not a 4.2 prerequisite.

---

## 1. The pipeline map (concrete, file-cited)

### 1.1 The four Vercel crons (`apps/web/vercel.json`)
| # | Cron path | Schedule | Through the engine today? | What it drives |
|---|---|---|---|---|
| 1 | `/api/cron/discovery-seed` | `0 5 * * *` | **NO** (direct `runDiscovery`) | SEED — find net-new companies (the second runtime) |
| 2 | `/api/cron/admin-events-drain` | `0 6 * * *` | **YES** (`enqueue`+`drainEngine`) | Admin→PLOS event drain + materialize pending invoice_sends |
| 3 | `/api/cron/discovery-sweep` | `0 7 * * *` | **NO** (direct `runDiscoverySweep`) | ADVANCE backlog: research→contacts→promote (+ in-sweep seed) (the second runtime) |
| 4 | `/api/cron/dunning-sweep` | `0 8 * * *` | **YES** (`enqueue`+`drainEngine`) | Overdue dunning sweep + drive runs to prepared draft |

There is also `apps/web/app/api/cron/tick/route.ts` (a pure `drainEngine` tick relay) that is **present but NOT
registered in `vercel.json`** (inert — superseded by admin's heartbeat). **Hobby caps crons at 2** (per the
header comment in `admin-events-drain/route.ts`: a `*/2` heartbeat was "a HARD DEPLOY FAILURE on Vercel Hobby");
4 registered crons therefore already exceed the cap — the `maxDuration:300` ceilings in `vercel.json` also imply
this project must be on Pro today. The cron collapse (§5.7) is what brings PLOS back within Hobby's 2.

### 1.2 The discovery stages (the state machine over `lead.status`)
The pipeline is a **status-guarded state machine over the `leads` table** — `lead.status` IS the discovery state
(no `workflow_run`). The full enum (`packages/core/src/enums.ts`) + transition map (`packages/core/src/lead-state.ts`,
`assertTransition(from,to)` throws on an illegal edge) is the discovery substate machine:

```
new → discovered → researching → qualifying → qualified → outreach_ready → contacted → meeting → won
                       (research)          (contacts)        (promote)         (outreach — out of scope here)
   self-heal/uncertainty: needs_retry · needs_review · insufficient_evidence · monitor · disqualified · lost
```

The orchestrator `apps/web/lib/discovery-sweep.ts` (`runDiscoverySweep(deps)`) advances every lead at a boundary,
**advance-first then seed**, all wall-clock-budget-bounded. The real wiring is `apps/web/lib/discovery-sweep-deps.ts`
(`buildDiscoverySweepDeps(db, now)`), which binds each stage to the **existing stage fns the manual routes already
use**:

| Stage | Orchestrator dep | Existing stage fn (the seam target) | Selects | Writes | LLM/external |
|---|---|---|---|---|---|
| **SEED** | `seed()` → `runSeedStep` | `discovery.ts` `runDiscovery(db, makeDiscoveryProviders, {}, now)` | n/a (finds net-new) | projects, companies, project_contractors, leads(`discovered`), agent_runs | SerpAPI + Playwright + Anthropic; ~300s all-or-nothing txn (`discovery.ts` 258–350); no abort seam |
| **RESEARCH** | `runResearch(target)` | `research.ts` `researchCompany(db, providers, input, now, signal, softSignal)` | `discovered`/`needs_retry` (now) + stale `monitor`/`insufficient_evidence` + self-heal `needs_review` | companies, signals, leads, leadScores, contacts, researchReports, agent_runs | SerpAPI+Playwright+Anthropic; per-lead AbortSignal (180s); freshness-TTL cache |
| **CONTACTS** | `resolveContacts(leadId)` | `contact-intelligence.ts` `resolveContactsForLead(db, providers, {leadId}, now, signal)` | `qualified` with NO usable decision-maker contact | contacts, contact_events, agent_runs | Anthropic + search; email pattern inference |
| **PROMOTE** | `promote(target)` | inline status-guarded UPDATE in `discovery-sweep-deps.ts` (`assertTransition("qualified","outreach_ready")`) | `qualified` WITH a usable contact | leads (status only) | none — pure sub-ms DB update |

Return shapes (the parity payloads): `runDiscovery` → `{kind:"discovered", agentRunId, status, netNewCompanyCount,
projectsUpserted, candidates, costUsd}` \| `{kind:"paused", spentTodayEur, dailyCapEur}`. `researchCompany` →
`{kind:"scored", leadId, leadStatus, status, provisional, attempts, ...}` \| `{kind:"paused"}`. `resolveContactsForLead`
→ `{kind:"resolved", idealBuyer, entryPoint, alternates, ...}` \| `{kind:"paused"}` \| `{kind:"not_found"}`.

### 1.3 Current execution model + idempotency (why it is a "second runtime")
- **Drives itself:** the `discovery-sweep` cron calls `runDiscoverySweep` directly; the orchestrator runs the 4
  stages in-process with three nested wall-clock budgets (per-call, per-lead AbortSignal, between-leads budget)
  and a seed wall-clock slice. **No engine tick, no lease, no run/step rows, no outbox.**
- **Idempotency is `lead.status`-guarded, NOT engine-CAS:** status-gated SELECTs (a researched lead leaves
  `discovered`), `assertTransition` at the persistence boundary, a research **freshness-TTL** cache
  (`getLatestResearchReport`), email-keyed contact upsert (verified emails never re-verified), project/company/
  edge upserts (`onConflictDoNothing`, identity resolver), and a `BARREN_RUN_CEILING` exhaustion stamp.
- **Budget = a shared daily spend envelope:** `A2_DAILY_SPEND_CAP_EUR`, enforced at EACH stage entry
  (`discovery.ts`:220, `research.ts`:498, `contact-intelligence.ts`:287) via `sumAgentRunCostSince(agentName, midnight)`
  over `agent_runs`. Seed adds a 24h cadence + a `discovered`-backlog high-water guard.
- **Fail-closed enablement:** the whole pipeline is inert unless `DISCOVERY_ENABLED && DISCOVERY_SWEEP_ENABLED`
  (`sweepEnablement()`); **OFF by default in prod.** This is what makes the pipeline safe to port in shadow.

---

## 2. The engine-mapping (the seam)

### 2.1 The TARGET framing — discovery as a governed GOAL (the q3 answer)
"Run discovery" maps cleanly onto the engine's goal/sprint model as **ONE long-lived GOAL** (not many):

- **GoalContract** (`ADM/src/goal-contract.ts`): `objective` = "maintain a qualified-lead pipeline"; `acceptanceMetric`
  = a measurable lead-flow target (e.g. *N leads at `qualified`+`outreach_ready`*, or a net weekly flow), re-read by
  a **MetricProbe** (`ADM/src/metric-probe.ts`) over the PLOS `leads` table; `budgetCap` = the existing
  `A2_DAILY_SPEND_CAP_EUR` as `max_cost_cents` + a `max_turns` bound.
- **The Sprint Engine** (`ADM/src/sprint-engine-c10.ts` `runSprint`) is the executor. Its injectable **`Spawner`**
  seam — `(SpawnInput) => Promise<SpawnOutput>` — is **exactly where each existing discovery stage advance plugs
  in**: one spawn = one stage step (research one lead / contacts one lead / promote / one seed). The stage fn's
  result becomes `SpawnOutput.{workOutput, costCents (=the agent_run cost), metricDelta (=lead-status movement)}`.
  The engine writes the attempt/cost/progress evidence through the sanctioned 0052 doors and bounds the work at
  the H1 cap. `asControllerHook(...)` already adapts `runSprint` into the C2 controller's `executor.runSprint`
  hook with zero controller changes.
- **`lead.status` is the per-unit substate; the GoalContract state machine governs the GOAL** (is the pipeline
  progressing / over budget?). The Goal Supervisor (C7) catches *no flow* (dGoal/dEffort flat) from outside the
  loop; the pre-flight gate (C9) refuses an unreachable acceptance target at hour 0.

**Important scoping nuance:** this GOAL framing is the *destination*. The roadmap's **4.2–4.6 are C11-workflow-engine
level** ("each stage a checkpointed step via agent-runner + I-Provider; `lead.status` → engine state") — they put
discovery on `workflow_run`/`workflow_step`/lease/outbox. Wrapping discovery in the *goal-governance* organs
(GoalContract + Sprint Engine + GS/C9) is the natural follow-on that lands with consolidation (4.8) / autonomy
(P5), and depends on resolving where those organs run (§7 Q1). **Phase 4's WRAP does not require the goal organs.**

### 2.2 The C11 seam (what 4.2–4.6 actually wire) — the CapabilityPack
The PLOS engine is a **CapabilityPack** runtime. The seam is therefore: **author a `discoveryPack` CapabilityPack**
registered in `buildEngineRuntime()` (`apps/web/lib/engine/runtime.ts`, alongside `mailboxDunningPack`), whose step
handlers **call the EXISTING stage fns unchanged** (`runResearch`/`resolveContacts`/`promote`/`runSeedStep` from
`discovery-sweep-deps.ts`). Discovery work is then `enqueue("discovery.*", input, idemKey)` + driven by the engine
`tick()`/`drainEngine` — **the identical mechanism dunning already uses.** The engine's CAS lease + `(definitionKey,
idempotencyKey)` enqueue-idempotency + per-step checkpointing replace the bespoke wall-clock orchestration, while
the stage logic (and its budget guards, freshness TTL, status guards) is **invoked, not rewritten.**

---

## 3. 4.2 — WRAP scope (the compat shim)

**Objective (roadmap):** the fenced pipeline emits engine events; observable on the bus; **no behavior change.**

**Approach:** wrap the EXISTING discovery sweep so it executes THROUGH the engine, producing the SAME results,
while becoming visible as `workflow_run`/`workflow_step`/outbox rows — mirroring the proven `dunning-sweep` shape
(enqueue + `drainEngine`). The stage logic is **not** rewritten and the budgets are **not** changed.

### The smallest first wrap slice (build this first)
**Wrap `discovery-sweep` as a single-step `discovery.sweep` CapabilityPack, and switch the cron from a direct call
to enqueue + drain.**

1. Add a `discoveryPack` CapabilityPack with **one coarse step** `sweep-cycle` whose handler does exactly
   `runDiscoverySweep(buildDiscoverySweepDeps(db, now))` — the current cron body, verbatim, behind the engine.
2. Register the pack in `buildEngineRuntime()` (next to `mailboxDunningPack`).
3. Change `/api/cron/discovery-sweep/route.ts` from `runDiscoverySweep(...)` to
   `enqueue("discovery.sweep", {}, dayIdemKey)` + `drainEngine(getEngineRuntime())` — the literal `dunning-sweep`
   pattern (auth + fail-closed enablement gates unchanged).

This is the smallest slice that satisfies the DoD: the sweep now runs as ONE engine run/step on the bus
(observable, leased, outbox-emitting), with **identical results** because it calls the same fn with the same deps
and the same budgets. **Seed (`discovery-seed`) gets the same one-step wrap as the second 4.2 slice.** The per-stage
decomposition (one step *per lead per stage*) is deliberately deferred to 4.3–4.6 — 4.2 changes the *execution
path*, not the *stage granularity*.

**Critical constraint — do NOT double-execute.** The wrap must REPLACE the cron's direct call, not run alongside
it; running both would double the LLM spend. Shadow-parity (§4) is proven on a **fenced cohort / preview DB**, never
by double-running prod.

---

## 4. The PARITY surface (how 4.2 proves safety)

Because the wrapped step calls the **same** `runDiscoverySweep` with the **same** deps and budgets, results parity
at 4.2 is near-structural; the proof is a **no-behavior-change diff**, captured two ways:

1. **Result-payload parity:** the wrapped engine run's `DiscoverySweepResult` (the `seed`/`research`/`contacts`/
   `promote` tallies, `advanced`/`failed`, the `errors[]`, `spend.todayEur`) is byte-equal to a direct-call run on
   the same fenced input. The `DiscoverySweepResult` shape (already PII-free, already returned by the cron) is the
   golden record.
2. **Bus-event capture:** the same run now produces `workflow_run`/`workflow_step` rows + outbox events — the
   evidence that it is "observable on the bus" (the DoD), absent today.

**The shadow-diff (the safe-cutover guarantee), run on a fenced trial cohort / preview DB branch:** for the SAME
seeded set of leads, the legacy direct path and the engine-wrapped path must produce **the same leads found,
researched, promoted, seeded** and **the same `agent_runs` count + cumulative cost** — i.e. identical
`lead.status` transition sets and identical spend. Divergence = a blocking finding.

The *deeper* parity bar — a **golden-master replay** that the engine path issues the **identical I-Provider call
sequence** as legacy — belongs to 4.3–4.6 (where the stages are decomposed into real engine-coordinated agent
steps and the inline `providers.llm.createTurn` loops are replaced). At 4.2 the single opaque step makes the
provider sequence trivially identical (same fn).

---

## 5. Per-stage port (4.3–4.6) + cutover (4.7★)

### 5.1–5.4 Per-stage port (4.3 research · 4.4 contacts · 4.5 promote · 4.6 seed)
Each slice decomposes the coarse 4.2 step into **per-stage, per-lead checkpointed engine steps** via the
agent-runner + the PLOS `LLMProvider` port (the proto-I-Provider — already a clean abstraction, classified SAFE in
the audit). Pattern per stage: a `discovery.<stage>` step, leased (SKIP-LOCKED), idempotent on `leadId`+cycle, whose
handler is the **existing** stage fn; `lead.status` transitions become the engine step outcome; the inline agent
loops become engine-coordinated agent steps.

| Slice | Stage | Handler (existing fn) | Notes / risk |
|---|---|---|---|
| **4.3** | research | `researchCompany(...)` | freshness-TTL + spend-cap preserved; per-lead step replaces the AbortSignal budget |
| **4.4** | contacts | `resolveContactsForLead(...)` | `BARREN_RUN_CEILING` exhaustion + email-keyed upsert preserved |
| **4.5** | promote | status-guarded UPDATE | pure DB; trivial step; the cheapest to port (a good early confidence builder) |
| **4.6** | seed (long-lane) | `runDiscovery(...)` | **peak complexity (7)** — the ~300s all-or-nothing txn (258–350) with no abort seam becomes a checkpointed long-lane run; **must not regress the all-or-nothing-persistence fix** |

**Discipline (per MMB Part G):** built on a **fenced trial cohort provably disjoint from live**; a **shared C12
intent-key de-dupes any cross-path side-effect** during dual-run; **golden-master replay** (identical I-Provider
call sequence) is the per-stage DoD; **per-lead flag** rolls a stage back to legacy. Author≠verifier on each slice.

### 5.5 The cutover (4.7 ★ FOUNDER-GATED — the live lead pipeline)
1. **Dual-write window:** `lead.status` stays authoritative (the rollback anchor); the engine path writes the same
   transitions in parallel.
2. **Backfill** in-flight lead state; reconcile.
3. **Prove** golden-master replay ≥ parity + **throughput** before any flip (evidence-gated, never calendar).
4. **Flag-flip** discovery authority to the engine; the legacy `runDiscoverySweep`/`runDiscovery` direct-call path
   goes **read-only → archive 30 days** (never deleted at flip).
5. **Founder FAP** authorizes the flip (Class-C: the live revenue pipeline).

### 5.6 Rollback
Flag-revert to the legacy direct-call path (kept read-only/archived for one audit window) — **minutes, no schema
reversal** (expand/contract). The discovery enablement flags (`DISCOVERY_ENABLED`/`_SWEEP_ENABLED`/`_SEED_ENABLED`)
remain the master kill-switch throughout.

### 5.7 The cron collapse (resolves the Hobby cap-2 conflict)
This is the payoff and the point of contact with **Sprint 2.4** (tiered scheduler consolidation — the founder-gated
Hobby-cap decision). Once discovery runs as engine workflows:

- `discovery-seed` (05:00) + `discovery-sweep` (07:00) crons are **retired** — their work is enqueued + driven by
  the **single engine tick** (the §7.5 tiered scheduler).
- `dunning-sweep` + `admin-events-drain` already `drainEngine`; they fold into the same tick.
- **End state: 1 Vercel cron (the engine tick)** + an **external (off-Vercel) dead-man's-switch (C8, Sprint 2.3)**.
  That is **within Hobby's 2-cron cap** — the cron collapse is what makes the Hobby plan viable again (or removes
  the forced-Pro pressure). **The actual collapse + the plan/cost call is Sprint 2.4 (★); 4.7 supplies its proof.**

---

## 6. The founder-gated / prod-sensitive checkpoints (marked)

| Checkpoint | Why founder-gated |
|---|---|
| **4.7 ★ discovery cutover** | flips authority over the **live lead-generation pipeline** (revenue) to the engine — Class-C |
| **2.4 ★ cron collapse + Hobby-cap** | retiring `vercel.json` crons is a platform/cost decision (Hobby vs Pro) — and a prod deploy under PLOS's Vercel constraints (§7 Q2) |
| **Enablement-flag flips** | turning `DISCOVERY_ENABLED`/`_SWEEP_ENABLED` ON for the parity/throughput proof incurs **real LLM spend** against `A2_DAILY_SPEND_CAP_EUR` |
| **The governance-host decision (§7 Q1)** | if discovery becomes a governed GOAL, *where* the C2/C7/C9/C10/C12 organs + stores run is an architecture call |

4.2 WRAP, 4.3–4.6 stage ports, 4.8 consolidate, 4.9 retire are **author≠verifier engineering, no per-step founder
prompt** (they ship in shadow / behind flags, flags OFF, no live authority change).

---

## 7. Risks + open questions (for the founder)

**Q1 — Cross-repo: where does discovery's *governance* run? (THE architecture question.)**
The C11 engine is already in PLOS, so 4.2–4.6 (the workflow port) need **no new cross-repo dependency** — discovery
becomes a CapabilityPack like dunning, in PLOS. But the *goal-governance* organs (C2/C7/C9/C10 + the 0052/0053
durable stores) live in **ADM/src + admin's DB**. Three options:
  - **(A) PLOS-local governance** — vendor the organs + the C12 store migrations into PLOS's DB; the discovery GOAL
    lives next to the `leads` it measures (clean data locality for the MetricProbe). Heaviest install; the cleanest
    end-state. **Recommended consolidation target.**
  - **(B) Admin-hosted goal driving PLOS stages over the seam** — the GoalContract + Sprint Engine run in admin and
    the spawner calls PLOS stages over the existing Admin↔PLOS HTTP seam; the MetricProbe reads PLOS leads over a
    read seam. **Re-introduces distributed execution — risks rebuilding a second runtime. Avoid.**
  - **(C) C11-WRAP only for Phase 4** — port stages onto the PLOS-local workflow engine (this plan's 4.2–4.6),
    keep the existing budget guards, and **defer the full goal-governance wrapping** to consolidation (4.8) / P5.
    **Recommended for Phase 4 scope** (smallest, safest, unblocks the cron collapse); (A) follows.

**Q2 — PLOS's Vercel identity/deploy constraints gate the cutover deploy.** The cron collapse and the new pack code
require a `vercel.json` change = a **prod deploy**. Per project memory: Vercel **Hobby blocks deploys not authored
by `bkasanwiredjo`**; push-as-`rumah-os-builder` clashes; `deploy.yml` hangs (no `--yes`/timeout). The 4.7/2.4
deploy must go out under the `bkasanwiredjo` identity (Redeploy / `vercel --prod`) or token-only — and the
Hobby→Pro question is entangled with 2.4. **Flag this before scheduling the cutover deploy.**

**Q3 — Double-execution / double-spend during the wrap + parity windows.** The 4.2 wrap must REPLACE the direct
call (single execution); shadow-parity must use a fenced cohort / preview DB. A naive "run both to compare in prod"
doubles LLM spend and corrupts the `agent_runs` cost ledger that the daily cap reads.

**Q4 — Two idempotency models coexisting.** Today: `lead.status` guards + freshness TTL. The port adds engine CAS
lease + C12 intent-key. During the dual-write window both are live; the shared intent-key must de-dupe any
cross-path side-effect, and the status guards must not fight the lease. Concurrency/abort repro required.

**Q5 — The seed's all-or-nothing 300s txn (4.6) is the peak-risk item.** `runDiscovery` has no mid-flight abort
seam and persists as one transaction (258–350). Porting it to a checkpointed long-lane run risks regressing the
all-or-nothing-persistence fix that the dedicated seed cron exists to guarantee. Golden-master + a fenced cohort.

**Q6 — Observability gap that the wrap improves.** Flag-gated routes return `{enabled:false}` — a no-op is today
indistinguishable from an outage. Bringing discovery onto the bus (`workflow_run`/outbox) is itself an
observability win; the parity proof should also exercise the `enabled:false` path so the engine run records "inert"
honestly.

**Q7 — Prod proof needs real spend.** Discovery is OFF by default, so the port proves out in shadow with no spend —
but the cutover's parity/throughput proof needs the flags ON against real data, a founder-gated, spend-incurring
window bounded by `A2_DAILY_SPEND_CAP_EUR`.

**Q8 — PLOS DB ≠ admin engine DB.** The Spine (`leads`/`companies`/`contacts`/`agent_runs`) is PLOS's DB; admin's
engine + C12 stores are admin's DB. The discovery goal's MetricProbe reads the `leads` table — data locality
favors option (A) (PLOS-local governance) over a cross-DB probe.

---

## 8. Sequencing summary
`4.1 I-LegacyGuard (done — standing guard)` → **`4.2 WRAP`** (smallest slice: `discovery-sweep` as a single-step
CapabilityPack on the PLOS engine; cron → enqueue+drain; no behavior change; observable on the bus) → seed-wrap →
`4.3 research` → `4.4 contacts` → `4.5 promote` → `4.6 seed-long-lane` (each: existing fn behind a checkpointed
step, fenced cohort, golden-master parity) → **`4.7 ★ cutover`** (dual-write → prove → flag-flip → legacy read-only
→ archive 30d; founder FAP) **+ the cron collapse feeds `2.4 ★`** (Hobby-cap resolved: 4 crons → 1 engine tick +
external dead-man's-switch) → `4.8 consolidate` (single engine install; the governance-host decision Q1(A)) →
`4.9 retire` (delete the dead `setTimeout` loop, the inert tick relay, the `packages/queue` stub, debris).

*This document changes no code and builds nothing — it is the spec the Phase-4 slices verify against.*
