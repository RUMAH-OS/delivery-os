---
artifact: RUNTIME CONFLICT & LEGACY AUDIT (Master Migration Blueprint — final Discovery deliverable)
id: MMB-CONFLICT-AUDIT-v1
subject: Every existing component that could conflict with / bypass / duplicate / override / undermine the approved Runtime — classified SAFE or CONFLICT, with full conflict specification
date: 2026-06-28
reference (frozen, single source of truth — NOT changed here): docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1) + docs/reviews/RUNTIME-ARCHITECTURE-2026-06-28.md (RA-DOS-v1) + docs/migration/DISCOVERY-BLUEPRINT-2026-06-28.md
method: the Discovery Blueprint baseline (6 specialist inventories) + 2 grep-driven completeness passes (direct-LLM/execution-outside-engine/shadow-systems; config-overrides/deploy-shortcuts/conflicting-governance-memory-state-queue)
scope_guard: DISCOVERY ONLY. This audit IDENTIFIES and CLASSIFIES conflicts and assesses each conflict's removal-timing and coexistence-feasibility (the fields requested). It does NOT propose a migration plan, sequence, or redesign — that is the Master Migration Blueprint (the next phase). The Runtime is frozen.
---

# Runtime Conflict & Legacy Audit

> **Objective.** Guarantee that no hidden legacy behaviour survives the Runtime migration by identifying *every*
> existing component capable of conflicting with, bypassing, duplicating, overriding, or undermining the approved
> Runtime — and classifying each **SAFE** or **CONFLICT**. For every CONFLICT: *why · which Runtime principle it
> violates · migration risk · severity · when it should be removed · whether temporary coexistence is possible.*
> This is the final Discovery deliverable before the Master Migration Blueprint. **No migration is proposed here.**

---

## 0. Executive summary (one screen)

**The headline is an *adoption gap*, not a design gap.** The approved Runtime's core substrate **exists and runs
in production** (the rumah-admin durable engine = the Result Bus, the heartbeat tick, the goal/approval/agent-
result/seam APIs, jarvis Slack, the durable outbox, a clean locked ownership model). **But almost none of the
Runtime's *governance and discipline* layer is operationalized in the consumer repos**, and a large parallel
execution system runs entirely outside the engine. The conflicts cluster into six load-bearing findings:

1. **CONFLICT-01 (CRITICAL) — The PLOS discovery pipeline is a *second runtime*.** `discovery-sweep` /
   `runDiscovery` / `researchCompany` / `resolveContactsForLead` are a complete parallel execution model — own
   cron scheduler, own state machine (`lead.status`), own orchestrator, own *inline* agent execution
   (`providers.llm.createTurn`), own SerpAPI/Gmail/Playwright coordination — with **no `workflow_run`, no
   SKIP-LOCKED lease, no outbox emit.** This is the textbook "execution outside the approved Runtime."
2. **CONFLICT-02 (HIGH) — State-gated deploy (D7) is operationalized NOWHERE.** `.deploy-lane.json` +
   `deployment-auth.mjs` are template-only; every deploy is a **push-to-main / manual `vercel deploy` / ungated
   `db:migrate` shortcut**. The Runtime's deploy discipline is a dead mechanism in all consumers.
3. **CONFLICT-03 (HIGH) — A production-DB write bypass kill-switch exists** (`ALLOW_PROD_DB_WRITE=1`,
   rumah-admin `src/env.ts`) plus **hardcoded secrets in working-tree `.env` files** (both repos) — direct
   overrides of the fail-closed / secrets-in-platform-stores principles (a recorded incident class).
4. **CONFLICT-04 (HIGH) — Scheduling is fragmented and unmonitored.** 21 mechanisms, multiple autonomous Vercel
   crons, no unified tiered scheduler, **no external dead-man's-switch**, and PLOS's 4 crons exceed the Hobby cap.
5. **CONFLICT-05 (MEDIUM) — Fragmented sources of truth.** The engine is vendored in 3+ places; config is split
   across two registries + two validation layers; memory/knowledge is scattered (signals.jsonl, knowledge-
   inventory.jsonl, wikis, per-repo DECISIONS); capability registries are decentralized.
6. **CONFLICT-06 (LOW) — Dead/inert legacy paths** — the abandoned in-process `setTimeout` drain loop, inert
   flag-gated routes, the unwired tick relay, the install lag.

**What is genuinely SAFE (the foundation to build on, not remove):** the admin durable engine + outbox + tick +
seams; jarvis; the locked ECR ownership model; CODEOWNERS-bound author≠verifier (present at repo root); the
PLOS `LLMProvider` abstraction (a proto-I-Provider); the immutability guards / RLS / migrations (domain
correctness); rumah-website (near-static).

**Tally:** **~34 conflicts** across the categories (1 CRITICAL pipeline conflict + 5 grouped CRITICAL/HIGH
findings spanning many components, plus MEDIUM/LOW). **The single largest migration object is CONFLICT-01.**

---

## 1. Method, reconciliations, and the classification framework

**Evidence base:** the Discovery Blueprint (6 inventories) + 2 grep-driven completeness passes. **Two factual
corrections to the completeness passes (reconciled against the definitive inventories), so no search-miss
propagates:**
- The durable **transactional outbox IS LIVE in rumah-admin** (migrations 0009/0034; `src/events-api.ts`,
  `src/deliveries-api.ts`) — *not* "template-only." The conflict is that the *discovery pipeline doesn't use it*
  and the *PLOS-side drain/inbox* is the weaker link — not that the outbox is absent.
- **`CODEOWNERS` exists at the repo root of both PLOS and rumah-admin** (confirmed in the top-level listing) —
  *not* "not found." Author≠verifier (D9) is structurally present; the open question is whether the binding CI
  `verify-coverage` check is wired uniformly (it is template-only in delivery-os and not visibly present in
  PLOS's workflows).

**Classification:**
- **SAFE** = consistent with the approved Runtime (it *is* the Runtime, an approved seam, domain-correctness
  orthogonal to the Runtime, or a clean abstraction). **CONFLICT** = can execute/schedule/mutate/decide/override
  *outside* the approved model, or duplicates/undermines a Runtime concern.
- **Severity:** CRITICAL (undermines the Runtime's core guarantee) · HIGH · MEDIUM · LOW.
- **When to remove (timing class, not a plan):** **PRE-CUTOVER** (close before the Runtime goes authoritative) ·
  **AT-CUTOVER** (must not survive the switch) · **DURING** (migrate progressively) · **POST** (cleanup after
  core lands) · **ALREADY-INERT** (dead; delete anytime).
- **Coexistence:** **YES** (can run alongside the new Runtime during migration without undermining it) ·
  **CONDITIONAL** (only if fenced/flag-gated/monitored) · **NO** (undermines the Runtime if it survives the
  switch).

---

## 2. The CONFLICT register

*Ordered by severity. Each row carries the six requested fields. "When/Coexist" are audit assessments, not a plan.*

### 2.1 CONFLICT-01 — The PLOS discovery pipeline (a parallel execution runtime) **[CRITICAL]**
| | |
|---|---|
| **Components** | `apps/web/lib/discovery-sweep.ts` (orchestrator) · `discovery.ts` `runDiscovery` (seed, all-or-nothing 258–350) · `research.ts` `researchCompany` · `contact-intelligence.ts` `resolveContactsForLead` · the `/api/cron/discovery-{seed,sweep}` + `/api/discover` + `/api/research` routes |
| **Category** | execution-outside-the-Runtime · duplicate orchestration · conflicting state management · direct external/LLM calls |
| **Why** | A complete second execution model: its own cron scheduler, its own state machine (`lead.status: discovered→qualified→contacts_found→outreach_ready`), its own stage orchestrator with budget guards, its own *inline* agent tool-use loops calling `providers.llm.createTurn` + SerpAPI + Playwright — **none of it on the workflow engine** (no `workflow_run`/`workflow_step`, no SKIP-LOCKED lease, no outbox emit; idempotency is `lead.status`-guarded, not engine-CAS). |
| **Runtime principle violated** | "all execution flows through the durable Result Bus engine" (RS-DOS C11/§8); single durable state spine; the tiered scheduler (§7.5); verifier-owned observation / engine checkpointing |
| **Migration risk** | **HIGH** — it is the live lead-generation pipeline; porting its stages onto engine workflows (each stage a step; the seed as a checkpointed/long-lane run) is the single largest migration object. Risk of regressing discovery throughput or the all-or-nothing-persistence fix. |
| **Severity** | **CRITICAL** |
| **When to remove** | **DURING** (the central migration workstream — port stage-by-stage onto the engine) |
| **Coexistence** | **CONDITIONAL-YES** — it is **flag-gated and OFF by default** (`DISCOVERY_ENABLED`/`_SWEEP_ENABLED` false), isolated to PLOS, and low blast-radius; it can keep running during migration *provided* it is fenced (no new capabilities added to it) and the I-LegacyGuard treats it as the known second-runtime until ported. It must **NOT** be the authoritative path once the engine port lands. |

### 2.2 CONFLICT-02 — State-gated deploy (D7) operationalized nowhere; every deploy is a shortcut **[HIGH]**
| | |
|---|---|
| **Components** | `.deploy-lane.json` + `deployment-auth.mjs` + `deploy-lane.mjs` (delivery-os templates, **never instantiated** in any consumer) · PLOS `deploy.yml` (`push:main` → `vercel deploy --prebuilt --prod`) · admin Vercel Git-native deploy · ungated `db:migrate`/`db:seed`/`db:rollback` scripts |
| **Category** | deployment shortcut · runtime bypass · conflicting governance |
| **Why** | The Runtime authorizes deploys by SDLC *state* (verification + approvals + founder-review-if-applicable + CI green + lane scope). In reality, **a merge to main is the only gate**; SDLC state is never consulted; DB migrations (irreversible writes) run out-of-band via npm scripts. The D7 mechanism exists only as templates. |
| **Runtime principle violated** | D7 state-gated deployment (RS-DOS §11/§30; OM not-person-gated); fail-closed irreversible-action gating |
| **Migration risk** | **MEDIUM** — wiring D7 + a staging rung is *additive* (doesn't break the working push-deploy); risk is mainly process change + provisioning `.deploy-lane.json`/staging. |
| **Severity** | **HIGH** |
| **When to remove** | **PRE-CUTOVER** (the shortcut must be subordinated to D7 before the Runtime is authoritative) |
| **Coexistence** | **YES** — the current push-deploy can keep working while D7 is layered on top; at cutover, the state-gate becomes the required path and the bare push-shortcut is retired. |

### 2.3 CONFLICT-03 — Production-DB write bypass + hardcoded secrets in working trees **[HIGH]**
| | |
|---|---|
| **Components** | `rumah-admin/src/env.ts` **`ALLOW_PROD_DB_WRITE=1`** bypass (lines ~104–119) · hardcoded secrets in `property-lead-os/.env` + `rumah-admin/.env` (ANTHROPIC_API_KEY, DATABASE_URL, VERCEL_TOKEN, ADMIN_*/FOUNDER_ADMIN_TOKEN, MAILBOX_TOKEN_ENC_KEY) |
| **Category** | configuration override · runtime bypass · hidden feature flag |
| **Why** | `ALLOW_PROD_DB_WRITE=1` is an env-var **kill-switch that disables the fail-closed prod-DB guard** — a person-gated override of an irreversible-action protection (the exact pattern the prod-DB guard was created to prevent). Hardcoded secrets in `.env` files override platform-store config and are an exposure class (recorded incident). |
| **Runtime principle violated** | fail-closed on sensitive paths (§5/§6); secrets-in-platform-stores-never-trees (§30 security); single config source-of-truth |
| **Migration risk** | **LOW** to fix (rotate secrets → platform stores; lock/remove the bypass), but **HIGH** impact if it survives (a runtime bypass of the prod-write guard undermines the whole safety model). |
| **Severity** | **HIGH** |
| **When to remove** | **PRE-CUTOVER** (rotate + relocate secrets; remove/lock the bypass behind a non-routine, audited break-glass) |
| **Coexistence** | **NO** — a prod-write bypass and tree-resident prod secrets must not survive into the Runtime era; they directly contradict the security model. |

### 2.4 CONFLICT-04 — Fragmented, unmonitored scheduling (competing schedulers; no dead-man's-switch) **[HIGH]**
| | |
|---|---|
| **Components** | 5 live Vercel crons (PLOS discovery-seed/sweep/dunning/admin-drain + admin `/v1/heartbeat`) · 2 GHA cron templates · the abandoned in-process `setTimeout` loop · the inert `/api/cron/tick` relay · 4 heartbeat domain runners · **no external dead-man's-switch** · PLOS 4-crons-vs-Hobby-2-cap |
| **Category** | legacy schedulers · cron jobs · duplicate orchestration · competing schedulers |
| **Why** | The Runtime mandates one **tiered scheduler** (engine-step tick · PO-reconciler · Goal Supervisor · dead-man's-switch, each independent). Reality: ~6 autonomous, uncoordinated schedulers across two repos; the admin heartbeat is the closest to a unified driver but is **externally unmonitored** (if it goes silent, nothing alarms — RS-DOS C8 missing); PLOS's cron count exceeds the Hobby cap (→ ~24h drain latency). |
| **Runtime principle violated** | the tiered scheduler (§7.5); the dead-man's-switch (C8); no-competing-schedulers; liveness≠progress (the heartbeat is liveness, unmonitored for progress) |
| **Migration risk** | **MEDIUM** — consolidating onto the tiered model is progressive; the dead-man's-switch is additive; the Hobby cap is a platform decision. |
| **Severity** | **HIGH** (the missing dead-man's-switch + competing schedulers are the conditions the incident-class fears) |
| **When to remove** | **DURING** (consolidate to the tiered model) + **PRE-CUTOVER** for the dead-man's-switch (a safety addition) |
| **Coexistence** | **YES** — the existing crons are idempotent (SKIP-LOCKED) and can run during migration; they converge into the tiered scheduler progressively; the dead-man's-switch is added alongside. |

### 2.5 CONFLICT-05 — Fragmented sources of truth (engine, config, memory, registries) **[MEDIUM]**
| Sub-finding | Why / principle | Sev · When · Coexist |
|---|---|---|
| **Engine vendored in 3+ places** (delivery-os source · admin · PLOS · examples) | single-source-of-truth / I-Version; divergence risk (agent_runner differs by repo) — currently held by the CI drift gate | MED · DURING · **YES** (drift-gate holds it; consolidate to one canonical/installed engine) |
| **Two config registries + two validation layers** (PLOS Zod `env.ts` vs admin manual loader; two `config-registry.json`) | single config source-of-truth; a key required in one repo is optional in the other | MED · DURING · **YES** (consolidate to one schema+registry) |
| **Memory/knowledge scattered** (`signals.jsonl` · `knowledge-inventory.jsonl` · per-repo wikis · per-repo `DECISIONS.md` · capability manifests) | one-source-of-truth (§7); single memory model; no cross-repo lesson propagation | MED-LOW · POST · **YES** (consolidate to the 3-tier model + the signals corpus) |
| **Capability registries decentralized** (`capabilities/*.capability.json` per repo · `capability-catalog.json` · ecosystem markdown registries) | single capability registry; namespace-collision risk (e.g., "learning-review" could exist in multiple repos) | LOW · DURING · **YES** |
| **Half-duplex event seam** (Admin outbox→PLOS pull + PLOS→Admin delivery push) with PLOS-side `admin_event_inbox` drain | single durable event spine; the admin outbox IS durable, but the PLOS-side drain durability + the two-path coordination is the weak link (no saga) | MED · DURING · **YES** (at-least-once works; tighten during) |

### 2.6 CONFLICT-06 — Dead / inert / obsolete legacy paths **[LOW]**
| Component | Why / principle | Sev · When · Coexist |
|---|---|---|
| PLOS `instrumentation.ts` `setTimeout` admin-drain loop | execution-outside-runtime / no-in-process-daemon; **already dead** (`.unref()` inert on serverless) | LOW · ALREADY-INERT (delete anytime) · N/A |
| Inert flag-gated routes (discovery-seed/sweep when disabled), inert `/api/cron/tick` relay, `packages/queue` stub, vendored `discovery-os/` table ref | hidden/inert execution paths; built≠operating | LOW · POST · **YES** (inert; remove in cleanup) |
| delivery-os install lag (14/43 tools; `goal-progress` MISSING), inert framework tools (census-detector, file-lesson, capability/agent-health, milestone-report, uninstalled sibling-probe) | built≠operating; the Runtime depends on the missing tools | LOW-MED · DURING (build the missing; remove the inert) · **YES** |
| Obsolete reference (`rumah-admin/current-system/`, `reference/`), stray `.log`/`.stackdump` debris | dead code / debris | LOW · POST/ALREADY-INERT · N/A |
| Governance asymmetry (admin 26+ CI gates vs PLOS fewer; binding `verify-coverage` CI check not visibly wired in PLOS) | uniform author≠verifier binding gate (D9) — note: CODEOWNERS *is* present at both roots | MED · DURING · **YES** (standardize the gate set) |

---

## 3. The SAFE register (the foundation — do not remove)

*Classified SAFE: it IS the approved Runtime, an approved seam, a clean abstraction, or domain-correctness
orthogonal to the Runtime.*

| Component | Why SAFE |
|---|---|
| **rumah-admin durable engine** (run/step 7-state machine, SKIP-LOCKED tick, CAS lease, await-callback, completer; `.claude/os/engine/`) | **IS the approved Result Bus** (C11) — the migration generalizes it, never removes it |
| **`/v1/heartbeat` tick + 4 domain runners** | the approved engine-step tick (C13) + idempotent runners |
| **`/v1/goals` (deterministic selector) · `/v1/approvals` · `/v1/agent-results` · `/v1/events` (pull) · `/v1/deliveries` (callback)** | the approved goal-entry / human / agent-result / seam APIs |
| **Transactional outbox (admin)** | the approved durable event spine (LIVE) |
| **jarvis-slack-control-surface** | the approved C1 / I-Surface seed; sole Slack surface; clean HTTP boundary |
| **PLOS `LLMProvider` abstraction (`anthropic-llm.ts` behind a port)** | a proto-I-Provider — the abstraction is correct (the conflict is the *execution context*, not the abstraction) |
| **Locked ownership model (ECR-0003/0006/0007; one writer per entity)** | the approved single-owner model; no unresolved conflicts |
| **CODEOWNERS (both repo roots) + verify-gate (advisory local + CI binding template) + orchestrator.yml (read-only monitor)** | author≠verifier structurally present; verify-gate correctly demoted (D9); orchestrator never merges/deploys |
| **Immutability guards, RLS + rumah_app, 100 forward-only migrations, financial SoR, append-only audits** | domain correctness — orthogonal to the Runtime; the Runtime sits above them |
| **config-doctor + config-registry (per-repo, as a mechanism)** | the validation *tool* is sound (the conflict is the two-registries *split*, §2.5) |
| **rumah-website** | near-static; no cron/queue/engine/LLM; lead-intake email-only |
| **ecosystem-architecture registries (as governance docs)** | the ownership truth (the conflict is only that they're hand-maintained, not code-enforced) |

---

## 4. The master "executes outside the Runtime" list (the founder's core concern)

*Everything currently capable of executing / scheduling / mutating state OUTSIDE the approved engine:*
1. **The discovery pipeline** (sweep/seed/research/contacts) — the second runtime [CONFLICT-01, CRITICAL].
2. **Inline agent tool-use loops** (`providers.llm.createTurn` + SerpAPI/Playwright/Gmail) inside discovery —
   execution + external calls not engine-coordinated [part of 01].
3. **Out-of-band state mutation** — `lead.status` transitions + `agent_runs` logging not via engine lease/outbox
   [part of 01].
4. **Every Vercel cron** firing autonomously (discovery×2, dunning, admin-drain, heartbeat) — schedulers external
   to the engine [CONFLICT-04].
5. **Manual prod-mutating scripts** — `db:migrate`/`db:seed`/`db:rollback` (admin) [CONFLICT-02].
6. **The `ALLOW_PROD_DB_WRITE=1` bypass** — a direct prod-write path around the guard [CONFLICT-03].
7. **The abandoned in-process `setTimeout` loop** — dead but present [CONFLICT-06].
8. **Direct push/manual deploys** — `vercel deploy --prod` / push-to-main outside the state gate [CONFLICT-02].
*(Admin's domain runners, the heartbeat, and the engine itself are NOT in this list — they ARE the Runtime.)*

---

## 5. Coexistence matrix (can it run alongside the new Runtime during migration?)

| Coexistence | Components |
|---|---|
| **NO — must not survive the cutover** | `ALLOW_PROD_DB_WRITE=1` bypass · hardcoded tree secrets (CONFLICT-03) · the bare push-deploy shortcut *as the authoritative path* once D7 lands (CONFLICT-02) |
| **CONDITIONAL — only if fenced/monitored** | the discovery pipeline (flag-gated, fenced, treated as the known second-runtime until ported — CONFLICT-01) · the competing crons (idempotent, converge to the tiered model — CONFLICT-04, with the dead-man's-switch added) |
| **YES — safe alongside, migrate progressively** | the 3-vendored-engine + config/memory/registry consolidation (CONFLICT-05) · the inert/obsolete cleanup (CONFLICT-06) · D7 wired alongside the existing deploy |
| **ALREADY-INERT — delete anytime** | the `setTimeout` loop · the unwired tick relay · `packages/queue` stub · debris |

---

## 6. Closing — the guarantee, and the honest limit

This audit gives the migration the assurance it needs: **every existing component capable of conflicting with,
bypassing, duplicating, overriding, or undermining the approved Runtime has been identified and classified.** The
picture is clean to reason about: the Runtime's *engine* already exists and is SAFE; the conflicts are
concentrated in **(a) one large parallel execution system (the discovery pipeline), (b) the un-operationalized
deploy/governance discipline (D7, uniform gates, the dead-man's-switch), (c) two specific security overrides (the
prod-write bypass + tree secrets), and (d) fragmentation of the single-source-of-truth concerns (engine, config,
memory, registries, scheduling).** The dead/inert legacy is small and low-risk.

**The guarantee holds on one condition** that this audit makes explicit: **nothing executes outside the Runtime
once the cutover is authoritative** — which means CONFLICT-01 (the discovery second-runtime) is ported or fenced,
CONFLICT-02/03 (the deploy shortcuts + the prod-write bypass) are closed, and the I-LegacyGuard capability
(RS-DOS §52) is built to *standingly detect* any of these patterns re-appearing.

**Honest limit (Discovery scope):** this audit classifies and assesses *removal-timing* and *coexistence* per the
request, but it does **not** sequence or design the removals — that is the Master Migration Blueprint. Five
factual discrepancies from the Discovery Blueprint (§6 there: PLOS host, admin inheritance, jarvis deploy host,
`goal-progress` unbuilt, PLOS engine-copy currency) remain to be confirmed and bear on a few classifications
(e.g., where the discovery pipeline and jarvis actually run).

*End of the Runtime Conflict & Legacy Audit. It changes no code and proposes no migration. With the Discovery
Blueprint, it completes Phase 1 (Discovery) of the Master Migration Blueprint.*
