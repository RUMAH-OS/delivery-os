# Architecture Validation — Platform vs. Consumer

**Date:** 2026-06-29
**Type:** READ-ONLY, file-cited architecture validation (no code changed; this doc is the only artifact)
**North Star under test:** *Delivery OS is the PLATFORM; `rumah-admin` is only the FIRST CONSUMER.*
**The test:** If `rumah-admin` were deleted tomorrow and a brand-new consumer (e.g. `property-lead-os`) were created, would **Delivery OS itself** still provide each capability — by the new consumer wiring a different domain — WITHOUT `rumah-admin` having to exist?

---

## 0. Method & ground truth

Three repos were read directly:

- `C:\Users\brian\RUMAH\delivery-os` — the candidate PLATFORM.
- `C:\Users\brian\RUMAH\rumah-admin\src` — the FIRST consumer (the goal-governance Runtime).
- `C:\Users\brian\RUMAH\property-lead-os` — the SECOND consumer (the vendoring existence-proof).

**The single most important structural fact found:** the engine source-of-truth does **not** live at `delivery-os/.claude/os/engine/`. `delivery-os/.claude/os/` contains only `tools/`. The C11 Result-Bus engine's canonical home is **`delivery-os/templates/workflow-engine/`** (21 modules: `engine.ts`, `capability-pack.ts`, `goals-route.ts`, `approvals-route.ts`, `verifiers.ts`, `human-principal.ts`, `agent-runner.ts`, …). That directory is vendored **byte-identical** into both consumers:

- PLOS: `property-lead-os/.claude/os/engine/` (20 files, e.g. `engine.ts` 54354 bytes) consumed via `apps/web/lib/engine/runtime.ts` → `createCapabilityRuntime(...)`.
- Admin: `rumah-admin/.claude/os/engine/` (same module set) consumed via `src/engine-admin/engine-instance.ts`.

This is the **proven vendoring model**: the engine declares ports (`EngineContext`, `DbLike`, `HumanPrincipalPort`), the consumer supplies the impls (its own DB, its own auth, its own packs). Cited:

- `delivery-os/templates/workflow-engine/index.ts` — the public barrel: `export { createCapabilityRuntime } … export type { EngineContext, EngineTables, DbLike }`.
- `property-lead-os/apps/web/lib/engine/runtime.ts:18-38` — `createCapabilityRuntime({ context: { db: getDb(), tables: {...} }, humanPrincipal, auth, packs })`; header states "the IDENTICAL call Admin + the demo-app use."

**The second most important fact:** *none* of the goal-governance organs exist in `delivery-os`. A grep for `goal-contract|po-reconciler|goal-supervisor|GoalContract|po-autoloop` across `delivery-os/**/*.ts` (excluding the demo example) returns **zero** hits. They live only in `rumah-admin/src/` (12 organ files: `goal-contract.ts`, `runtime-stores.ts`, `po-reconciler-c2.ts`, `po-autoloop-c2.ts`, `goal-supervisor-c7.ts`, `sprint-engine-c10.ts`, `preflight-gate-c9.ts`, `completion-review-c6.ts`, `boundary-plan-c2mind.ts`, `founder-summon-c1.ts`, `goal-intake-c1.ts`, `metric-probe.ts`, plus `reachability-evaluator.ts`). PLOS has **none** of them — correct, they are admin-only today.

**The coupling mechanism:** the organs bind to admin's Postgres through **raw tagged-SQL against named tables**, NOT through an injected adapter:

- `rumah-admin/src/runtime-stores.ts:13` — `import { sql } from "./db/client.js"`; header (lines 1-10) "the ONLY application-side door to the five durable stores … Connection: the shared postgres-js client (`src/db/client.ts`)". Functions issue literal SQL, e.g. `INSERT INTO goal_delta_ledger …` (`:54-60`), `SELECT … FROM goal_delta_ledger` (`:70-74`).
- `rumah-admin/src/goal-contract.ts:17` — `import { sql } from "./db/client.js"`; `INSERT INTO goal_contract` (`:89-105`), `SELECT * FROM goal_contract WHERE goal_id = ${goalId}` (`:117`).
- `rumah-admin/src/metric-probe.ts:31` — `import postgres from "postgres"` directly.

Contrast: the engine never imports a DB client — it takes `EngineContext.db` (a `DbLike`) as a parameter (`templates/workflow-engine/index.ts`, `engine.ts` tick comment lines 1-7: "All liveness lives in `workflow_run`/`workflow_step` rows … a heartbeat … calls the tick"). **The engine is DB-agnostic by injection; the governance organs are DB-coupled by raw SQL.** That single difference is the entire extraction story.

---

## 1. Per-capability validation table

For each: **Belongs to DOS?** (should the platform own it) · **In DOS today?** (file-cited) · **Why not?** · **What must be extracted** · **Delete-admin verdict**.

| # | Capability | Belongs to DOS? | In DOS today? (cited) | Why not / nuance | Must be extracted | Delete-admin verdict |
|---|---|---|---|---|---|---|
| 1 | **Project Owner** (PO loop: reconcile desired-vs-verified, drive the goal forward) | YES | **NO** — `rumah-admin/src/po-reconciler-c2.ts`, `po-autoloop-c2.ts` only; absent from `delivery-os` | The reconciler is the "ONLY mutator of the goal state machine" (`scheduler-tiers.json:59`) and reads the C12 stores via `runtime-stores.js` raw SQL (`po-autoloop-c2.ts:107`) | The PO loop logic + its dependency on a `GoalStorePort` instead of `runtime-stores` raw SQL | **FAIL** |
| 2 | **Goal Intake** | YES (bus level) | **SPLIT** — bus-level **YES**: `templates/workflow-engine/goals-route.ts` (generic `POST /goals` → `selectCapability` → `enqueue`, "PORTABILIZED, GENERIC"). Governance-level **NO**: `rumah-admin/src/goal-intake-c1.ts` (GoalContract creation) | The generic *intent→run* entrypoint is platform and vendored. The *governance contract* intake (acceptance shape, budget caps, probe binding) is admin-only and writes `goal_contract` via raw SQL | The `goal-intake-c1` GoalContract-construction logic + `goal-contract.ts` behind a store port | **PARTIAL** (bus PASS, contract FAIL) |
| 3 | **Sprint Planning** | YES | **NO** — `rumah-admin/src/sprint-engine-c10.ts` only | Imports `goal-contract.js`, `po-autoloop-c2.js` (`:37-365`); pure-ish logic but transitively coupled to admin's stores via its collaborators | The sprint-engine module + decoupling its collaborators from raw SQL | **FAIL** |
| 4 | **Scheduler** | YES (the tick contract); consumer (the cron plane) | **PARTIAL** — the *in-bus tick* is platform (`engine.ts:1-7`, idempotent `tick()`); the *OS scheduler tiers* are admin infra: `rumah-admin/infra/scheduler-tiers.{json,mjs,schema.json}` + `.github/workflows/scheduler-tiers.yml`, `dead-man-switch.yml`, `goal-supervisor.yml` | `scheduler-tiers.json:3` spec "RS-DOS-v1 §7.5 — the tiered scheduler"; `:15` "the engine … is NOT an independent OS scheduler (no cron of its own)". The cadence/plane (Vercel-cron vs GHA-cron, Hobby 2-cron cap) is inherently consumer infra, but the **tier registry schema + the dead-man's-switch pattern** are reusable and should be templatized | The `scheduler-tiers` schema + driver pattern as a DOS template; the actual cron files stay consumer-side | **PARTIAL** (tick PASS, OS-scheduler FAIL — lives only in admin) |
| 5 | **Runtime** (the C11 Result Bus) | YES | **YES** — `delivery-os/templates/workflow-engine/` (canonical), vendored byte-identical to `property-lead-os/.claude/os/engine/` and `rumah-admin/.claude/os/engine/` | This is the existence proof. PLOS runs `createCapabilityRuntime` with REAL `@plos/db` + REAL Supabase-JWT auth, zero admin dependency (`runtime.ts:18-60`) | Nothing — already extracted | **PASS** |
| 6 | **Builder orchestration** (agent runner) | YES | **YES (framework)** — `templates/workflow-engine/agent-runner.ts` (29551 bytes) + `agent-registry.ts`, vendored to consumers. The *executor binding* is consumer-side: `rumah-admin/src/engine-admin/agent-runner-claude-executor.ts`, `claude-bin.ts` | The orchestration framework is platform; binding a real Claude executor is a consumer-supplied port impl (correct seam) | Nothing for the framework; executor stays consumer-side by design | **PASS** |
| 7 | **Verification** | YES | **YES** — `delivery-os/skills/verify-gate/` (the author≠verifier gate, Governance §12) + `templates/workflow-engine/verifiers.ts` (rung/calibration/gate framework). Goal-acceptance verification (`completion-review-c6.ts`) is admin-domain | The build-time verify-gate AND the runtime verifier framework are both platform-owned and vendored | Nothing (build-time + verifier framework). `completion-review-c6` is domain acceptance, follows the organ extraction | **PASS** |
| 8 | **Founder approvals** | YES | **SPLIT** — primitive **YES**: `templates/workflow-engine/approvals-route.ts` + `human-principal.ts` (`HumanPrincipalPort`, `WORKFLOW_SCOPES`, `isVerifiedHuman`). Governance-summon **NO**: `rumah-admin/src/founder-summon-c1.ts`, the FAP/boundary path | The human-gate *doctrine + port* is platform and vendored. The *3-tier founder-reach chain* (Slack→non-SaaS→durable, `founder-summon-c1.ts:194-240`) is admin-only | The `founder-summon` channel-chain as a templatized notifier with injected webhook config | **PARTIAL** (approval primitive PASS, summon FAIL) |
| 9 | **Execution lifecycle** (contract → preflight → sprint → reconcile → supervise → complete → boundary/FAP) | YES | **NO** — the entire organ graph is `rumah-admin/src/*-c*.ts`, none in `delivery-os` | This is the goal-governance state machine itself. Every organ imports `goal-contract.js` and most import `runtime-stores.js` (raw SQL). It exists nowhere but admin | The full organ set behind a `GoalStorePort`; this is the load-bearing extraction | **FAIL (worst)** |
| 10 | **Slack control surface** | YES (the seam); consumer (the bot wiring) | **NO (anywhere as a control surface)** — only a *notification webhook* exists: `founder-summon-c1.ts:25` `C1_SLACK_WEBHOOK`. The real `/goal` command surface is explicitly **OUT OF SCOPE / not built**: `founder-summon-c1.ts:46` "the real Slack surface + the /goal command (Sprint 5.3)" | The engine's `goals-route.ts` is the *intended* generic entrypoint Slack would call ("This is the surface Slack … calls to START work from intent") — so the platform *seam* exists, the *adapter* does not, in either repo | A Slack adapter that maps `/goal` → `POST /goals` (engine) and renders summons; shipped as a DOS pack consuming the existing `goals-route` + `approvals-route` | **FAIL** (not built; but cheapest — the seam is already platform) |

---

## 2. Verdict on the "delete `rumah-admin`" test

**Survives deletion (genuinely platform, PASS):**
- **Runtime / C11 bus** — `templates/workflow-engine/`, proven by PLOS running it independently.
- **Builder orchestration framework** — `agent-runner.ts` / `agent-registry.ts`, vendored.
- **Verification** — `skills/verify-gate/` + `verifiers.ts`.
- **Founder-approval primitive** — `approvals-route.ts` + `human-principal.ts`.
- **Goal-intake bus entrypoint** — `goals-route.ts`.
- Plus the build-time platform the prompt expected and which checks out: agents (`delivery-os/agents/`), operating loop + DoD + governance (`delivery-os/core/`), and the scaffolder (`delivery-os/scripts/new-project.sh`).

**Dies with deletion (coupled into admin, FAIL):**
- **Project Owner loop** (`po-reconciler-c2`, `po-autoloop-c2`)
- **Sprint planning** (`sprint-engine-c10`)
- **Execution lifecycle / goal-governance state machine** (the C1-C13 organ graph)
- **GoalContract intake + the C12 durable stores** (`goal-contract.ts`, `runtime-stores.ts`, the migrations)
- **OS scheduler tiers** (`infra/scheduler-tiers.*`)
- **Founder-summon channel chain** + **Slack control surface** (never built as a control surface)

**Honest summary of the gap:** the **build-time platform** (agents, loop, DoD, verify-gate, scaffolder) and the **stateless Runtime bus** are genuinely Delivery-OS-owned and consumer-installed. The **runtime goal-governance platform** — the organs that make Delivery OS an *autonomous goal supervisor* rather than just a workflow bus — is **entirely coupled into the first consumer.** Deleting `rumah-admin` today deletes the goal-governance OS.

---

## 3. The single worst coupling

**The Execution Lifecycle (capability #9) bound to admin's Postgres through `runtime-stores.ts` raw SQL (the C12 durable stores).**

Why it is the worst, concretely:
- It is the *defining* capability — the thing that distinguishes Delivery OS as an autonomous OS from a generic workflow engine — and it has **zero** presence in `delivery-os`.
- Every other coupled organ depends on it transitively: `po-reconciler`, `po-autoloop`, `goal-supervisor`, `sprint-engine`, `completion-review`, `goal-intake` all import `goal-contract.js` and/or `runtime-stores.js`.
- The binding is the *hard* kind: raw `sql\`INSERT INTO goal_delta_ledger …\`` / `sql\`… FROM goal_contract …\`` against named tables (`runtime-stores.ts:54,70`; `goal-contract.ts:89,117`), plus a direct `import postgres from "postgres"` in `metric-probe.ts:31`. There is **no** `DbLike`-style injection seam — unlike the engine, which already has one (`EngineContext.db`).
- The store invariants are enforced in admin's DB (RLS + guard triggers, migration 0052 per `runtime-stores.ts:3-4`), so the durable contract itself is admin-schema-shaped.

In short: the engine proved injection works (`EngineContext.db`); the governance organs simply **never adopted the same seam.** That is the whole debt.

---

## 4. Extraction plan — apply the C11 vendoring model to the governance organs

Target end-state, mirroring `templates/workflow-engine/`:

```
delivery-os/templates/governance-engine/      ← NEW: the vendored, DB-agnostic organ package
  index.ts            (barrel: createGovernanceRuntime, GoalStorePort, ProbeRegistry, organs)
  goal-contract.ts    (organ logic; NO sql import — depends on GoalStorePort)
  ports.ts            (GoalStorePort + GoalContractStore + ProbeReader interfaces)   ← load-bearing
  po-reconciler.ts · po-autoloop.ts · goal-supervisor.ts · sprint-engine.ts
  preflight-gate.ts · completion-review.ts · boundary-plan.ts · reachability-evaluator.ts
  founder-summon.ts   (channel-chain; injected webhook config, no hard-coded secret)
  metric-probe.ts     (ProbeRegistry framework only; descriptors stay consumer-side)
  migrations/         (the canonical goal_contract + 5 C12 store DDL as a TEMPLATE)
```

### 4.1 The load-bearing abstraction (do this first)

Define **`GoalStorePort`** — the durable-store adapter interface — by lifting the function signatures already present in `runtime-stores.ts` and the read/write functions in `goal-contract.ts`:

```ts
export interface GoalStorePort {
  // from runtime-stores.ts (the 5 C12 stores)
  appendProgressSample(s: ProgressSampleInput): Promise<boolean>;
  readProgressSeries(goalId: string): Promise<ProgressSample[]>;
  countAttempts(...): Promise<number>;
  readCumulativeCost(...): Promise<number>;
  // breaker, dead-letter, cost ledgers …
  // from goal-contract.ts
  insertContract(c: GoalContractRow): Promise<GoalContractRow>;
  readContract(goalId: string): Promise<GoalContractRow | null>;
  updateState(goalId: string, next: GoalState): Promise<void>;
}
```

The organs then depend on `GoalStorePort` — **never** on `./db/client.js`. This is the exact analogue of the engine's `EngineContext.db: DbLike`. The signatures already exist; this is a *re-typing*, not a redesign.

### 4.2 What becomes the DB-agnostic engine vs. what stays consumer-side

| Layer | Lands where | Notes |
|---|---|---|
| Organ logic (C1-C13 decision functions) | **DOS** `templates/governance-engine/` | Pure-ish; currently the only blocker is the raw-SQL imports |
| `GoalStorePort` + `ProbeReader` interfaces | **DOS** `ports.ts` | The injection seam |
| Migration **templates** (goal_contract + 5 stores, RLS/triggers) | **DOS** `templates/governance-engine/migrations/` | Shipped as a copy-in template; consumer owns its applied migration numbers (admin's 0052) |
| `ProbeRegistry` framework | **DOS** | The registry + version-pinning + credential-resolver seam already in `metric-probe.ts` |
| **postgres-js adapter** implementing `GoalStorePort` | **CONSUMER** | Admin's `runtime-stores.ts` becomes the *impl*, not the *interface* |
| **MetricProbe descriptors** (the actual SQL strings) | **CONSUMER** | Inherently domain — admin probes admin tables; PLOS probes lead tables |
| Scheduler cron files / plane choice | **CONSUMER** | `infra/scheduler-tiers.*` (Vercel/GHA, Hobby caps) is consumer infra |
| Slack `/goal` adapter | **DOS pack** (consuming engine `goals-route`) + **CONSUMER** secret/channel | The seam (`goals-route.ts`) is already platform |

### 4.3 Order of operations

1. **Extract `GoalStorePort`** from `runtime-stores.ts` + the persistence functions of `goal-contract.ts` (signatures only — no behavior change).
2. **Invert the dependency:** refactor each organ to consume the port; admin provides a `postgresGoalStore` adapter (its current `runtime-stores.ts` body, wrapped).
3. **Lift the organs** into `templates/governance-engine/` with an `index.ts` barrel + a `createGovernanceRuntime({ store, probes, principal, notifier })` factory (the analogue of `createCapabilityRuntime`).
4. **Templatize the migrations** (goal_contract + the 5 C12 stores + RLS/triggers) under `governance-engine/migrations/`.
5. **Admin re-vendors** via an `engine:install`-style copy of `governance-engine/` into its tree and supplies the adapter + descriptors + cron wiring — exactly as it already does for the C11 bus.
6. **Prove portability with PLOS:** wire `createGovernanceRuntime` in PLOS with a *lead-domain* probe (e.g. "qualified-leads count") and PLOS's own `@plos/db` adapter. If a goal runs end-to-end in PLOS with no admin code present, the platform claim is true.
7. **Ship the Slack pack** (`/goal` → engine `goals-route`; summons → `approvals-route` + the templatized founder-summon notifier) last — it is the cheapest because the seam already exists.

### 4.4 Minimum extraction to make the claim TRUE

The *smallest* change that makes "new consumer, no `rumah-admin`" honest is **steps 1-3 + 5**: define `GoalStorePort`, invert the organs onto it, lift them into a vendored `governance-engine/`, and re-vendor in admin. Migrations (4) and the Slack pack (7) can trail — a new consumer can hand-write its DDL from the template and drive goals via HTTP. The scheduler (capability #4) is genuinely consumer infra and need not be extracted beyond publishing the tier schema. **The one non-negotiable is the port: until the organs stop importing `./db/client.js`, nothing is extractable.**

---

## 5. Direct answer

> *If `rumah-admin` were deleted, could a new consumer retain the Runtime / PO / Slack / execution model by wiring a different domain — and if not yet, what's the shortest path to yes?*

**No — not today.** A new consumer would retain the **C11 Runtime bus, the agent-orchestration framework, the verify-gate, the founder-approval primitive, the generic goals entrypoint, and the whole build-time platform** — these are genuinely Delivery-OS-owned and already vendored (PLOS proves it). But it would **lose the entire goal-governance Runtime**: the Project Owner loop, sprint planning, the execution lifecycle/state machine, the C12 durable stores, the founder-summon chain, and the (never-built) Slack control surface. Those exist only in `rumah-admin/src/`, hard-wired to admin's Postgres via raw SQL.

**Shortest path to yes:** extract one interface — **`GoalStorePort`** (the durable-store adapter, modeled on the engine's already-proven `EngineContext.db` injection) — invert the dozen organ modules onto it, and lift them into a vendored **`delivery-os/templates/governance-engine/`** exactly as the C11 bus was lifted into `templates/workflow-engine/`. The organ *logic* is portable; only its *raw-SQL binding* is not. That single seam is the whole distance between "first consumer" and "first consumer of a real platform."

---

*Validation performed read-only. Files cited are at the paths and line ranges shown above as of 2026-06-29.*
