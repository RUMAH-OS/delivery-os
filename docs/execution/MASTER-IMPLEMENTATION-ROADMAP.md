---
artifact: MASTER IMPLEMENTATION ROADMAP — Sprint 1.0 → the AI-native Operating System
id: MASTER-ROADMAP-v1
date: 2026-06-29
role: the PRIMARY PROGRESS OVERVIEW (the whole journey, dependencies, DoD, effort, capabilities unlocked). The live sprint-by-sprint board with full 16-field detail + statuses is `IMPLEMENTATION-TRACKER.md`.
authoritative inputs (frozen): RA-DOS-v1 · RS-DOS-v1 (+§57) · DISCOVERY-BLUEPRINT · RUNTIME-CONFLICT-LEGACY-AUDIT · MASTER-MIGRATION-BLUEPRINT · DEV-RELEASE-BLUEPRINT.
legend: ✅ done · 🔵 in progress · 🔶 founder review · ⏸ held (founder go) · ⚪ not started · ★ founder checkpoint · effort = complexity 1–10 (build difficulty)
---

# Master Implementation Roadmap

> **The destination:** an AI-native Operating System where a goal goes in (Slack), a durable runtime plans it,
> spawns ephemeral agents, supervises progress from *outside* the loop, halts-and-summons the founder only at real
> boundaries, and delivers the *objective* — with nothing executing outside the Runtime, and the founder's time
> spent only on irreducible decisions. **The engine already runs in production; we are building the governance,
> the goal-supervision organs, and the unification on top.**

## 0. The journey in one picture
```
 SAFETY FLOOR        DEPLOY/WATCHDOG     GOAL GOVERNANCE      EXECUTION UNIFICATION     PANEL-GATED AUTONOMY
 (Phase 1)           (Phase 2)           (Phase 3)            (Phase 4)                 (Phase 5)
 ┌───────────────┐   ┌──────────────┐    ┌──────────────┐     ┌──────────────────┐     ┌────────────────────┐
 │1.0 floor ✅   │   │2.1 D7 deploy │    │3.1 pre-flight│     │4.1 I-LegacyGuard │     │5.1 Sprint Engine ★ │
 │1.1 secrets ⏸ │──▶│2.2 staging   │──▶ │3.2 Goal Super│──▶  │4.2-4.6 port      │──▶  │5.2 PO auto-loop  ★ │
 │1.2 registry🔵│   │2.3 dead-man  │    │3.3 reconciler│     │  discovery       │     │5.3 Slack surface ★ │
 │1.3 readiness │   │2.4 scheduler★│    │3.4 PO-mind   │     │4.7 cutover ★     │     └────────────────────┘
 │1.4 stores 🔵 │   └──────────────┘    │3.5 summon    │     │4.8 consolidate   │              │
 │1.5 metricprobe│          ▲           └──────────────┘     │4.9 retire        │              ▼
 │1.6 goalcontract│         │                  ▲             └──────────────────┘     THE AI-NATIVE OS
 └───────────────┘   [V-H headless spike 🔶 — gates all P3/P5 autonomy; runs early]
   = the substrate        = irreversible-     = the missing        = nothing executes        = unattended,
     + the merge floor      action gates         organs               outside the Runtime       founder-at-boundaries
```
**Forced critical path:** `1.0 → 1.4 → 1.5 → 3.1 → 3.2 → 3.3` (engine → stores → metric-probe → pre-flight → supervisor → reconciler). Everything else parallels around it.

## 1. Where we are now (2026-06-29)
- ✅ **All architecture + planning frozen** (6 blueprints). ✅ **Sprint 1.0** functionally complete — the **author≠verifier merge floor is LIVE and PROVEN** across all 5 repos (Action 5 / prod-Environment carried, pending a GitHub billing entitlement).
- 🔵 **Sprint 1.2 + 1.4 building now** (parallel). ⏸ **1.1 held** for founder go (touches live prod auth). 🔶 **V-H spike** = GO-WITH-CONDITIONS (mechanism proven; serverless host unproven → autonomy host = a worker/queue).
- **Capability unlocked so far:** *governed change* — no code reaches any `main` without independent verification + a non-author approval; the migration now governs itself (the §12 gate already caught an unverified change).

---

## 2. PHASE 1 — Foundation & Safety Floor  ·  *make the ecosystem safe to build on; lay the durable substrate*
**Phase milestone capability:** the Runtime can be built on safely — secrets are caged, config readiness is known, the durable stores exist. **Effort: M–L · DoD closed: DoD-1, DoD-10, §57, the security floor.**

| Sprint | Title | Deps | Eff | DoD clause closed | **Capability unlocked** | Status |
|---|---|---|---|---|---|---|
| **1.0** | Identity & Governance Binding | — | 3 | every repo protected; self-merge blocked | **mechanical author≠verifier merge floor** | ✅ |
| **1.1 ★** | Secrets → platform stores + break-glass | 1.0 | 5 | secrets-in-platform-stores; no standing bypass | **no tree secrets; audited single-use prod-write break-glass** | ⏸ |
| **1.2** | Single config/secret registry + I-Config oracle | 1.0 | 4 | single config source-of-truth | **one config truth; the Runtime can SEE readiness (PRESENT/MISSING/INVALID/DRIFTED)** | 🔵 |
| **1.3** | Capability requirements + readiness SHADOW gate + I-LegacyGuard config detections | 1.2 | 4 | §57 readiness known (shadow) | **the Runtime KNOWS which capability needs which config/secret + detects tree-secrets/bypass/drift** | ⚪ |
| **1.4** | Five durable stores (C12) + CI migration runner | 1.0 | 6 | DoD-10 durable stores | **the durable substrate: goal-delta ledger · breaker · idempotency · dead-letter · cost; safe CI migrations** | 🔵 |
| **1.5** | MetricProbe + goal-progress | 1.4 | 5 | (feeds DoD-2/3) | **external metric re-probe — the Goal Supervisor's independent eyes** | ⚪ |
| **1.6** | GoalContract durable state (C2-STATE) | 1.4 | 4 | (feeds C2) | **the durable goal-accountability record (objective + acceptance + budget + state)** | ⚪ |
| **V-H ★** | [VALIDATE] headless-Claude unattended spawn | parallel | 5 | empirical go/no-go | **proof the spawner runs unattended — gates ALL P3/P5 autonomy; sets the host = worker/queue** | 🔶 |

---

## 3. PHASE 2 — Deploy Discipline & Scheduler Safety  ·  *gate the irreversible before any organ acts*
**Phase milestone capability:** every prod deploy is state-gated + reversible, and a watchdog guarantees the runtime can't go silently dead. **Effort: M · DoD closed: DoD-5, DoD-6, the liveness watchdog. (Hard gate: 2.1+2.3 precede all P3 acting organs.)**

| Sprint | Title | Deps | Eff | DoD clause closed | **Capability unlocked** | Status |
|---|---|---|---|---|---|---|
| **2.1 ★** | D7 state-gated deploy (audit→enforce) | P1 | 5 | DoD-5 prod-never-first (gate) | **production deploys require SDLC-state + founder authorization (no un-gated deploy)** | ⚪ |
| **2.2** | One admin staging + parity + health gate + canary | 2.4 decision | 5 | DoD-5 staging rung | **a prod-tier soak surface + binding post-deploy health gate → auto-rollback-by-flag** | ⚪ |
| **2.3** | Dead-man's-switch (C8) external | P1 | 4 | (enables DoD-3) | **no silent supervisor — an external clamp-free watchdog alarms on runtime silence** | ⚪ |
| **2.4 ★** | Tiered scheduler consolidation + Hobby-cap | 4.1 first | 6 | (consolidates §7.5) | **one coordinated scheduler (engine-tick · reconciler · GS · dead-man) — 21 mechanisms collapse to a tier model** | ⚪ |

---

## 4. PHASE 3 — Goal Governance  ·  *the missing organs — the heart of the AI-native model*
**Phase milestone capability:** the engine becomes goal-GOVERNED — it refuses the unreachable, watches progress from outside the loop, drives the goal forward, and summons the founder at boundaries. **This is where "execution never stalls silently" becomes real. Effort: L · DoD closed: DoD-2, DoD-3, DoD-9.**

| Sprint | Title | Deps | Eff | DoD clause closed | **Capability unlocked** | Status |
|---|---|---|---|---|---|---|
| **3.1 ★** | Pre-flight Feasibility Gate (C9) | 1.5, P1 | 6 | **DoD-2** refuse unreachable | **the PRIMARY incident fix — statically-unreachable goals refused at hour 0, before effort** | ⚪ |
| **3.2 ★** | Goal Supervisor (C7) | 1.5, 2.3 | 7 | **DoD-3** halt-and-summon | **no-progress is caught from OUTSIDE the loop (dGoal/dEffort → trip → halt + founder FAP)** | ⚪ |
| **3.3 ★** | PO reconciler (C2-LOOP) — Class-C shadow-diff replace | 3.2, 4.1 | 7 | (DoD-9 paths) | **the durable Project Owner drives goal progress (desired-vs-observed), proven-parity to live behavior** | ⚪ |
| **3.4** | PO boundary intelligence (C2-MIND) | 3.3 | 6 | (sprint planning) | **the PO plans the next sprint + runs an independent completion review at boundaries** | ⚪ |
| **3.5** | Founder summon (C1 core fallback) | 3.2 | 4 | (Class-C reach) | **the founder is reachable at every boundary, even if Slack is down (non-SaaS fallback)** | ⚪ |

---

## 5. PHASE 4 — Execution Unification  ·  *bring everything INTO the Runtime*
**Phase milestone capability:** **nothing executes outside the Runtime** — the discovery "second runtime" is ported onto the engine and retired; sources of truth are single. **Effort: L (the discovery port is the largest single object) · closes the "Unification" DoD.**

| Sprint | Title | Deps | Eff | DoD clause closed | **Capability unlocked** | Status |
|---|---|---|---|---|---|---|
| **4.1** | I-LegacyGuard standing detector (PULLED EARLY — before 2.4 & 3.3) | P1 | 5 | (§52 enforcement) | **standing detection of execution-outside-the-engine / competing schedulers / out-of-band mutation** | ⚪ |
| **4.2** | WRAP discovery pipeline (compat shim) | P1 stores | 4 | (observability) | **the fenced second-runtime is observable on the bus (no behavior change)** | ⚪ |
| **4.3–4.6** | Port discovery stages (research·contacts·promote·seed) | 4.2 | 7 | (engine coverage) | **each discovery stage runs as a checkpointed engine workflow (via agent-runner + I-Provider)** | ⚪ |
| **4.7 ★** | Discovery cutover (live data migration) | P3, 4.6 | 7 | **Unification** | **the live revenue pipeline runs entirely inside the Runtime; the second runtime retired** | ⚪ |
| **4.8** | Consolidate engine/memory sources of truth | 4.7 | 4 | (one-source-of-truth) | **single canonical engine install + unified memory** | ⚪ |
| **4.9** | Retire dead/inert legacy | 4.8 | 2 | (cleanup) | **no inert/dead execution paths remain** | ⚪ |

---

## 6. PHASE 5 — Panel-Gated Autonomy  ·  *the AI-native OS, fully realized*  (each on its own §11 panel + V-H pass)
**Phase milestone capability:** the founder operates the company by goal, from Slack; the Runtime runs unattended within its gates. **Effort: L · gated on the proven human-present core + the V-H conditions.**

| Sprint | Title | Deps | Eff | DoD clause closed | **Capability unlocked** | Status |
|---|---|---|---|---|---|---|
| **5.1 ★** | Sprint Engine (C10) — Evidence Cycle | proven core + V-H | 7 | (unattended sprints) | **unattended, evidence-bounded sprint iteration within the H1 cap** | ⚪ |
| **5.2 ★** | PO auto-loop (C2-organ) | 5.1 | 6 | (persistent ownership) | **persistent ownership runs unattended — the project advances without a human in the loop** | ⚪ |
| **5.3 ★** | Full Slack surface (C1) + jarvis deploy | proven core | 5 | (founder UX) | **the founder runs the Runtime from Slack: /goal · identity-bound approvals · the 8-question single-screen** | ⚪ |
| **5.x ★** | Future ADR §57.8 + multi-provider/node/tenant adapters | build-on-pull | — | (Part V interfaces) | **infrastructure independence realized: swap LLM/host/tenant by config, not redesign** | ⚪ |

---

## 7. The capability staircase (cumulative — what the system can DO after each phase)
```
 now  ─ governed change (nothing merges unverified)                         ◀ you are here
 P1   ─ + safe to build on: caged secrets · known config readiness · the durable substrate
 P2   ─ + safe to ship: state-gated reversible deploys · a watchdog that can't go silently dead
 P3   ─ + GOAL-GOVERNED: refuses the unreachable · halts-and-summons on no-progress · a PO that drives the goal
 P4   ─ + UNIFIED: nothing executes outside the Runtime; the revenue pipeline runs on the engine
 P5   ─ + AUTONOMOUS: goal-in (Slack) → governed unattended delivery → result, founder at boundaries only
        ───────────────────────────────────────────────────────────────────────────────────────
        = THE AI-NATIVE OPERATING SYSTEM
```

## 8. Effort & sequencing summary
- **Total:** 5 phases · ~26 sprints (+ the V-H spike). **Per-sprint effort 2–7** (complexity); no single sprint is XL — the discipline is *many small evidence-bounded slices*, not big-bang.
- **Parallelism:** within P1, group A (1.1‖1.2) and group B (1.4) run parallel; V-H runs early-parallel; the discovery port (P4) builds from P2 but cuts over after P3; I-LegacyGuard (4.1) is sequenced early.
- **Founder checkpoints (★):** 1.1 · V-H go/no-go · 2.1 · 2.4 · 3.1 · 3.2 · 3.3 · 4.7 · every P5 panel — plus any pre-flight refusal / GS trip / cost-runaway boundary. **Everything else is author≠verifier engineering with no per-step founder prompt** (that's the autonomy the Runtime delivers).
- **What "done" means:** the CORE DoD (DoD-1..10 + §57) holds in production, the discovery second-runtime is retired, and the Part-V interfaces exist by contract. P5 autonomy is gated, not assumed — the human-present core is fully usable without it.

## 9. How this roadmap and the tracker relate
- **This roadmap** = the *map* (the whole journey, the why, the capability each step unlocks, where we are). Updated at phase/sprint boundaries.
- **`IMPLEMENTATION-TRACKER.md`** = the *live board* (every sprint's 16 fields + `NOT STARTED→IN PROGRESS→VERIFY→FOUNDER REVIEW→DONE` state + the change log). Updated continuously as work moves.
- Sprint statuses here mirror the tracker; the tracker is authoritative for live state.

*This document changes no architecture and builds nothing — it is the progress lens over the frozen plan.*
