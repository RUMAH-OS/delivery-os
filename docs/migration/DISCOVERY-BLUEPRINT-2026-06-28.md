---
artifact: DISCOVERY-BLUEPRINT (Master Migration Blueprint — Phase 1: Discovery)
id: MMB-DISCOVERY-v1
subject: The factual Current State Inventory of the RUMAH ecosystem codebase and infrastructure — the baseline for all future migration work
date: 2026-06-28
reference (frozen, single source of truth — NOT changed here): docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1) + docs/reviews/RUNTIME-ARCHITECTURE-2026-06-28.md (RA-DOS-v1 §17)
method: 6 independent specialist inventories (delivery-os framework · property-lead-os · rumah-admin · jarvis-slack · ecosystem/website/seams · cross-repo scheduler sweep), cited and cross-referenced
scope_guard: DISCOVERY ONLY. This document is FACTUAL — it describes what exists. It proposes NO migration, NO redesign, NO implementation. It maps current components against the frozen Runtime spec only to surface factual matches/conflicts. The Runtime Architecture is frozen and is not modified.
---

# Discovery Blueprint — RUMAH ecosystem Current State Inventory

> **What this is.** The complete, factual baseline of the existing system — every runtime component, scheduler,
> orchestrator, capability, deployment path, store, ownership model, execution flow, and hidden/legacy path —
> across all six repositories. It is the ground truth on which the Master Migration Blueprint will be built.
> **What this is NOT.** A migration plan. No component is proposed for change here; dispositions, sequencing, and
> redesign belong to later phases. Where a current component is noted as "matches" or "conflicts with" the frozen
> Runtime spec, that is a *factual observation*, not a recommendation.

---

## 0. The single most important finding (one screen)

**The new Runtime is not greenfield. Its load-bearing core substrate already exists and operates in production.**

- **The Result Bus (RS-DOS C11) is BUILT and LIVE in rumah-admin** — the 7-state workflow run/step engine with a
  SKIP-LOCKED tick, CAS leases, the **await-callback primitive**, and the completer — and it is **vendored
  byte-identical from `delivery-os` into `.claude/os/engine/`** (CI drift-gated), with a second vendored copy in
  property-lead-os. The engine source of truth is `delivery-os`; admin + PLOS are installers.
- **The goal entrypoint, dispatch, human-approval, and agent-result seams are BUILT** in admin (`/v1/goals`
  deterministic capability selector · `/v1/approvals` · `/v1/agent-results` · `/v1/events` pull · `/v1/deliveries`
  callback), driven by the **`/v1/heartbeat` Vercel cron (every 5 min)** = the engine-step tick (C13).
- **jarvis-slack-control-surface** is the *sole* Slack integration and already drives `/goal → admin engine →
  verify → report` end-to-end (a seed of the C1/I-Surface adapter).
- **What is MISSING is the goal-governance layer *on top of* the engine:** the Goal Supervisor (C7), the
  pre-flight feasibility gate (C9), the five durable stores (C12: goal-delta ledger, attempt-ledger+breaker,
  idempotency, dead-letter, portfolio-cost), `goal-progress`/`progress-stall`, the Project-Owner reconciler
  (C2-LOOP), and the dead-man's-switch (C8). These are **DESIGNED in the spec, not built on disk.**
- **Scheduling is fragmented:** **21 distinct scheduler/trigger mechanisms** exist across the ecosystem — 5 live
  Vercel crons (4 in PLOS + admin's heartbeat), 2 GitHub-Actions cron templates, 1 abandoned in-process loop, an
  inert tick relay, 4 heartbeat domain runners, and ~6 prod-mutating manual scripts — with **no unified tiered
  scheduler and no external dead-man's-switch** (the heartbeat is unmonitored).
- **Ownership is clean** (locked registries ECR-0003/0006/0007; one writer-of-record per entity; no unresolved
  ownership conflicts). The *technical* debt is concentrated, named, and mostly inert.

**The migration is therefore predominantly: (a) generalize the already-built engine into the goal-governed
Runtime, (b) build the missing governance layer on top, and (c) consolidate the fragmented scheduling — NOT
build a runtime from scratch.** *(That framing is the factual implication; the plan is a later phase.)*

---

## 1. The ecosystem map (repos · hosting · role)

| Repo | Role | Hosting (observed) | Runtime weight |
|---|---|---|---|
| **delivery-os** | the framework: canonical engine **source** + governance/routing/verification spine + the Runtime spec | dogfoods templates (no own `.github/workflows`) | the *source* of the engine + tools |
| **rumah-admin** | the operational core: the **live durable engine** (Result Bus), invoicing/contract/owner-invoice domain, the `/v1/heartbeat` orchestrator, the goal/approval/agent-result/seam APIs | **Vercel** (serverless) + Supabase Postgres (transaction pooler :6543) | **heaviest runtime** (the engine in production) |
| **property-lead-os (PLOS)** | the Demand/CRM Spine + the discovery pipeline; a *second* vendored engine copy + its own workflow tick | **Vercel** (`apps/web/vercel.json`, 4 crons) — **registry states "Hetzner always-on" (DIVERGENCE, §6)** | heavy runtime (discovery + engine copy) |
| **jarvis-slack-control-surface** | the sole Slack control surface (`/goal` adapter, v0.1.0 seed) | long-running worker (Socket Mode; **not** serverless) — not yet deployed | thin (HTTP adapter only) |
| **ecosystem-architecture** | the ownership/source-of-truth registries + ECR decisions | docs only (no runtime) | none (governance docs) |
| **rumah-website** | near-static Next.js marketing site + lead intake (email-only) | **Vercel** (`vercel.json`, no crons) | minimal (no cron/queue/engine) |

---

## 2. Current State Inventory — by domain

### 2.1 The execution engine / Result Bus (the canonical substrate)
**Source:** `delivery-os` (`capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md` canonical; `EXECUTION-ENGINE-DESIGN.md`;
the engine code vendored). **Installed & LIVE:** `rumah-admin/.claude/os/engine/{engine.ts, state-machine.ts,
callback-completer.ts}` + `src/engine-admin/engine-instance.ts`. **Second copy:** PLOS (`/api/v1/workflow/*`).
- **Run states (7):** queued → planned → executing → {blocked, completed, failed, recovered}. **Step states (5):**
  ready → {leased, done, failed, blocked}. Legal-edge whitelist enforced in **both** app validator and a **DB
  trigger** (migration 0034) — golden-master cage pins drift.
- **Tick:** stateless, one transition per tick, single DB transaction + one outbox event, idempotent on
  `(run_id, seq, attempt)`. **SKIP-LOCKED** partial index `workflow_step_leasable_idx`; **CAS lease**
  (`lease_token`, 30s visibility timeout) — concurrent ticks never contend; a dead worker's lease expires.
- **Await-callback primitive (v1 net-new):** a step emits an idempotent request to the outbox (correlation key =
  outbox event id), blocks the run, resumes atomically on an inbound callback via `completeAwaitingStep`. Race
  guard `outcomeArrived` (callback-before-block). Sources: system-callback (deliveries), human-response
  (approvals), agent-result. **This is the C11 await/completer, built.**
- **Capability packs:** declarative `CapabilityPack[]` registered at startup; `PROD_INVOICE_PACKS` excludes
  SoR-mutating packs (contract-sync, owner-invoice) on prod until founder-ratified (ADR-006/007).
- **Status vs spec:** **C11 Result Bus = BUILT/LIVE** (admin) — the spec's bus *is* this engine, vendored intact.
  The 5 durable stores (C12) on top are **MISSING**.

### 2.2 Schedulers / crons / heartbeats / queues (21 mechanisms — the full map)
| # | Mechanism | Repo · path | Type | Schedule | Status |
|---|---|---|---|---|---|
| 1 | Learning Review | delivery-os `templates/workflows/learning-review.yml` | GHA cron | `0 7 * * *` | template |
| 2 | Repo Governance | delivery-os `templates/workflows/repo-governance.yml` | GHA cron | `0 6 * * *` | template |
| 3 | Discovery Seed | PLOS `/api/cron/discovery-seed` | Vercel cron | `0 5 * * *` | live (flag-gated, inert by default) |
| 4 | Admin Events Drain | PLOS `/api/cron/admin-events-drain` | Vercel cron | `0 6 * * *` | live (Hobby-capped) |
| 5 | Discovery Sweep | PLOS `/api/cron/discovery-sweep` | Vercel cron | `0 7 * * *` | live (flag-gated) |
| 6 | Dunning Sweep | PLOS `/api/cron/dunning-sweep` | Vercel cron | `0 8 * * *` | live (flag-gated) |
| 7 | Admin Drain Loop (dev) | PLOS `apps/web/instrumentation.ts` | in-process `setTimeout` | every ~20s | **ABANDONED dead-code** (`.unref()` inert on serverless) |
| 8 | Engine Tick Relay | PLOS `/api/cron/tick` | Vercel cron relay | not registered | **inert** (superseded by admin heartbeat) |
| 9 | **Heartbeat (PRIMARY)** | rumah-admin `/v1/heartbeat` · `vercel.json` | Vercel cron orchestrator | `*/5 * * * *` | **live** (drives tick + 4 runners) |
| 10–13 | Heartbeat runners: scheduled-send · reminders · contracts-expiring · owner-invoice-sync(opt) | rumah-admin `src/index.ts` | domain runners | per heartbeat | live (owner-sync env-gated) |
| 14–21 | Manual scripts: db:seed · db:migrate · db:migrate:engine · db:rollback · prod:preflight · engine:prodbaseline:proof · experience:review · platform:health-selftest | admin/PLOS `scripts/` | manual CLI | human-run | live (db:* are prod-critical/dangerous) |
- **Queues:** no external queue. PLOS `packages/queue/` is a **placeholder stub** (no exports). The **transactional
  outbox + SKIP-LOCKED leasing IS the queue** (ECR-0006 pull model). `pgmq`/`pg_cron` (ECR-0005) are **designed,
  not built**.
- **DB-level:** SKIP-LOCKED row leasing on `workflow_step` (built). No live `pg_cron`/Supabase scheduled functions.

### 2.3 Orchestration / dispatch / goal-entry / agents
- **Goal entrypoint (BUILT, admin):** `POST /v1/goals` — a **deterministic fail-closed capability selector**
  (intent/text → exactly one registered capability; no-match/ambiguous → 422, no run). Selectors derived from
  registered packs; `PROD_INVOICE_PACKS` limits selectable intents on prod.
- **Dispatch (delivery-os, BUILT):** `dispatch-route.mjs` (canonical) resolves owner + agent + skills + knowledge
  per work package, emits DispatchPlan + spawnPrompt + `dispatch-log.jsonl`; `skill-route`/`knowledge-route`/
  `agent-route` are the leaf selectors. (= RS-DOS C15.)
- **Agents (admin, BUILT):** `buildAdminAgents()` roster (`coder` real Claude executor, `echo` simulated);
  `agentRequirement` on steps; `selectAgentFor`; `/v1/agent-results` resumes runs on agent completion (multi-agent
  Slice 1).
- **Human approval (admin, BUILT):** `/v1/approvals/:stepId` (human-response await source; append-only audit).
- **Status vs spec:** the dispatch/goal-selector/agent-result/approval seams **exist**; the **Project-Owner
  reconciler (C2-LOOP), C2-MIND boundary intelligence, Goal Supervisor (C7), and pre-flight gate (C9) are MISSING.**

### 2.4 GitHub Actions / CI-CD / deployment pipeline
- **delivery-os templates (6):** dev-preview · promote-to-prod (C6 founder-approved label gate) · **verify-coverage
  (the binding D9 author≠verifier gate)** · repo-governance (cron) · learning-review (cron) · hook-path-integrity.
  Vendored to consumers; not live in delivery-os itself.
- **rumah-admin (3 live):** `ci.yml` (engine-ownership **drift gate** vs ../delivery-os + build/migrate),
  `config-gate.yml` (config-doctor prod-config validation), `prod-smoke.yml` (post-deploy probe). Deploy = Vercel
  Git-native on push to main; build = `tsc`. Admin-UI is a *separate* Vercel project.
- **PLOS (5 live):** `ci.yml`, `deploy.yml` (push-main → config-doctor gate → Vercel prebuilt deploy → post-deploy
  health), `discovery-seed-trigger.yml` + `discovery-sweep-trigger.yml` (**manual** `workflow_dispatch`),
  `orchestrator.yml` (**read-only CI monitor** — classifies failures, never merges/deploys).
- **rumah-website (1):** `ci.yml` → Vercel. **No state-gated deploy (`deployment-auth`/`.deploy-lane.json`) is
  wired in any consumer yet** (the D7 mechanism is template-only in delivery-os).

### 2.5 Slack integration (jarvis)
- **Sole Slack surface** (grep-confirmed: no other Slack SDK/webhook in any repo). `slack-app.ts` (Socket Mode
  shell, token-gated) → `handle-goal.ts` (surface-agnostic brain) → `goals-client.ts` (HTTP-only to admin
  `/v1/goals` + `/v1/workflow/runs/:id`). Proof harness boots the admin runtime in-process and runs a **real
  Claude session**. v0.1.0 seed; deploys as a **long-running worker** (not serverless).
- **Status vs spec:** a working seed of **C1 / I-Surface §48**; identity-bound approvals + Block-Kit buttons +
  the 8-question single-screen are **not yet built**.

### 2.6 Storage / state / data model / config
- **Workflow state (admin, LIVE):** `workflow_run` / `workflow_step` (migration 0034) + the **transactional
  outbox** (append-only event log; `consumed_at` ack; 90d retention) — the durable spine. **RLS + `rumah_app`
  policy on every table** (0021). **100 forward-only migrations** (ADR-005); Drizzle schema secondary.
- **Financial SoR (admin):** `invoice` (immutability-guard DB trigger — issued artifacts frozen), `payment`
  (non-destructive reversal), append-only `contract_termination_event`/`contract_lifecycle_event`, owner-fee
  tables, `delivery` log (append-only, idempotent), `invoice_delivery_package` (content-hash idempotency).
- **Demand/CRM Spine (PLOS):** `projects`/`companies`/`leads`/`project_contractors`/`agent_runs`; the lead state
  machine `discovered → qualified → contacts_found → outreach_ready`. Migration 0035 (`provenance`).
- **Config (BUILT, both):** `infra/config-registry.json` (declared prod keys + owner + rule + fix) +
  `config-doctor.mjs` (pre-build fail-closed validation via Vercel API). **Two per-repo registries** (no single
  cross-repo source). Env via `loadEnv()` (file-sourced first); **prod-DB pooler guard** (transaction :6543).
- **Pooler inversion (recorded, factual):** admin uses session pooler in some contexts vs PLOS transaction
  pooler :6543 — both deliberate per workload; recorded but not centrally registered.

### 2.7 Ownership models / registries / seams
- **Ownership is LOCKED and clean** (ecosystem-architecture registries + ECRs): **one writer-of-record per
  entity.** Two systems of record — **Demand/CRM Spine (PLOS)** (Organisation/Lead/Contact/Signal/Outreach) and
  **Rumah Admin transactional store** (Property/Unit/Deal/Contract/Invoice/operational-derivations). ECR-0003
  (CRM Spine), ECR-0006 (Admin↔PLOS seams), ECR-0007 (Contact identity) ratified. **No unresolved ownership
  conflicts.**
- **Cross-repo seams:** Admin **event outbox → PLOS pull** (`GET /v1/events`, producer BUILT, **PLOS consumer
  workers PENDING**); Admin **read seams** (`/v1/ops/*`, `/v1/finance/*`, LIVE); **PLOS → Admin** delivery
  callback (`POST /v1/deliveries`, LIVE); Website → Spine lead-intake (**PENDING**, email-only today); Website →
  Admin inventory API (**PENDING**, blocks ADR-005).
- **Inheritance:** `os-inherit`/`os-sync` vendors delivery-os base+overlay byte-identical, drift-checked. PLOS +
  website have vendored `delivery-os/` copies; **rumah-admin vendors the *engine* (`.claude/os/engine/`) but its
  full agent-inheritance `.claude/base` status is unclear (DRIFT FLAG, §6).**

### 2.8 Monitoring / observability
- **Admin:** `/health` (thin), `infra/platform-health.mjs` (infra audit: Vercel/Supabase/migrations/RLS/drift/
  config), heartbeat 207-Multi-Status honest-failure, `agent_runs`-style telemetry. **PLOS:**
  `/api/health/discovery`, `discovery-health.ts`, `agent_runs` (cost/tokens/model). Platform default logging
  (Vercel + GitHub Actions); **no custom APM**; **no portfolio-wide Mission Control** (RS-DOS I-Ops §49 not built).
- **Gap:** **no external dead-man's-switch** — if the admin heartbeat goes silent, nothing alarms (RS-DOS C8 not
  built).

### 2.9 Capabilities / framework tools (delivery-os)
- **43 OS-foundational tools in the manifest; 14 installed in `.claude/` (a 29-tool install lag).** BUILT &
  operating: verify-gate, dispatch-route, os-inherit/os-sync, check-os-drift, render-kernel, agent/skill/knowledge-
  route, ci-release-orchestrator, founder-review-package, review-trigger, deployment-auth, the gates. **MISSING on
  disk:** goal-init, goal-stop, **goal-progress**, **progress-stall**, boundary-classify (standalone). **INERT:**
  census-detector, file-lesson (signals unconsumed), capability-health/agent-health (no CI trigger),
  milestone-report, `sibling-probe` hook (template-only, uninstalled).
- **28 skills** (+2 archived: grill-me, production-readiness-review). **Design docs:** canonical = RS-DOS-v1 /
  RA-DOS-v1 / EXECUTION-MODEL-V1 / GOAL-EXECUTION-CONTRACT; superseded = WORKFLOW-ENGINE-V1 / MAILBOX-V1 /
  PHASE-2-READINESS.

---

## 3. Dependency graph (component relationships)

```
                         delivery-os  (SOURCE OF TRUTH)
                ┌────────────────┼─────────────────────────┐
        engine source        tools/templates          governance spec
        (.../engine/*)       (dispatch-route,          (RS-DOS / RA-DOS /
                │             verify-gate, os-inherit,   EXECUTION-MODEL)
                │             6 workflow templates)
                │ os-inherit (vendored, byte-identical, CI drift-gated)
        ┌───────┴────────────────────────┐
        ▼                                 ▼
   rumah-admin                        property-lead-os
   .claude/os/engine/  ◄── DRIFT GATE ──►  /api/v1/workflow/* (2nd copy)
        │                                 │
   src/engine-admin/                 apps/web/lib/discovery.* (pipeline)
   (capability packs,                packages/db (Spine schema)
    goals/approvals/                 4 Vercel crons
    agent-results/                        │
    deliveries/events APIs)               │ Admin event outbox  ──► PLOS pull (GET /v1/events)  [consumer PENDING]
        │                                 │ PLOS delivery ──► Admin (POST /v1/deliveries)        [LIVE]
   /v1/heartbeat (*/5)  ── drives ──► engine tick + 4 domain runners
        ▲                                 ▲
        │ POST /v1/goals (+ runs/:id)     │  (Admin read seams /v1/ops,/v1/finance → PLOS/agents) [LIVE]
        │                                 │
   jarvis-slack (/goal adapter, HTTP-only, long-running worker)     rumah-website (Spine intake PENDING; Admin inventory API PENDING)
        ▲
   Founder (Slack)
```
**Critical-path facts:** every consumer depends on `../delivery-os` (engine source + the CI drift gate, gated by
`DELIVERY_OS_TOKEN`); the admin **heartbeat is the single orchestrator** of all admin engine + domain work; the
**outbox is the cross-repo integration spine**; jarvis depends only on the admin goal API (clean HTTP boundary).

---

## 4. Execution flow diagrams (factual)

**(A) Admin heartbeat-driven execution (the live engine loop):**
```
Vercel Cron (*/5) → POST /v1/heartbeat (CRON_SECRET) → loop engine.tick() ≤50×
  → for each ready step: lease (CAS, SKIP-LOCKED) → run handler (emit-only|idempotent|await-callback|irreversible)
     → irreversible → BLOCK for human (/v1/approvals)   → await-callback → emit request to outbox, BLOCK
  → fan out 4 domain runners (scheduled-send, reminders, contracts-expiring, owner-invoice-sync[opt])
  → 200 all-ok | 207 any-runner-failed (honest failure)
```
**(B) Goal → execution → report (jarvis path, LIVE seed):**
```
Founder /goal (Slack, Socket Mode) → handle-goal → POST /v1/goals (deterministic selector → 1 capability | 422)
  → run enqueued → agent-runner spawns REAL Claude session → verify step (verdict-equals-pass) → run completed
  → awaitRun polls GET /v1/workflow/runs/:id → derive verdict → say() back to Slack
```
**(C) Cross-repo invoice-delivery seam (LIVE):**
```
Admin invoice-send workflow → await-callback step emits invoice.send_requested → outbox (blocked)
  → PLOS admin-events-drain cron pulls GET /v1/events → materializes pending send (NO auto-send, D2)
  → [human-approved send executes] → PLOS POST /v1/deliveries {eventId,status} → Admin appends delivery log
     + completeAwaitingStep resumes the blocked run (same txn) → emits invoice.send_settled
```
**(D) PLOS discovery pipeline (LIVE, flag-gated):**
```
Vercel Cron 05:00 discovery-seed → runDiscovery (300s, all-or-nothing transaction 258–350, spend-capped)
Vercel Cron 07:00 discovery-sweep → research → contacts → promote (bounded budgets), lead SM advances
   (gates: DISCOVERY_ENABLED && DISCOVERY_SWEEP_ENABLED; inert by default)
```

---

## 5. The register — technical debt · duplicates · conflicting ownership · obsolete · hidden paths · hidden overrides · competing schedulers

*(Factual inventory. No dispositions. "Conflicts-with-new-Runtime" = a factual observation against the frozen spec.)*

### 5.1 Competing / overlapping schedulers
| # | Components | Repos | Factual issue |
|---|---|---|---|
| CS-1 | In-process `setTimeout` admin-drain loop **and** Vercel `admin-events-drain` cron | PLOS | dual path to the same outbox cursor; the loop is dead on serverless (`.unref()`) |
| CS-2 | Dedicated `discovery-seed` cron **and** the sweep's in-sweep seed step | PLOS | two paths to the same seed work (intentional Design-A separation; offset schedules) |
| CS-3 | `/api/cron/tick` relay (inert) **vs** dunning-sweep's engine drain **vs** admin heartbeat | PLOS + admin | multiple potential tick sources; safe today via SKIP-LOCKED + tick not registered |
| CS-4 | No unified scheduler — **5 autonomous Vercel crons + 2 GHA crons + manual triggers** | all | vs RS-DOS §7.5 *tiered* scheduler (engine-tick · PO-reconciler · GS · dead-man's-switch): the current set is fragmented and uncoordinated |

### 5.2 Hidden / inert execution paths
| Path | Repo | Why inert |
|---|---|---|
| `discovery-seed` / `discovery-sweep` routes | PLOS | flag-gated (`DISCOVERY_ENABLED`/`_SWEEP_ENABLED` false by default) → return `{enabled:false}`; cron fires but no-ops (observability risk: no-op vs outage hard to distinguish) |
| admin-drain in-process loop | PLOS | `.unref()` → never fires on serverless; dev-only |
| `/api/cron/tick` relay | PLOS | exists but **not registered** in `vercel.json` (superseded by admin heartbeat) |
| `POST /api/admin-events/drain` | PLOS | manual gesture, not scheduled |
| `packages/queue/` | PLOS | placeholder stub, no exports |
| vendored `discovery-os/` table ref | PLOS | named in schema, never populated |

### 5.3 Hidden overrides / kill-switches / gate-bypass flags
`CRON_SECRET` (unset → **all** crons 401: system-wide kill) · `DISCOVERY_ENABLED` / `DISCOVERY_SWEEP_ENABLED` /
`DISCOVERY_SEED_ENABLED` · `DUNNING_SWEEP_ENABLED` · `OWNER_INVOICE_SYNC` · `ADMIN_EVENTS_URL/TOKEN` (dev loop) ·
`COMMS_GO_LIVE` / `ENGINE_PACKS` (prod pack roster) · `A2_DAILY_SPEND_CAP_EUR` (hard LLM budget) · the historical
`DELIVERY_OS_GATE_BYPASS` (verify-gate bypass, founder-authorized). *(No unauthorized/undocumented override
found; all are declared, fail-closed, founder-gated.)*

### 5.4 Obsolete / dead code / debris
- **Dead:** PLOS `instrumentation.ts` admin-drain `setTimeout` loop (broken on serverless).
- **Obsolete reference:** rumah-admin `current-system/` (legacy Edge-Function SPA, read-only fallback),
  `reference/` (legacy auto-invoice docs superseded by the heartbeat path).
- **Debris:** stray `.log`/`.stackdump` files in rumah-admin and rumah-website (local dev leftovers, gitignored).
- **Inert framework tools:** census-detector, file-lesson (signals unconsumed), capability-health/agent-health
  (no CI trigger), milestone-report, uninstalled `sibling-probe` hook.
- **Install lag:** delivery-os `.claude/` runs 14 of 43 manifest tools; **`goal-progress` (the C12 ledger) is
  MISSING on disk** despite being a Phase-1 PRIMARY item.

### 5.5 Duplicate systems
- **The engine exists in 3 places** (delivery-os source · admin vendored · PLOS vendored) — *intended* byte-
  identical vendoring (drift-gated), not divergence; factual to note for the migration.
- **Two config registries** (admin + PLOS `infra/config-registry.json`) — no single cross-repo source (vs RS-DOS
  single config source-of-truth).
- **Two engine-tick paths** (admin heartbeat live; PLOS `/api/cron/tick` inert).

### 5.6 Conflicting ownership
- **None unresolved** (locked ECRs). Factual divergences to carry: the **pooler-mode split** (admin session vs
  PLOS transaction :6543, both deliberate, not centrally registered), and the **hosting divergence** (§6).

### 5.7 Capacity / deployment conflicts
- **PLOS has 4 Vercel crons; the Hobby plan caps at 2 (≤1/day).** → admin-events-drain is daily-only → up to ~24h
  invoice-visibility latency. Requires a platform decision (PRO / external scheduler / webhook) — *founder
  checkpoint, factual.*
- **No state-gated deploy (D7) wired** in any consumer; `.deploy-lane.json` not provisioned.
- **No staging environment** in the consumers (local → prod-via-push today).

---

## 6. Discrepancies & open factual questions (to resolve before/within the migration plan)
1. **Hosting divergence:** ecosystem registry states "PLOS on Hetzner always-on," but PLOS ships `apps/web/
   vercel.json` with 4 Vercel crons + a Hobby-cap constraint. *Registry-vs-code divergence — confirm PLOS's
   actual production host.*
2. **rumah-admin inheritance:** admin vendors the engine (`.claude/os/engine/`) and references `../delivery-os`
   in npm scripts, but the full `.claude/base` agent-inheritance structure was not clearly observed. *Confirm
   admin's OS-inheritance state.*
3. **jarvis deployment:** Socket Mode requires a long-running worker (not Vercel serverless); jarvis is a built
   seed but **not yet deployed** anywhere. *Confirm the intended host.*
4. **`goal-progress`/M1 ledger:** named Phase-1 PRIMARY in the spec and listed in the manifest, but **absent on
   disk**. *Confirm it is unbuilt (consistent across the framework + admin inventories).*
5. **PLOS engine copy vs admin:** both vendor the engine; confirm byte-identity currency (the drift gate enforces
   it, but PLOS's copy currency wasn't independently hashed here).

---

## 7. Factual mapping — current state vs the frozen Runtime spec (NO migration proposed)

| RS-DOS component | Current state (factual) | Match / Gap |
|---|---|---|
| **C11 Result Bus** (run/step, tick, lease, await/completer) | **BUILT/LIVE** in admin (vendored from DOS); 2nd copy in PLOS | **MATCH** (the spec's bus IS this engine) |
| **C13 Engine-step tick** | **BUILT** = admin `/v1/heartbeat` (*/5) | **MATCH** (liveness tick) |
| **C15 Dispatch router** | **BUILT** = `dispatch-route.mjs` + leaf routers | **MATCH** |
| **C3 Claude Code Runtime / C4 specialist / C5 verify / C6 review** | **BUILT** (agent-runner real Claude executor; verify step; principle-11-review; verify-gate D9 CI binding) | **MATCH** (the work agents exist) |
| **C1 Founder surface / I-Surface** | **SEED** = jarvis (`/goal`), HTTP-only | partial (no approvals/single-screen) |
| **C18 Config + registries / C20 Memory** | **BUILT** (config-doctor/registry; 3-tier memory; signals corpus) | MATCH (two per-repo config registries; no single source) |
| **C17 Learning Engine (L0/L1/L2)** | **BUILT** (file-lesson L0, learning-trigger, learning-review L2) | MATCH (file-lesson signals unconsumed downstream) |
| **C19 Delivery pipeline / state-gated deploy (D7)** | **PARTIAL** (deployment-auth template exists; **not wired**; no staging; PLOS/admin have CI + Vercel deploy) | GAP (no state-gated lane, no staging rung) |
| **C2 Project Owner (state + reconciler + C2-MIND)** | goal-state tools partly designed; **reconciler + boundary-intelligence MISSING** | **GAP** |
| **C7 Goal Supervisor / C9 Pre-flight gate / C12 5 durable stores / goal-progress / progress-stall** | **MISSING on disk** (DESIGNED in spec) | **GAP** (the goal-governance layer) |
| **C8 Dead-man's-switch** | **MISSING** (heartbeat unmonitored externally) | **GAP** |
| **I-Resource / I-Placement / I-Provider / I-Ops / I-SelfEval / I-Version / I-LegacyGuard** (Part V interfaces) | none built as abstractions; current ad-hoc equivalents (cost cap, Vercel/Claude coupling, per-repo config) | GAP (interfaces unbuilt; current implementations are single-vendor) |

---

## 8. The factual baseline (closing)
This Discovery Blueprint is the agreed factual ground truth: **the durable engine substrate, the goal/dispatch/
approval/agent-result/seam APIs, the heartbeat tick, the discovery pipeline, the config platform, the
author≠verifier CI binding, and a clean locked ownership model all EXIST and operate today**; the **goal-
governance layer (Goal Supervisor, pre-flight gate, the five durable stores, the reconciler, the dead-man's-
switch), a unified tiered scheduler, a state-gated deploy lane with staging, and the Part-V infrastructure-
independence interfaces do NOT yet exist**; scheduling is fragmented across 21 mechanisms with a Hobby-plan
constraint and no external watchdog; and the technical debt (one dead loop, several inert/flag-gated paths, a
29-tool install lag, two config registries, the engine-in-3-places vendoring) is concentrated, named, and
mostly inert. **No migration, sequencing, or redesign is proposed here** — that is the next phase, which will
build on this baseline. Five factual discrepancies (§6) are flagged for confirmation before planning begins.

*End of Discovery Blueprint. Six independent specialist inventories (cited in the task record) compose this
baseline; it changes no code and proposes no migration.*
