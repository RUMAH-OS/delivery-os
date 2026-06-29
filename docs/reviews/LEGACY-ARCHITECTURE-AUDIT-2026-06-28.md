---
artifact: LEGACY-ARCHITECTURE-AUDIT
id: LAA-OM-v2
subject: Complete legacy-architecture audit before finalizing Operating Model v2 — what conflicts, duplicates, overrides, or weakens the new model; what to preserve / migrate / refactor / isolate / remove; and the safe migration to single source-of-truth · orchestration · governance · execution · deployment models
date: 2026-06-28
status: audit (design-only; recommends dispositions + a safe migration strategy; implements nothing)
evidence_base:
  - two full on-disk inventory passes (orchestration/execution/governance/capabilities ≈88 components; deployment/CI/config/env/flags/cron)
  - docs/reviews/ADR-OPERATING-MODEL-V2-2026-06-28.md (OBW-GS/c) + docs/reviews/INVESTIGATION-OM-v2-three-proposals-2026-06-28.md (PO-reconciler · reflection backstop · Slack-first)
  - core/GOVERNANCE.md · DECISIONS.md · capabilities/* · templates/* · .claude/* · sibling repos (rumah-admin, property-lead-os, jarvis-slack-control-surface)
scope_guard: Design only. The objective is the cleanest, simplest, most scalable AI-native architecture — NOT backwards-compatibility at all costs. Legacy that no longer creates measurable value is retired. No code is changed here.
---

# Legacy Architecture Audit — before Operating Model v2 becomes the foundation

> **The headline finding.** Operating Model v2 is **not a greenfield replacement competing with a pile of
> legacy.** The canonical "single models" it wants **already exist on disk and are the intended targets** — one
> execution model (the P1–P4 Result Bus), one deployment model (state-gated `deployment-auth` + lane), one
> governance model (`GOVERNANCE.md` §1–16 + `DECISIONS.md`), one goal/orchestration contract
> (`GOAL-EXECUTION-CONTRACT` + `boundary-classify` + `dispatch-route`). The legacy *problem* is therefore not
> *competing architectures* but four cheaper, more dangerous classes: **(1) drift / self-install lag** (the
> framework dogfoods stale copies — `.claude/` holds 12 of 54 tools; the binding hook is a day stale; the
> goal-execution tools aren't installed), **(2) inert scaffolding** (built-but-never-invoked tools — the exact
> "built ≠ operating" debt the OS keeps re-learning), **(3) dead/abandoned code and obsolete flags/fields**
> (the Vercel-broken `setTimeout` loop; `DISCOVERY_SEED_INTERVAL_HOURS`; the `ratified.by` pre-signature
> field), and **(4) scattered config truth** (three planes, no single source). Retire those, formalize the one
> tick that already runs, and the architecture *is* single-model. The work is **consolidation and cleanup, not
> redesign.**

---

## 0. Executive summary (one screen)

- **No hidden or competing deployment paths exist.** Exactly three lanes (dev-preview · prod-deploy · manual
  migrations), all feeding the one state-gated `deployment-auth` engine. The single deployment model is *built
  and proven* — the only gaps are (a) Supabase migrations not yet state-gated and (b) config secrets/lane
  policy not yet provisioned in consumers (a process/FAP item, not an architecture conflict).
- **No competing execution/orchestration *engines* exist** — but several **overlapping design documents** do.
  `DELIVERY-OS-EXECUTION-MODEL-V1` is canonical; `WORKFLOW-ENGINE-V1-BOARD-REVIEW` and
  `MAILBOX-INTELLIGENCE-MULTIAGENT-V1` are *cited derivations*; `WORKFLOW-ENGINE-OWNERSHIP-BOUNDARY-REVIEW` is
  *superseded*; the `AUTO-EXEC-CRITERIA` ↔ `V6-LANDED-DEFINITION` contradiction is *reconciled* by
  `AUTONOMOUS-EXECUTION-DEFINITION`. These need **archival/derivation-labelling**, not deletion.
- **The #1 risk is self-install lag**, not legacy logic. The framework's own `.claude/` runs old copies of its
  own kernel — `goal-init`/`goal-stop`/`boundary-classify`/`sibling-probe` are *not installed*, and
  `verify-gate.mjs` is a day behind. The new OM depends on the latest hooks; **drift is a silent correctness
  hazard and must be closed first.**
- **One real heartbeat already runs** (`rumah-admin /v1/heartbeat`, Vercel cron, every 5 min — the durable
  engine tick). This is the *proven existence* of the tick the new model formalizes — **PRESERVE + formalize**,
  not legacy to remove. The PLOS discovery-seed/admin-drain routes are **inert** (no `vercel.json`).
- **Genuine retirements (measurable-value test fails):** the abandoned `setTimeout` drain loop (dead code,
  Vercel-broken); `DISCOVERY_SEED_INTERVAL_HOURS` (Design-A made it moot); the `ratified.by` per-deploy
  signature field (D7 replaced it with state-auth); the **wiki** (F6, zero pages); the **inert
  census-detector / file-lesson** (wire or remove); superseded design docs (archive).
- **The one architectural decision the audit forces:** unify the *three* legitimate scheduled loops the new
  model needs into **one coherent tiered scheduling story** — the **engine-step tick** (advances durable runs),
  the **PO-reconciler** (drives goals), the **Goal Supervisor + its dead-man's-switch** (governs goal-delta) —
  each independent, each on the right platform — so they are *one orchestration model at three levels*, never
  three competing crons.

---

## 1. The five "single models" — what converges, what is canonical, what retires

The mandate requires a single source of truth, a single orchestration model, a single governance model, a
single execution model, and a single deployment model. For each: the **canonical** component (already on disk),
what **converges into it**, and what **retires**.

### 1.1 Single EXECUTION model → the P1–P4 Result Bus
- **Canonical:** `capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md` (the durable run/step machine + the one
  block-on-correlation await + the one callback completer). Built & proven (27 files byte-identical across
  Admin+PLOS). This is the durable STATE spine the whole OM v2 sits on (and exactly what the prior-art
  investigation prescribed).
- **Converges (label as cited derivations, stop maintaining in parallel):** `WORKFLOW-ENGINE-V1-BOARD-REVIEW`,
  `MAILBOX-INTELLIGENCE-MULTIAGENT-V1`.
- **Defer-not-build:** `EXECUTION-ENGINE-DESIGN.md` (speculative substrate detail; founder-gated; build only
  on proven need).
- **Retire/refactor:** the **abandoned `setTimeout` drain loop** (`property-lead-os/.../instrumentation.ts`) —
  dead, Vercel-broken (Design D2 abandoned it); **REMOVE** so it cannot be accidentally re-introduced.

### 1.2 Single ORCHESTRATION model → durable state + tiered, independent reconcile loops
- **Canonical state:** the Result Bus + the H9 goal-state (`goal-init`/`goal-stop` built) + the M1 metric
  ledger (`goal-progress.mjs` **designed but MISSING from disk — must ship**).
- **Canonical routing:** `dispatch-route.mjs` (planner, G9-clean: plans, never spawns) + `dispatch-log.jsonl`.
- **The three loops that must be unified into one tiered model (not three competing crons):**
  1. **Engine-step tick** — advances ready durable steps. *Already real:* `rumah-admin /v1/heartbeat` (Vercel
     cron, every 5 min). **PRESERVE + formalize.**
  2. **PO-reconciler** — level-triggered, drives goals (launch workers · collect *verified* progress · interrupt
     stalls · re-prioritize · validate *movement*). *New (investigation M2);* GitHub Actions cron.
  3. **Goal Supervisor + dead-man's-switch** — independently judges goal-delta (halt→summon); the dead-man's-
     switch on a *different* failure domain. *New (ADR §5 + C3).*
- **Retire:** the inert PLOS discovery-seed/admin-drain routes stay as code but must be **scheduled-or-removed**
  (no `vercel.json` today — they are neither operating nor decommissioned, the worst "built ≠ operating"
  state); the **inert `progress-stall.mjs`** detector is **wired into the PO-reconciler/GS** (it is the
  no-progress primitive) rather than left uninvoked.

### 1.3 Single GOVERNANCE model → GOVERNANCE.md §1–16 + DECISIONS.md
- **Canonical:** `core/GOVERNANCE.md` (§1–16) · `core/OPERATING-LOOP.md` · `core/DEFINITION-OF-DONE.md` ·
  `core/SEVERITY-AND-ESCALATION.md` · `DECISIONS.md` (D1–D10). All inherited by every project. **PRESERVE.**
- **The binding enforcement is server-side (D9):** required CI `verify-coverage` + branch protection +
  CODEOWNERS. The **local `verify-gate` hook is the honest advisory (D9)** — its docstring must say so (a
  recorded conflict: tooling that assumes the local hook *blocks* = false safety).
- **Converges (make complementary, not competing):** the two L2 triggers — `learning-trigger.mjs` (fires on
  *content* — architectural/capability/framework markers) and `review-trigger.mjs` (fires on *form* — review
  artifacts / N-merge≥30 backstop). They are complementary; state precedence explicitly in both docstrings.
- **Retire/decide:** `DECISIONS.md` D3 (Class-A auto-merge) and D4 (dev-branch collapse) are **DEFERRED** — the
  investigation and ADR both touch auto-merge; keep them deferred to their **own §11 decisions** (do not let OM
  v2 silently adopt them).

### 1.4 Single DEPLOYMENT model → state-gated authorization + one lane
- **Canonical (built & proven):** `deployment-auth.mjs` (state-gated, D7 — authorizes by SDLC state, never a
  per-deploy signature) + `deploy-lane.mjs` (audited wrapper) + `.deploy-lane.json` (policy + FREEZE
  kill-switch) + the workflows `promote-to-prod.yml` (C6 gate) · `dev-preview.yml` · `verify-coverage.yml` ·
  `hook-path-integrity.yml`. **No competing paths.** **PRESERVE.**
- **The ladder (local → QA → staging → prod)** from OBW-GS/c §10 maps onto this; the audit confirms **staging
  is the missing rung** in the live consumers (today: local → prod-via-`push[main]`).
- **Converges:** bring **Supabase migrations into the lane** (a `supabase-migrate-forward` action class with a
  state-gated signal + audit) — today they are *manual, un-audited, not state-gated* (the single-deployment
  gap, and the 0035/0029/0032 migration-parity incident class).
- **Retire:** the **`ratified.by`/`ratified.date` per-deploy signature field** (D7 superseded it — REMOVE from
  docs/template after a one-release deprecation note); any consumer assumption of a manual/shadow deploy path
  (none found — confirm none is added).

### 1.5 Single SOURCE OF TRUTH → derived-not-stored + one registry per concern
- **Canonical doctrine:** Governance §7 (one source per concern; peer-consumed facts are *derived/generated,
  never hand-maintained*; LAW vs STATE split; `DECISIONS.md` for decisions).
- **The real gap — config truth is SCATTERED across three planes:** (a) Vercel project env (authoritative for
  prod), (b) per-repo `config-registry.json` (declared schema), (c) per-app `env.ts` zod. **Converge:** publish
  the registry **schema + template from delivery-os**; `config-doctor` reads flags/keys *from the registry*;
  CI cross-checks the three planes agree. One declared source; the platform is the value store; the zod schema
  is generated from the registry, not hand-kept.
- **Retire:** scattered/duplicated declarations once the single registry is the source; the **wiki** (F6 —
  zero pages; remove all `wiki/`-path references); **hand-maintained derived sections** (already a fail-closed
  drift-lint — keep enforcing).

---

## 2. Disposition register (preserve · migrate · refactor · isolate · remove)

The full ≈88-component inventory is the evidence base; this register lists the load-bearing dispositions and
every **non-PRESERVE** call (the things that actually change).

### 2.1 PRESERVE (canonical to the new OM — do not touch except to formalize)
Result Bus / `DELIVERY-OS-EXECUTION-MODEL-V1`; `GOAL-EXECUTION-CONTRACT` + `goal-init`/`goal-stop`/
`boundary-classify`; `dispatch-route` + `dispatch-log` + `agent-route` + `skill-route` + `knowledge-route`
(G9 C2 injection-firewall intact); `deployment-auth` + `deploy-lane` + `.deploy-lane.json` + the 6 workflow
templates; `GOVERNANCE.md` §1–16 + `DECISIONS.md` + `OPERATING-LOOP` + `DoD` + `SEVERITY`; `config-doctor` +
`platform-health` + `rollback-helper` + `post-deploy-verify` (Admin-proven; **MIGRATE to PLOS**);
`verify-fingerprint` (D8) + the CI `verify-coverage` binding gate (D9); `learning-review` capability +
`learning-trigger`/`review-trigger`/`learning-classify`/`founder-learning-package`; `change-classify` (D6) +
`founder-burden-gate`; `seam-gate`/`lifecycle-gate`/`workflow-gate` (Admin-proven; **MIGRATE to PLOS**);
`os-inherit`/`os-sync` + `ENGINE-OWNERSHIP-GOVERNANCE` drift lock; the **`rumah-admin /v1/heartbeat`** engine
tick; the **`jarvis-slack-control-surface`** seed (the Slack-first surface — investigation M5); the spend-gate
feature flags (`DISCOVERY_ENABLED`/`_SWEEP_ENABLED`/`_SEED_ENABLED`, `A2_DAILY_SPEND_CAP_EUR`) and the
`freeze.frozen` kill-switch.

### 2.2 MIGRATE (re-home / re-install / propagate — no logic change)
| Component | From → To | Why |
|---|---|---|
| **Self-install lag — the whole `.claude/` tree** | `templates/{tools,hooks}` → `.claude/{tools,hooks}` | **12 of 54 tools installed; `goal-init`/`goal-stop`/`boundary-classify`/`sibling-probe` missing; `verify-gate` a day stale.** The framework runs old copies of its own kernel. **Highest-priority migration.** |
| **`goal-progress.mjs` (M1 ledger)** | designed/manifest → **build + install** | Missing from disk; the PO-reconciler/GS *read* it; the OM v2 core depends on it (ADR §19.5 step 1). |
| **Admin-proven gates → PLOS** | `seam-gate`/`lifecycle-gate`/`workflow-gate`/`config-doctor`/`platform-health`/`rollback-helper`/`post-deploy-verify` | Proven in Admin; PLOS inheritance pending (Pillar-2 propagation). |
| **`.deploy-lane.json` policy + config secrets** | template → consumer repos + Vercel | Required by the single deployment model; today a FAP item (process, not architecture). |
| **Supabase migrations** | manual → into `deploy-lane` (`supabase-migrate-forward` action class, state-gated, audited) | Closes the un-gated-migration gap + the migration-parity incident class. |

### 2.3 REFACTOR (keep the function, change the form)
| Component | Refactor | Why |
|---|---|---|
| **The three scheduled loops** | unify into **one tiered scheduling model** (engine-step tick · PO-reconciler · GS+dead-man's-switch), each independent, documented in one `docs/scheduling.md` | Prevent three competing crons; make it *one orchestration model at three levels*. |
| **`progress-stall.mjs`** | wire into the PO-reconciler/GS as the no-progress primitive | It is built but **inert**; the new model needs exactly this signal. |
| **Config truth** | one registry as source; generate `env.ts` zod from it; CI cross-checks the three planes | Collapse the scattered config (§1.5). |
| **Local `verify-gate` docstring + any tooling assuming it blocks** | state "advisory only — binding gate is CI (D9)" | Recorded false-safety conflict. |
| **`learning-trigger` vs `review-trigger` docstrings** | state the content-vs-form split + precedence | They overlap on "significant change"; make complementary explicit. |

### 2.4 ISOLATE (keep, but fence so it cannot weaken the new model)
| Component | Isolate how | Why |
|---|---|---|
| **Inert PLOS routes (discovery-seed, admin-drain)** | gate behind the existing feature flags (already default-OFF) **and** a `vercel.json` that either schedules them *or* explicitly documents them as inert | They are neither operating nor decommissioned — the worst "built ≠ operating" limbo; isolate until the founder schedules (needs Vercel PRO) or they are removed. |
| **`EXECUTION-ENGINE-DESIGN` + the speculative engine substrate** | design-reference only; build-gated behind proven need | Largest over-build risk (the OS's own §9 readiness flag). |
| **D3 (auto-merge) / D4 (dev-collapse)** | keep DEFERRED to their own §11 decisions | Must not be silently adopted by OM v2 (investigation/ADR both reject the bundled adoption). |

### 2.5 REMOVE (measurable-value test fails — retire before OM v2 lands)
| Component | Why it fails the value test |
|---|---|
| **`setTimeout` drain loop** (`property-lead-os/.../instrumentation.ts`) | Dead code; Vercel-broken; superseded by the cron route (Design D2). Risk of accidental re-introduction. |
| **`DISCOVERY_SEED_INTERVAL_HOURS`** flag | Design-A's dedicated cron made it moot; no code reads it. |
| **`ratified.by`/`ratified.date`/`ratified.decision_ref`** deploy-lane field | D7 replaced per-deploy signature with state-auth; honor for one deprecation release, then remove. |
| **The wiki layer** (F6) | Zero pages across 57+ slices; knowledge routes elsewhere. Remove `wiki/`-path references. |
| **`census-detector` / `file-lesson`** (inert) | Built, never invoked — scaffolding debt. **Wire into `learning-review` OR remove.** (Don't leave inert — it is the precise "built ≠ operating" anti-pattern the OS keeps re-learning.) |
| **Superseded design docs** | `WORKFLOW-ENGINE-OWNERSHIP-BOUNDARY-REVIEW` (→ archive; FINAL-MIGRATION-PLAN supersedes); `WORKFLOW-ENGINE-ROLLOUT-READINESS-2026-06-22` (dated snapshot → archive). |

---

## 3. Competing / duplicate / hidden behavior — resolved

| # | Apparent competition | Reality | Resolution |
|---|---|---|---|
| 1 | Three execution-engine docs | One canonical (`EXECUTION-MODEL-V1`) + two cited derivations | Label derivations; all edits feed the canonical; archive nothing (history). |
| 2 | Two workflow-engine ownership plans | One superseded | Archive the BOUNDARY-REVIEW; FINAL-MIGRATION-PLAN is canonical (DOS owns the engine; apps are installers). |
| 3 | `AUTO-EXEC-CRITERIA` vs `V6-LANDED-DEFINITION` | Reconciled | `AUTONOMOUS-EXECUTION-DEFINITION` is the authoritative clarification (automation ≠ autonomy; AI-OS noun unearned until D/F/H/J). Cross-link so neither is read alone. |
| 4 | Two L2 governance triggers | Complementary (content vs form) | Docstring the split + precedence. |
| 5 | Three scheduling planes (GitHub crons · Vercel crons · the abandoned `setTimeout`) | One real tick (`/v1/heartbeat`), governance crons, dead code | Unify into the tiered model (§1.2); remove the dead loop; isolate the inert routes. |
| 6 | Founder-approval checked in **both** `promote-to-prod.yml` and `deployment-auth` (`class_c`) | Defensive duplication, not competing | `deployment-auth` is the truth; the workflow re-check is a fail-closed belt-and-suspenders — keep, but document `deployment-auth` as authoritative. |
| 7 | Config truth in three planes | Genuine scatter | Single registry as source (§1.5). |
| **No** hidden/shadow deploy paths, no parallel governance engines, no second orchestrator were found. | | | The architecture is *more* unified than feared. |

---

## 4. Technical debt, obsolete capabilities, unused infrastructure, historical decisions

- **Self-install lag (operational debt, highest severity):** the framework dogfoods stale `.claude/` copies; the
  drift mechanism exists but does not auto-remediate. → **Add continuous drift-check + auto-reinstall** (or
  extend `os-inherit` to the `.claude/` tree, sha-pinned). *This is the single most important pre-cutover fix.*
- **Built-but-inert (the recurring OS anti-pattern):** `census-detector`, `file-lesson`, `progress-stall`
  (wire-or-remove), the unscheduled PLOS cron routes (schedule-or-remove). → enforce a **built-≠-operating
  gate** (OM v2 AN-10): a capability is not "done" while no mechanism fires it.
- **Coverage gaps:** **dispatch coverage ~19% vs ≥90% target** (verify/review/cleanup bypass `dispatch-route`)
  → route all substantive work through dispatch; the **missing founder single-screen surface** (V6 Pillar-3)
  → this is *exactly what the Slack-first surface (investigation M5) delivers* — the audit and the investigation
  converge here.
- **Dead code / obsolete flags:** the `setTimeout` loop; `DISCOVERY_SEED_INTERVAL_HOURS`; `ratified.by`.
- **Historical decisions to retire/settle:** wiki (retire, F6); D3/D4 (settle in their own §11, do not bundle);
  the speculative engine substrate (gate behind proven need).
- **Secrets hygiene (carried from the incident record):** production secrets must live in platform stores, never
  working-tree `.env`; rotate any chat-exposed secrets. (Not new debt to *create* — debt to *finish closing*.)

---

## 5. Safe migration strategy (eliminate legacy without breaking functionality)

The migration applies the framework's own **expand/contract** discipline (ADR C10) **to itself**: add the new
canonical path, prove it, *then* remove the legacy — never a flip-the-switch cutover. Sequenced, non-breaking,
each step independently verifiable (author≠verifier).

**Phase 0 — Stop the drift (prerequisite; nothing else is trustworthy until this holds).**
- Re-install `.claude/{tools,hooks}` from `templates/` to current; install the missing kernel tools
  (`goal-init`/`goal-stop`/`boundary-classify`/`sibling-probe`); reconcile the stale `verify-gate`. Add a
  **continuous drift-check + auto-remediation** so the framework can never again dogfood stale copies.
- *Non-breaking:* re-installing current tools only *strengthens* gates; nothing depends on the old copies.

**Phase 1 — Make the canonical single-models authoritative on paper (zero code).**
- Label the derivation docs; archive the superseded plans; cross-link the reconciled autonomy docs; docstring
  the verify-gate-is-advisory (D9) and the two-trigger split. *Pure documentation; cannot break anything.*

**Phase 2 — Ship the missing core (the OM v2 proven-need core; ADR §19.5 + investigation M-series).**
- Build+install `goal-progress.mjs` (M1 ledger). Wire `progress-stall.mjs` into the new loops. Build the
  **PO-reconciler** (level-triggered, on GitHub Actions cron, independent of the GS) and the **GS +
  dead-man's-switch** (different failure domain). Formalize the existing `/v1/heartbeat` engine tick into the
  tiered scheduling model. *Additive — runs alongside the existing event-driven behavior; the reconciler
  self-heals missed events the old path dropped, so it can only improve liveness.*

**Phase 3 — Consolidate config + deployment to the single source.**
- Publish the config-registry schema+template from delivery-os; generate `env.ts` from it; CI cross-checks the
  three planes. Bring Supabase migrations into the lane (expand/contract migrations only). Add the **staging
  rung** to the consumers. *Each is add-then-verify; the existing config-doctor stays the gate throughout.*

**Phase 4 — Validate the model in real operation (Slack-first; investigation M5/M6).**
- Promote the `jarvis` Slack seed into the founder surface (summon-with-evidence + approvals + status), under
  the ChatOps conditions. This is *also* the missing V6 Pillar-3 single-screen surface — one build closes two
  gaps. *Thin transport over the existing goal API; no model logic in Slack.*

**Phase 5 — Contract (remove legacy) only after the new path is proven.**
- Remove the `setTimeout` loop, `DISCOVERY_SEED_INTERVAL_HOURS`, `ratified.by` (after its one-release
  deprecation), the wiki references; schedule-or-remove the inert PLOS routes; wire-or-remove
  `census-detector`/`file-lesson`. *Each removal follows a proven replacement — contract after expand.*

**Rollback posture (per item):** every phase is independently revertible — Phase 0 reinstalls are forward-only-
safe (old copies were strictly weaker); Phases 2–4 are additive (disable the new loop → fall back to the
existing event-driven behavior); Phase 5 removals happen only after the replacement is verified in prod, so a
removal's rollback is "re-add the dead code," never "restore lost function."

---

## 6. The single-model end state (what "done" looks like)

| Concern | Single model (canonical) | Legacy retired / converged |
|---|---|---|
| **Source of truth** | one config registry (schema+template from DOS) · derived-not-stored peer facts · `DECISIONS.md` for decisions · the Result Bus for execution state | scattered 3-plane config · wiki · hand-maintained derived sections |
| **Orchestration** | durable state + **three independent tiered loops** (engine tick · PO-reconciler · GS+dead-man's-switch) · `dispatch-route` plans all work | the abandoned `setTimeout`; competing/ad-hoc crons; unrouted work (the 19%→90% coverage close) |
| **Governance** | `GOVERNANCE.md` §1–16 + `DECISIONS.md`; binding gate in CI (D9); §11 panels; learning triggers | local-hook-as-binding false safety; the AUTO-EXEC/V6-LANDED contradiction |
| **Execution** | the P1–P4 Result Bus | parallel engine design docs (→ derivations); the speculative substrate (→ gated) |
| **Deployment** | state-gated `deployment-auth` + one lane + local→QA→**staging**→prod + expand/contract migrations | per-deploy `ratified.by`; manual un-gated migrations; missing staging rung |

When Phases 0–5 hold, the architecture has **one** of each — with **no competing or hidden legacy behavior**,
no built-but-inert scaffolding, and no stale self-installed copies — and OM v2 (OBW-GS/c + the PO-reconciler +
the Slack surface) is the foundation, not a layer over a legacy substrate.

---

## 7. Honest limits & open items for the design-detail phase
- The audit is **disk-grounded** but the engine/tool internals were inventoried at the design/contract level,
  not line-audited for behavior; Phase-2 build must re-verify each wired tool author≠verifier.
- The **tiered-scheduling unification** (engine tick vs PO-reconciler vs GS) needs a precise ownership/cadence
  spec in the design-detail phase (which loop owns which state transition; the platform per loop; the
  dead-man's-switch domain) — flagged, not designed here.
- **Vercel PRO** is a prerequisite for sub-daily crons in the consumers (a founder/process item).
- Whether `census-detector`/`file-lesson` are **wired or removed** is a small judgment for the learning-loop
  owner — the audit's requirement is only that they not remain *inert*.

*End of audit. It changes no code. It classifies every component, resolves the apparent competitions, names the
genuine retirements, and sequences a non-breaking expand-then-contract migration to one source-of-truth, one
orchestration, one governance, one execution, and one deployment model.*
