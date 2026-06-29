# Platform Extraction & Consolidation Audit

**Date:** 2026-06-29
**Type:** READ-ONLY, exhaustive, file-cited. No code changed; this document is the only artifact.
**North Star under test:** *Delivery OS is the PLATFORM; `rumah-admin` is ONLY the first consumer + reference implementation.*
**Builds on (does not redo):** `docs/reviews/ARCHITECTURE-VALIDATION-platform-vs-consumer-2026-06-29.md` (the 10-capability first pass that found the core debt: the governance organs use raw tagged-SQL instead of an injected store port like the engine's `EngineContext.db`). This pass EXTENDS that to **every** Runtime capability, adds the dependency graph, the ownership model, and the delete test, and re-reads the real code in all three repos.

**Posture of this audit:** brutally honest, no flattery, and it aggressively challenges the prior build decisions. Where the first pass was right it says so; where the story is rosier or worse than the first pass implied, it corrects it with citations.

---

## 0. Ground truth & the two corrections to the first pass

Three repos read directly:
- `C:\Users\brian\RUMAH\delivery-os` — the candidate PLATFORM.
- `C:\Users\brian\RUMAH\rumah-admin` — the FIRST consumer (holds the goal-governance Runtime + the vendored infra).
- `C:\Users\brian\RUMAH\property-lead-os` — the SECOND consumer (the vendoring existence-proof).

### Correction 1 — there are TWO distinct "goal" layers; do not conflate them.

| Layer | Where | What it is | Citations |
|---|---|---|---|
| **Build-time goal harness** | PLATFORM — `templates/tools/goal-init.mjs`, `goal-stop.mjs`, `progress-stall.mjs`, `stall-classify.mjs`, `boundary-classify.mjs` | A Claude-Code **session** hook. A `/goal` = the max autonomous execution segment of the *coding agent*; file-state in `.claude/.goal-state.json`; H1 cap kill-switch. Zero DB. | `templates/tools/goal-init.mjs:1-40` (`DEFAULT_CAP`, `CLEARS_ON`) |
| **Runtime goal-governance organs** | CONSUMER-ONLY — `rumah-admin/src/*-c*.ts` | The **product-runtime** autonomous goal supervisor: Postgres-backed durable contract + reconciler + supervisor + sprint engine, driven by cron. | `rumah-admin/src/goal-contract.ts`, `po-autoloop-c2.ts`, `goal-supervisor-c7.ts`, etc. |

The platform owns the *first* (build-time) layer. The capabilities this audit is asked to assess — Project Owner, Reconciler, Goal Supervisor, Sprint Engine, Execution Lifecycle — are the *second* (runtime) layer, and the platform owns **none** of it as code. Conflating the two is the single easiest way to overstate platform maturity.

### Correction 2 — the first pass UNDERSTATED how extractable the organs are, and OVERSTATED the infra coupling.

- The first pass implied the whole organ graph is hard-wired to admin's Postgres. **Re-reading every organ line-by-line: 12 of 14 organ files are already domain-generic and seam-injected.** Only **two** files hold raw SQL — `goal-contract.ts:17` and `runtime-stores.ts:11` — plus `metric-probe.ts:31` imports the `postgres` driver for a default reader. **No organ references a single admin-domain table** (no invoices/deliveries/owners/properties/contracts). Every `INSERT/SELECT/UPDATE` targets a *governance* table from migrations 0052/0053 (`goal_contract`, `goal_delta_ledger`, `attempt_ledger`, `circuit_breaker`, `idempotency_store`, `dead_letter`, `portfolio_cost_ledger`). The extraction is **smaller** than the first pass feared — the logic is portable; only the storage *defaults* bind to SQL.
- Conversely, the first pass barely covered the **infra/config platform**, which turns out to be the *good* news: the config-registry / platform-health / readiness / deploy-gate / rollback machinery is **already a reusable platform, vendored into BOTH consumers** (admin AND PLOS). Those capabilities largely PASS.

So the real headline is sharper than "the runtime governance is coupled": **the platform already proved the vendoring model twice (engine + infra), the governance organs are 90% ready to be the third vendored package, and yet zero of that extraction has been built** — the tracker's Sprint 1.6 ("GoalContract durable state" → platform) is **NOT STARTED** (`docs/execution/IMPLEMENTATION-TRACKER.md:33,183-191`). The debt is not technical difficulty; it is that the work hasn't been done while the organ count keeps growing inside the consumer.

---

## 1. Per-capability verdict table

**Verdict semantics:**
- **PASS** — the platform provides it today as vendorable code/skill; a brand-new consumer obtains it WITHOUT copying any `rumah-admin` code.
- **PARTIAL** — the platform owns the seam/primitive (or a generic template) but a load-bearing piece is consumer-only, or reuse requires stripping hard-coded couplings.
- **FAIL** — exists only in `rumah-admin`; deleting admin deletes the capability from the platform.

| # | Capability | Verdict | Platform location (cited) | Consumer-only piece (cited) | Worst hidden coupling |
|---|---|---|---|---|---|
| 1 | **Runtime (C11 engine)** | **PASS** | `templates/workflow-engine/` → `createEngine`, `EngineContext.db: DbLike` (`engine.ts:49-67,86-88`); barrel `index.ts:7-8,47` | — | none — DB injected |
| 2 | **Runtime Bus (durable tick/outbox)** | **PASS** | `engine.ts:128` `tick()` idempotent; `schema.ts` (`workflowRun/Step/outbox`), `index.ts:82` | — | none |
| 3 | **Builder Orchestration** | **PASS** | `templates/workflow-engine/agent-runner.ts`, `agent-registry.ts` (`index.ts:67-75`) | executor binding `rumah-admin/src/engine-admin/agent-runner-claude-executor.ts`, `claude-bin.ts` (correct seam) | none (port-correct) |
| 4 | **Capability Registry** | **PASS** | `capability-pack.ts` (`registerPacks`, `createCapabilityRuntime`), `capability-selector.ts` (`selectCapability`), `agent-registry.ts`; tools `capability-health.mjs`, `capability-config-resolver.mjs`, `capability-requirements.schema.json`, `census-detector.mjs` | pack *definitions* are domain (correct) | none |
| 5 | **Verification** | **PASS** | `skills/verify-gate/` + `templates/workflow-engine/verifiers.ts` (rung/calibration/gate, `index.ts:30-40`) | `completion-review-c6.ts` (goal-acceptance) is an organ — generic logic, seam-injected | none structural |
| 6 | **Founder Review** | **PASS** | `skills/founder-review-package/`, `templates/tools/founder-review-package.mjs`, `founder-review-env.mjs`, `FOUNDER-REVIEW.md.template`, `agents/founder-experience-reviewer.md` | — | none |
| 7 | **Founder Approvals (primitive)** | **PASS** | `approvals-route.ts` + `human-principal.ts` (`HumanPrincipalPort`, `WORKFLOW_SCOPES`, `index.ts:43-44,59`) | — | none |
| 8 | **Founder Action Package / Boundary (build-time)** | **PASS** | `skills/founder-action-package/`, `templates/tools/goal-stop.mjs`, `boundary-classify.mjs`, `founder-burden-gate.mjs` | runtime `boundary-plan-c2mind.ts`, `founder-summon-c1.ts` are organs | none (build-time) |
| 9 | **Config Registry** | **PASS** (couplings) | `templates/tools/config-doctor.mjs`, `i-config.mjs`, `config-registry.schema.json`, `config-secret-registry.schema.json` — **vendored into BOTH** `rumah-admin/infra/` AND `property-lead-os/infra/` | instances `config-registry.json`, `config-secret-registry.json` (per-consumer data) | Supabase ref `clfocpodfbtgzivnivck`, `*.pooler.supabase.com:6543` rule in instances |
| 10 | **Readiness Gates (config/deploy)** | **PASS** (couplings) | `i-config.mjs` PRESENT/MISSING/INVALID/DRIFTED; `deploy-gate-d7.mjs` (D7 3-precondition); `config-gate.yml` (the one binding gate) | release-auth ledger instance | Vercel/`gh`/Supabase plane hard-wired in `i-config.mjs:131-144,349,380` |
| 11 | **Observability / Platform-Health** | **PASS** | `templates/tools/platform-health.mjs` (+`.schema.json`,`.d.mts`) app-neutral `buildReport/computeVerdict`; vendored to both consumers | — | Supabase/pooler advice strings only in `classifyFailure:230` (hints, not logic) |
| 12 | **Deploy / Release governance + Rollback** | **PASS** (Vercel-plane) | `deploy-gate-d7.mjs`, `release-flags.mjs`, `post-deploy-health-gate.mjs`, `post-deploy-verify.mjs`, `rollback-helper.mjs` — all platform-shaped, vendored | fixtures/auth-ledger instances | `rollback-helper.mjs:74,83,99` Vercel-only (`api.vercel.com`, `vercel promote`) |
| 13 | **Goal Intake** | **PARTIAL** | bus entrypoint `goals-route.ts` (`createGoalsRoute`, `index.ts:53`) — generic intent→run | governance intake `goal-intake-c1.ts` (GoalContract creation, FAP approve) | `RUNTIME_FOUNDER_ID` env read `goal-intake-c1.ts:117` |
| 14 | **Scheduler** | **PARTIAL** | engine `tick()` is the loop primitive; **schema+validator are GENERIC but NOT in platform** — live only in `rumah-admin/infra/scheduler-tiers.{mjs,schema.json}` | registry `scheduler-tiers.json` + 3 GHA workflows (consumer-instance) | not promoted to `templates/`; a 3rd consumer would fork from admin |
| 15 | **Mission Control (liveness/watchdog)** | **PARTIAL** | health contract `platform-health.mjs` PASS | dead-man-switch / heartbeat-driver / goal-supervisor **workflows** hard-wired to admin routes+secrets | `dead-man-switch.yml`, `heartbeat-driver.yml:73` (`/v1/heartbeat`, `CRON_SECRET`, `PROD_BASE_URL`) |
| 16 | **Slack Surface (control)** | **FAIL** | seam exists: `goals-route.ts` is the intended `/goal`→`POST /goals` target | only a notify webhook `founder-summon-c1.ts:243` `C1_SLACK_WEBHOOK`; the `/goal` command is **not built anywhere** | n/a — never built |
| 17 | **Project Owner (PO loop)** | **FAIL** | none | `po-autoloop-c2.ts` (hub: imports 7 organs) + `po-reconciler-c2.ts` | depends on the two SQL store files transitively |
| 18 | **Reconciler** | **FAIL** | none | `po-reconciler-c2.ts` ("SOLE mutator of the goal state machine") | calls `transition/readContract` from `goal-contract.ts` (raw SQL) |
| 19 | **Lifecycle Controller** | **FAIL** | none | `po-autoloop-c2.ts` (`runGoalLifecycle`) | imports `runtime-stores.ts:107` |
| 20 | **Sprint Engine / Sprint Planning** | **FAIL** | none | `sprint-engine-c10.ts` (`runSprint`), `boundary-plan-c2mind.ts` (next-sprint plan) | `sprint-engine-c10.ts:38-49` default `realStores` → `runtime-stores` |
| 21 | **Goal Supervisor** | **FAIL** | none | `goal-supervisor-c7.ts` (liveness≠progress trip rule) | default `runtimeStoresAdapter:577` → `runtime-stores`; `GS_FAP_WEBHOOK` ref |
| 22 | **Execution Lifecycle (the state machine)** | **FAIL (worst)** | none | the whole `*-c*.ts` graph; the C12 durable stores | `runtime-stores.ts:11` + `goal-contract.ts:17` raw SQL |
| 23 | **Durable Runtime Stores (C12)** | **FAIL** | none | `runtime-stores.ts` (6 stores) + `goal-contract.ts` | raw SQL × ~23 statements; Postgres-specific `pg_advisory_xact_lock` (`:218`) |
| 24 | **Cost Governance** | **FAIL** | build-time `founder-burden-gate.mjs` exists (different concern) | runtime spend = `portfolio_cost_ledger` in `runtime-stores.ts:215-234` + GS budget cap | raw SQL `appendCost/readCumulativeCost` |
| 25 | **MetricProbe substrate** | **FAIL** | none | `metric-probe.ts` (versioned read-only probe registry + `invokeProbe`) | `metric-probe.ts:31` `import postgres` for default reader |
| 26 | **Preflight / Reachability gate (C9)** | **FAIL** | build-time readiness gates exist (#10) | `preflight-gate-c9.ts`, `reachability-evaluator.ts` | `preflight-gate-c9.ts:363-365` shells `execFileSync` to `infra/i-config.mjs` (hard relative path) |
| 27 | **Legacy-guard / execution-boundary** | **PARTIAL** | platform tool `legacy-guard-config.mjs` (config detections) | `legacy-guard-execution.mjs` (scheduler/exec/store-mutation detector) | `PROTECTED_TABLES`/engine-paths/sweep-entrypoints hard-coded `:91-106,223` |

**Tally:** PASS = 12 · PARTIAL = 4 · FAIL = 11. The PASS column is the entire *stateless* platform (engine, orchestration, registry, verification, founder review/approval, config, observability, deploy/rollback). The FAIL column is, almost exactly, the *stateful goal-governance runtime* — the thing that makes Delivery OS an "operating system" rather than a workflow library.

---

## 2. Per-capability deep dive (the 7 required elements)

For brevity the 12 clean PASS capabilities are grouped; every FAIL/PARTIAL gets the full 7-point treatment because that is where the platform claim is decided.

### 2.A The PASS spine (capabilities 1-12) — already platform, already vendored

**(1) repo+location · (2) deps · (3) generic-vs-consumer · (4) why-here · (5) reusable-today · (6) couplings · (7) what-must-move** — answered once for the spine:

1. **Location:** `delivery-os/templates/workflow-engine/` (the engine, 19 modules + migrations) and `delivery-os/templates/tools/*.mjs` (the infra tool-belt) and `delivery-os/skills/*` (verify-gate, founder-review-package, founder-action-package).
2. **Dependencies:** the engine imports nothing app-specific — it declares ports (`EngineContext`, `DbLike`, `HumanPrincipalPort`) and takes impls as parameters (`engine.ts:57-67`, `index.ts:8,43-44`). The infra tools are zero-dep Node ESM (e.g. `lifecycle-gate.mjs:30` "Zero deps on purpose: any repo's CI imports it without installing anything").
3. **Generic vs consumer:** GENERIC. Proven generic by the existence of two independent consumers.
4. **Why it belongs in the platform:** it is the app-agnostic mechanism; the consumer supplies domain via ports (db, tables, auth, packs, config instances).
5. **Reusable today?** YES, and proven: PLOS composes the *byte-identical* vendored engine via `createCapabilityRuntime` with REAL `@plos/db` + Supabase-JWT auth and ZERO admin dependency (`property-lead-os/apps/web/lib/engine/runtime.ts:16-69`); both consumers vendor the same config/health/deploy tools into `infra/`.
6. **Hidden couplings:** for the *engine/skills* — none. For the *infra tools* — the generalizable but real ones: the Supabase project ref `clfocpodfbtgzivnivck` and the `postgres-pooler-6543` rule baked into config *instances* and diagnostic *hint strings* (`i-config.mjs:131-144`, `platform-health.mjs:230`); the Vercel/`gh` plane readers (`i-config.mjs:349,380`); `rollback-helper.mjs` is Vercel-only (`:74,83,99`). These are *plane* couplings (Vercel+Supabase+GitHub), not *rumah-admin-domain* couplings — a new consumer on the same plane reuses by config; a consumer on a different plane must swap the plane readers.
7. **What must move:** nothing to make them reusable on-plane. To make them plane-agnostic (a later, optional refinement): pull the Vercel/`gh`/Supabase plane readers and the pooler rule out of `i-config.mjs`/`config-doctor.mjs` behind a declared-plane interface, and parameterize the Supabase hint strings in `platform-health.mjs`/`classifyFailure`.

**The one PASS-column debt worth flagging (challenge):** the config layer ships **two** live validators — legacy `config-doctor.mjs` and canonical `i-config.mjs` — and **two** registries (`config-registry.json` + `config-secret-registry.json`), with `config-doctor` still the live source of truth pending a never-executed "Sprint 2.2 enforce-flip" (`config-secret-registry.json:5`). Both are vendored into consumers, so **every new consumer inherits the dual-registry confusion.** A reference platform should not export its own unfinished migration. Consolidate onto `i-config.mjs` before the next consumer onboards. Secondary: `post-deploy-verify.mjs:51` calls the *legacy* `config-doctor` while `deploy-gate-d7.mjs:238` calls `i-config` — two oracles in one deploy path; and the health route is inconsistent (`/v1/health/platform` vs `/api/health/platform`).

### 2.B Goal Intake (#13) — PARTIAL

1. **Location:** generic — `delivery-os/templates/workflow-engine/goals-route.ts` (`createGoalsRoute`, vendored). Governance — `rumah-admin/src/goal-intake-c1.ts` (the 36 KB front door: `parseGoalSubmission`/`submitGoal` + `approveFap`).
2. **Deps:** `goal-intake-c1.ts` imports `preflight-gate-c9`, `goal-contract` (value `readContract`), `po-autoloop-c2` (`runGoalLifecycle`), `po-reconciler-c2` (`applyReconcilePlan/reconcile`), `founder-summon-c1` (types) — `:58-84`. No direct `db/client`, no engine.
3. **Generic vs consumer:** the bus entrypoint is GENERIC platform; the governance intake is GENERIC *logic* but lives consumer-side. No admin-domain knowledge.
4. **Why:** the bus `POST /goals` belongs in the engine (it is intent→capability→run). The governance contract intake (acceptance shape, budget caps, identity binding) belongs in the governance package — which does not exist yet, so it sits in the consumer.
5. **Reusable today?** Bus: YES. Governance intake: NO — a new consumer would have to copy `goal-intake-c1.ts` from admin.
6. **Couplings:** `RUNTIME_FOUNDER_ID` via `process.env` (`:117`, overridable at `:113`); `realSlackTransport:663` throws DEFERRED. No SQL, no admin tables.
7. **What must move:** lift `goal-intake-c1.ts` into the governance package; route `RUNTIME_FOUNDER_ID` through a `FounderBindingPort`/config-registry key rather than a raw env read.

### 2.C Scheduler (#14) — PARTIAL, and the most under-appreciated gap

1. **Location:** in-bus tick — `engine.ts:128` (platform). Tier registry + validator + schema — **only** in `rumah-admin/infra/scheduler-tiers.{json,mjs,schema.json}`; the three driver workflows in `rumah-admin/.github/workflows/`.
2. **Deps:** `scheduler-tiers.mjs` reuses `detectSchedulers` from `legacy-guard`; reads a sibling `scheduler-tiers.json` (`REGISTRY_PATH:46`).
3. **Generic vs consumer:** the **schema and validator are fully generic** (`scheduler-tiers.schema.json` is app-neutral; `scheduler-tiers.mjs` is pure over an injected registry). The **registry instance and the workflows are consumer-specific** (every tier names `/v1/heartbeat`, `vercel.json`, `CRON_SECRET`, `GS_FAP_WEBHOOK`, and the Vercel-Hobby 2-cron cap, `scheduler-tiers.json:3-10,32-80`).
4. **Why:** cadence/plane (Vercel-cron vs GHA-cron, Hobby caps) is inherently consumer infra; the tier *schema* and the dead-man's-switch *pattern* are reusable doctrine.
5. **Reusable today?** NO at the platform level — because the generic schema+validator were **never promoted to `delivery-os/templates/`.** They live only in the consumer.
6. **Coupling / challenge:** this is a latent **consumer→consumer fork hazard.** A third consumer that wants tiered scheduling has nothing to vendor from the platform; its only source is `rumah-admin/infra/` — i.e. it would fork a *consumer*, the exact anti-pattern the vendoring model exists to prevent. The generic 60% is trapped in the consumer.
7. **What must move:** promote `scheduler-tiers.schema.json` + the validator core of `scheduler-tiers.mjs` into `templates/tools/`; template the three driver workflows with route + secret names as inputs. Leave the per-consumer registry instance and cron cadence consumer-side.

### 2.D Mission Control (#15) — PARTIAL

1. **Location:** health contract — `templates/tools/platform-health.mjs` (platform). Watchdog/driver — `rumah-admin/.github/workflows/dead-man-switch.yml`, `heartbeat-driver.yml`, `goal-supervisor.yml` (consumer).
2. **Deps:** workflows shell out to admin scripts/routes (`heartbeat-driver.yml:73` `POST ${PROD_BASE_URL}/v1/heartbeat`; `goal-supervisor.yml:60` `npx tsx scripts/goal-supervisor-c7.ts`).
3. **Generic vs consumer:** the *fold-to-verdict* health contract is generic; the *drivers* are consumer instances (routes, secrets, the supervisor depends on the app build).
4. **Why:** a watchdog must call a real route with a real secret — inherently consumer. But the zero-dep inline POST/GET *pattern* is generic.
5. **Reusable today?** Health contract YES; the watchdog/driver trio NO (code+secret copy).
6. **Couplings:** `PROD_BASE_URL`, `CRON_SECRET`, `WATCHDOG_*`, routes `/v1/heartbeat`, `/v1/health/platform`, `GS_FAP_WEBHOOK`.
7. **What must move:** templatize the three driver workflows (route + secret as inputs) alongside the scheduler-tier promotion (#14); they are the same gap.

### 2.E The goal-governance organ graph (#16-#26) — FAIL cluster

These eleven share a root cause, so the 7 elements are given once for the cluster, then per-organ specifics.

1. **Location:** `rumah-admin/src/{po-autoloop-c2,po-reconciler-c2,goal-supervisor-c7,sprint-engine-c10,boundary-plan-c2mind,completion-review-c6,preflight-gate-c9,reachability-evaluator,goal-intake-c1,founder-summon-c1,metric-probe,goal-progress,goal-contract,runtime-stores}.ts`. **Platform copies: ZERO** — a whole-repo grep of `delivery-os` for `goal-contract|po-reconciler|po-autoloop|goal-supervisor|runtime-stores|GoalStorePort|createGovernanceRuntime` returns only docs/plans, no implementation. There is no `templates/governance-engine/`.
2. **Dependency shape (the graph):** `po-autoloop-c2` is the hub (imports 7 organs + `runtime-stores`, `:55-107`); `goal-intake-c1` imports the hub + reconciler + contract; `completion-review-c6` reuses `acceptanceMet` from the reconciler (`:44`); `sprint-engine-c10`, `goal-supervisor-c7`, `goal-progress` default to `runtime-stores`; `boundary-plan-c2mind`, `founder-summon-c1`, `reachability-evaluator` are leaves (type-only / zero imports). **The entire graph funnels into exactly two SQL files** (`goal-contract.ts`, `runtime-stores.ts`) plus one driver import (`metric-probe.ts:31`).
3. **Generic vs consumer:** GENERIC logic, consumer-located. 12/14 files have no admin-domain knowledge whatsoever; the pure rules (reconcile, GS trip, C6 adjudication, C9 checks, boundary rule) are already DB-free and seam-injected.
4. **Why it belongs in the platform:** this *is* the operating system — the autonomous goal supervisor. It is the differentiator vs. a plain workflow bus. It belongs in a vendored `governance-engine/` exactly as the C11 bus belongs in `workflow-engine/`.
5. **Reusable today?** NO. A new consumer gets none of it without copying admin.
6. **Hidden couplings (the only real blockers):**
   - `runtime-stores.ts:11` `import { sql } from "./db/client.js"` → ~17 raw statements over 6 governance tables (`goal_delta_ledger:66`, `attempt_ledger:88`, `circuit_breaker:130`, `idempotency_store:178`, `dead_letter:204`, `portfolio_cost_ledger:220-223`), Postgres-specific `pg_advisory_xact_lock(hashtext(...)):218`, `make_interval`, `ON CONFLICT`.
   - `goal-contract.ts:17` `import { sql }` → 6 statements over `goal_contract` (`:90,106,117,130,178`); the §4.3 legality is enforced by a DB trigger (0053) so the *store* enforces the state machine.
   - `metric-probe.ts:31` `import postgres` → default `makeReadOnlySqlReader` (`:134`); probe SQL is *registry-supplied*, not hard-coded, and allow-list-guarded (`:109-112`).
   - `preflight-gate-c9.ts:363-365` default `makeIConfigReadiness` shells `execFileSync` to `infra/i-config.mjs` with a hard-coded `src/ → ..` relative path (injectable via `ctx.configReadiness:234`).
   - env seams (generic, not admin-domain): `RUNTIME_FOUNDER_ID` (`goal-intake-c1:117`), `C1_SLACK_WEBHOOK`/`C1_NONSAAS_FALLBACK` (`founder-summon-c1:243,252`), `GS_FAP_WEBHOOK` (`goal-supervisor-c7:467,537`, inert).
   - **Zero admin-table leakage** — confirmed across all 14 files.
7. **What must move (exactly):**
   - Define **`GoalContractStorePort`** (from the 6 functions in `goal-contract.ts`) and **`RuntimeStoresPort`** (the 6 sub-stores in `runtime-stores.ts`) — pure re-typing of signatures that already exist.
   - Invert each organ's default (`realStores`, `runtimeStoresAdapter`, `dbReadContract`) onto the injected ports; admin keeps its current `runtime-stores.ts`/`goal-contract.ts` bodies as the *postgres adapter impl*.
   - Add a **`ProbeReaderPort`** so `metric-probe.ts` stops importing `postgres` directly (the `CredentialResolver` seam already exists, `:96-104`).
   - Replace `preflight-gate`'s path-resolved `execFileSync` default with an injected `ConfigReadinessPort`.
   - Lift all 14 organs into `delivery-os/templates/governance-engine/` with a `createGovernanceRuntime({ store, probes, principal, notifier, config })` factory (the analogue of `createCapabilityRuntime`) and a `migrations/` template (goal_contract + 6 stores + RLS/triggers).
   - Re-vendor into admin; prove portability by wiring a *lead-domain* probe + `@plos/db` adapter in PLOS.

   **Per-organ movability** (effort to invert): `reachability-evaluator` (zero deps), `boundary-plan-c2mind` (type-only) → trivial; `po-reconciler`, `po-autoloop`, `completion-review`, `goal-supervisor`, `sprint-engine`, `goal-progress`, `goal-intake`, `founder-summon` → low (sibling/port only); `preflight-gate`, `metric-probe` → medium (path/driver default); `goal-contract`, `runtime-stores` → the two real store ports. **No organ is hard.**

### 2.F Slack control surface (#16 in the table, restated) — FAIL but cheapest

1. **Location:** nowhere as a control surface. Only a notify webhook (`founder-summon-c1.ts:243`). The intended seam is the platform's `goals-route.ts`.
2-6. The engine's `goals-route` is the generic `/goal`→`POST /goals` target; the adapter that maps a Slack slash-command to it does not exist in either repo. `founder-summon-c1.ts:46` itself notes "the real Slack surface + the /goal command (Sprint 5.3)" as out of scope.
7. **What must move:** ship a DOS Slack pack consuming the existing `goals-route` + `approvals-route` + the templatized founder-summon notifier. Cheapest of all the gaps because the platform seam already exists.

### 2.G Legacy-guard / execution-boundary (#27) — PARTIAL

1. **Location:** config detections — `templates/tools/legacy-guard-config.mjs` (platform). Execution-boundary — `rumah-admin/infra/legacy-guard-execution.mjs` (consumer).
2-3. Generic detector engine, but the protected-surface *knowledge* is hard-coded admin runtime model.
6. **Couplings:** `PROTECTED_TABLES` lists the 9 governance tables (`:103-106`); sanctioned writers `runtime-stores|goal-contract` (`:94`); engine-boundary regex `engine-admin|engine-runtime|.claude/os/engine` (`:91`); sweep entrypoints `runDiscovery|discoverySweep|researchCompany|resolveContactsForLead` (`:223` — PLOS/rumah domain); agent binaries `claude|agent|codex|aider` (`:225`).
7. **What must move:** externalize `PROTECTED_TABLES`/`ENGINE_PATHS`/`SANCTIONED_STORE_WRITERS`/sweep-entrypoints into a per-consumer config the generic detector reads; then the detector is platform-owned.

---

## 3. Consumer Independence Audit — "rumah-admin is DELETED, a NEW consumer (Property Lead OS / Finance OS) onboards"

For each capability: can Delivery OS provide it WITHOUT copying code from `rumah-admin`?

| Capability | New consumer gets it from platform alone? | Evidence |
|---|---|---|
| Runtime / Bus / Orchestration / Capability Registry | **PASS** | PLOS already runs the vendored engine with `@plos/db`, zero admin code (`property-lead-os/apps/web/lib/engine/runtime.ts:16-69`) |
| Verification / Founder Review / Approvals / FAP (build-time) | **PASS** | skills + `verifiers.ts` + `approvals-route.ts` are platform; no admin reference |
| Config Registry / Readiness / Observability / Deploy / Rollback | **PASS (on-plane)** | the *same* tools are vendored into PLOS today (`property-lead-os/infra/config-doctor.mjs`, `i-config.mjs`, `platform-health.mjs`, `config-registry.json:2` → `$schema` at `../delivery-os/templates/tools/config-registry.schema.json`) |
| Goal Intake (bus) | **PASS** | `goals-route.ts` vendored |
| Goal Intake (governance contract) | **FAIL** | `goal-intake-c1.ts` is admin-only |
| Scheduler (tiered) | **FAIL** | generic schema+validator live only in `rumah-admin/infra/`; nothing in `templates/` to vendor |
| Mission Control (watchdog/drivers) | **FAIL** | the three workflows are admin-only |
| Project Owner / Reconciler / Lifecycle Controller | **FAIL** | `po-*-c2.ts` admin-only |
| Sprint Engine / Sprint Planning | **FAIL** | `sprint-engine-c10.ts` admin-only |
| Goal Supervisor | **FAIL** | `goal-supervisor-c7.ts` admin-only |
| Execution Lifecycle / Durable Stores (C12) | **FAIL** | the organ graph + `runtime-stores.ts`/`goal-contract.ts` admin-only |
| Cost Governance (runtime spend) | **FAIL** | `portfolio_cost_ledger` lives in admin's `runtime-stores.ts` |
| MetricProbe substrate | **FAIL** | `metric-probe.ts` admin-only |
| Preflight / Reachability gate | **FAIL** | `preflight-gate-c9.ts`, `reachability-evaluator.ts` admin-only |
| Legacy-guard execution-boundary | **PARTIAL** | generic engine, but the protected-surface lists ship inside the admin instance |
| Slack control surface | **FAIL** | never built (seam exists) |

**Independence headline:** the new consumer keeps a complete **stateless platform** (engine, orchestration, registry, verification, founder review/approval, config, observability, deploy, rollback) — genuinely Delivery-OS-owned and already proven on a second consumer. It **loses the entire stateful goal-governance OS** (PO loop, reconciler, supervisor, sprint engine, lifecycle, durable stores, probe, preflight, cost, scheduler tiers, Slack). Those are 90% generic code that simply never left the first consumer.

---

## 4. Repository Ownership Model — the final table

Every service/folder/capability → its owning repo + why. "Owning" = where the *source of truth* must live; consumers may hold *vendored copies* or *instances*.

| Artifact / capability | Owning repo (target) | Owning repo (today) | Why it belongs there |
|---|---|---|---|
| `templates/workflow-engine/` (C11 engine, bus, orchestration, registry, verifiers, approvals, goals-route) | **delivery-os** | delivery-os ✓ | app-agnostic mechanism; declares ports, takes impls |
| `skills/*` (verify-gate, founder-review-package, founder-action-package, learning-review, repo-governance, …) | **delivery-os** | delivery-os ✓ | build-time process organs; Claude-invoked + .mjs-backed |
| `agents/*`, `core/*` (loop, DoD, governance, severity) | **delivery-os** | delivery-os ✓ | the kernel doctrine |
| `templates/tools/*` build-time goal harness (`goal-init/stop`, `progress-stall`, `boundary-classify`) | **delivery-os** | delivery-os ✓ | governs the coding agent's session, not the product runtime |
| Config-registry / readiness / platform-health / deploy-gate / release-flags / rollback **tools + schemas** | **delivery-os** | delivery-os ✓ (vendored to both consumers) | proven reusable; the vendoring model already works for infra |
| Config-registry / secret-registry **instances**, `release-authorizations.json` | **each consumer** | rumah-admin ✓ / PLOS ✓ | per-consumer data (keys, secrets, project refs) |
| Engine **executor binding** (`agent-runner-claude-executor`, `claude-bin`) | **each consumer** | rumah-admin ✓ | a port impl; correct seam |
| Engine `EngineContext` impl (db + tables + auth + packs) | **each consumer** | rumah-admin ✓ / PLOS ✓ | domain wiring of the platform ports |
| **Scheduler tier schema + validator** | **delivery-os** (must move) | **rumah-admin** ✗ | generic machinery trapped in the consumer; fork hazard |
| Scheduler tier **registry instance** + cron workflows | **each consumer** | rumah-admin ✓ | cadence/plane/secret are consumer infra |
| **Governance organs** (PO loop, reconciler, supervisor, sprint engine, lifecycle, preflight, boundary, completion-review, founder-summon, goal-intake, metric-probe substrate, reachability) | **delivery-os** `templates/governance-engine/` (must create) | **rumah-admin** ✗ | the OS itself; generic logic, consumer-located |
| **Durable governance stores** (`runtime-stores.ts`, `goal-contract.ts`) → `GoalContractStorePort` + `RuntimeStoresPort` interfaces | **delivery-os** (interfaces) + **each consumer** (postgres adapter) | **rumah-admin** ✗ (interface+impl fused) | mirror the engine's `DbLike`: port in platform, adapter in consumer |
| Governance **migrations** (goal_contract + 6 C12 stores + RLS/triggers) | **delivery-os** (template) + **each consumer** (applied numbers) | rumah-admin ✗ | shipped as copy-in template; consumer owns its migration numbers |
| **MetricProbe descriptors** (the actual probe SQL) | **each consumer** | rumah-admin ✓ | inherently domain (admin probes admin tables; PLOS probes lead tables) |
| **Slack `/goal` adapter** | **delivery-os pack** (must build) + **each consumer** (secret/channel) | nobody ✗ | the seam (`goals-route`) is already platform |
| Legacy-guard execution detector **engine** | **delivery-os** (must move) | rumah-admin ✗ | generic engine; protected-surface lists → consumer config |
| Admin domain (invoicing, deliveries, owners, contracts, settlement, owner-invoices, …) | **rumah-admin** | rumah-admin ✓ | the actual product; never a platform concern |
| PLOS domain (leads, discovery, dunning, outreach) | **property-lead-os** | property-lead-os ✓ | the actual product |

**Ownership headline:** the boundary is already correct for the *stateless* half and already proven on two consumers. The *stateful* half (governance organs + their store ports + the scheduler schema + the legacy-guard engine) is **mis-located in the first consumer** — not by design intent (the doctrine and the tracker both say it should be in the platform) but by **unstarted work**.

---

## 5. Runtime Dependency Graph + forbidden-dependency proof

### 5.1 The graph (high level)

```
                    delivery-os (PLATFORM, source of truth)
   templates/workflow-engine/  templates/tools/  skills/  agents/  core/
        │ (sha-pinned VENDOR copy)         │ (sha-pinned VENDOR copy)
        ▼                                   ▼
  consumer/.claude/os/engine/        consumer/infra/*.mjs + schemas
        │ imported via                      │ run as CI/CLI
        ▼                                    ▼
  consumer EngineContext impl         consumer config instances
  (db, tables, auth, packs,           (registry JSON, secrets,
   executor binding)                   cron workflows)

  rumah-admin ONLY (not yet extracted):
   goal-intake-c1 → po-autoloop-c2 ──┬→ preflight-gate-c9 → metric-probe(+postgres), reachability
                                     ├→ goal-supervisor-c7 ─┐
                                     ├→ po-reconciler-c2 ───┤→ goal-contract.ts ─→ sql(./db/client)
                                     ├→ sprint-engine-c10 ──┤→ runtime-stores.ts ─→ sql(./db/client)
                                     ├→ completion-review-c6 ┘
                                     ├→ boundary-plan-c2mind (leaf)
                                     └→ founder-summon-c1 (leaf)
```

The governance subgraph has exactly **two sinks that touch the DB** (`goal-contract.ts`, `runtime-stores.ts`) plus one driver import in `metric-probe.ts`. Everything upstream is pure/seam-injected.

### 5.2 Forbidden-dependency proof

**Rule A — no platform → consumer dependency.** A targeted grep of `delivery-os` for `import … from` referencing `rumah-admin`, `property-lead-os`, or `@plos` (node_modules excluded) returns **ZERO code imports.** ~60 textual hits exist but every one is doc/comment/provenance/`$schema` (e.g. `case-studies/*.md`, `contracts/admin-plos-seam-v1.mjs:5-22` provenance comments, `check-os-drift.mjs:4`). **Invariant HOLDS.**

**Rule B — no consumer → platform-internals reach-in (consumers use their OWN vendored copy).** Both consumers import their local `.claude/os/engine/`, never `delivery-os` source:
- `property-lead-os/apps/web/lib/engine/runtime.ts:16-24` → `import … from "../../../../.claude/os/engine/index.js"` (vendored; provenance `property-lead-os/.claude/os/INHERITED-engine.json:6` "VENDORED (sha-pinned) … Do NOT hand-edit").
- `rumah-admin/src/engine-admin/engine-instance.ts:21-25` → `import … from "../../.claude/os/engine/index.js"` (header `:5` "Admin holds NO engine source").
**Invariant HOLDS.**

**The cross-boundary references that DO exist (and are benign):**
1. **Sync/install tooling (the vendoring mechanism itself):** `os-inherit.mjs sync/engine-check --from ../delivery-os` (`rumah-admin/package.json:83-85`, `property-lead-os/packages/engine-install/package.json:8-9`).
2. **Dev/ops scripts + parity tests (not app/engine runtime):** `rumah-admin/scripts/agents-idle-check.mjs:37` imports `../../delivery-os/templates/tools/agent-health.mjs`; `property-lead-os/tests/seam-copy-parity.test.ts:34` diffs the vendored copy against the `../../delivery-os` canonical (intentional parity assertion). `property-lead-os/tools/experience-gate.mjs:3-6` documents the rule: it is a vendored copy precisely because "a `../../delivery-os/...` import breaks the moment the sibling checkout is absent."
3. **Provenance/`$schema` pointers:** `rumah-admin/infra/config-registry.json:2` (legacy) and `property-lead-os/infra/config-registry.json:2` point `$schema` at `../delivery-os/templates/tools/config-registry.schema.json`.

**One real (minor) violation found:** the `$schema` pointers in #3 are a *build-time sibling-checkout coupling* — they resolve only when `delivery-os` sits next to the consumer. It breaks no runtime and is JSON-schema-only, but it is technically a consumer→platform-path reach-in that the vendoring model says should be a vendored local schema. Low severity; worth fixing by vendoring the schema file alongside the registry instance (the canonical `config-secret-registry.json` already uses a self-relative `./` schema, so the pattern is known-good).

**Verdict:** no forbidden runtime dependency in either direction. The architecture invariant is intact; the only blemish is a build-time `$schema` sibling-path pointer in the legacy config registries.

---

## 6. The Delete Test

> **If `rumah-admin` disappeared tomorrow, could Delivery OS honestly function as a reusable operating system for a brand-new consumer?**

**Answer: NO — not as an *operating system*. YES — as a reusable *workflow + delivery platform*.**

**Objective evidence for the YES half:** PLOS already IS the brand-new consumer for the stateless platform — it composes the byte-identical vendored engine (`property-lead-os/apps/web/lib/engine/runtime.ts:16-69`) and vendors the same config/health/deploy/rollback tools into `property-lead-os/infra/`, with ZERO admin code (governance-organ grep across PLOS = **No matches**). Delete admin and PLOS keeps running.

**Objective evidence for the NO half:** every capability that makes Delivery OS an *autonomous goal operating system* rather than a workflow library — Project Owner loop, Reconciler, Lifecycle Controller, Goal Supervisor, Sprint Engine, Execution Lifecycle, the C12 durable stores, MetricProbe, Preflight, runtime Cost Governance, the tiered Scheduler, and the Slack control surface — exists **only** in `rumah-admin/src/` and `rumah-admin/infra/`. The platform ships **zero** of it: no `templates/governance-engine/`, no `GoalStorePort`, no `createGovernanceRuntime`, and the tracker's extraction sprint is **NOT STARTED** (`docs/execution/IMPLEMENTATION-TRACKER.md:33,183-191`). Deleting admin deletes the OS.

### The single shortest-path gap

**Define two store ports and lift the organs behind them — nothing else is on the critical path.**

The organs are NOT the blocker: 12 of 14 are already generic and seam-injected, with zero admin-domain coupling. The *entire* distance between "first consumer" and "first consumer of a real platform" is the **two raw-SQL sinks**:

- `rumah-admin/src/runtime-stores.ts:11` (`import { sql }`) → extract **`RuntimeStoresPort`**.
- `rumah-admin/src/goal-contract.ts:17` (`import { sql }`) → extract **`GoalContractStorePort`**.

These are the exact analogue of the engine's already-proven `EngineContext.db: DbLike`. The signatures already exist — it is a re-typing, not a redesign. Invert the organs onto the ports, lift all 14 into `delivery-os/templates/governance-engine/` with a `createGovernanceRuntime` factory, and re-vendor into admin exactly as the C11 bus was lifted into `templates/workflow-engine/`. Prove it by running one goal end-to-end in PLOS with a lead-domain probe and `@plos/db`. Until the organs stop importing `./db/client.js`, the platform's central claim is aspirational; the moment they do, it is true.

**Two consolidation items to ride along (not on the critical path but cheap and overdue):** (1) promote the generic `scheduler-tiers` schema+validator and the three driver workflows from `rumah-admin/infra/` into `templates/` — they are generic machinery currently trapped in the consumer (a fork hazard for consumer #3); (2) collapse the dual config registry/validator (legacy `config-doctor` + canonical `i-config`) onto one oracle before the next consumer inherits the unfinished migration.

---

*Audit performed read-only on 2026-06-29. All paths and line ranges are as found on disk on that date. Repos: `C:\Users\brian\RUMAH\{delivery-os, rumah-admin, property-lead-os}`.*
