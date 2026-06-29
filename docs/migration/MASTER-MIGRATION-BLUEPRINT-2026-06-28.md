---
artifact: MASTER MIGRATION BLUEPRINT (MMB-v1) — the engineering construction plan: current production ecosystem → approved Delivery OS Runtime
id: MMB-v1
date: 2026-06-28
authoritative inputs (the ONLY inputs; nothing else is assumed correct):
  - docs/reviews/RUNTIME-ARCHITECTURE-2026-06-28.md (RA-DOS-v1, frozen)
  - docs/reviews/RUNTIME-SPECIFICATION-2026-06-28.md (RS-DOS-v1, frozen; incl. §57 I-Config)
  - docs/migration/DISCOVERY-BLUEPRINT-2026-06-28.md (frozen at Part A below)
  - docs/migration/RUNTIME-CONFLICT-LEGACY-AUDIT-2026-06-28.md (frozen at Part A below)
method: re-derived FROM SCRATCH from first principles. Prior migration drafts are NOT assumed correct; where this
  blueprint coincides with or diverges from them is stated in Part I.
constraints: do NOT modify the Runtime · do NOT redesign the architecture · do NOT implement. This plans the build.
---

# Master Migration Blueprint (MMB-v1)

> The optimal ordered path from the existing production ecosystem to the approved Runtime, derived from the four
> frozen inputs alone. It plans; it builds nothing. Phase 1 is specified in full; Phases 2–5 are specified at
> sprint resolution and acquire full Definition-of-Done detail as each is reached (the AI-native discipline:
> detail the near, frame the far).

---

## PART A — Discovery Completion Review & FREEZE

### A.1 The investigation surface — is it saturated?
Discovery's job was to know the current system completely enough that the migration strategy will not be
invalidated by a later finding. Testing each surface against "could a remaining investigation *materially* change
the strategy" (material = would flip a KEEP/REPLACE disposition, reorder the forced dependency chain, or change a
phase boundary):

| Surface | Covered by | Material gap remaining? |
|---|---|---|
| Runtime components (engine, tick, seams, dispatch) | Discovery Blueprint §2.1/§2.3; Conflict Audit SAFE register; verified vs source | No — all KEEP, source-verified |
| Schedulers / crons / hidden paths | Discovery §2.2 (21-mechanism map); Conflict CONFLICT-04 | No |
| Execution-outside-the-engine | Conflict CONFLICT-01 (the discovery second-runtime, verified 3-layer) | No |
| Ownership / seams / registries | Discovery §2.7 (locked ECRs, one writer/entity) | No — clean |
| Config & secrets | Discovery §2.6; Conflict CONFLICT-03/05; **+ the final Config review → RS-DOS §57** | **No — the last probe; resolved into §57** |
| Deploy pipeline | Discovery §2.4; Conflict CONFLICT-02 (D7 nowhere) | No |
| Gaps vs spec (every C1–C20, C12 stores, I-*, §54) | Discovery §7; Conflict gap-readiness; spec component register §2 | No — fully enumerated |
| Domain data / financial SoR / migrations / RLS | Discovery §2.6; disposition KEEP (orthogonal) | No |
| Observability / monitoring | Discovery §2.8 (no dead-man's-switch; no Mission Control) | No — gap is named, not unknown |

**The five carried discrepancies** (Discovery Blueprint §6) are *confirmable facts*, not open investigations, and
**none is strategy-material** — each is carried as an explicit sprint decision-point:
1. **PLOS host (Hetzner-registry vs Vercel-code)** → the Runtime is infra-independent by contract (I-Placement §46,
   I-Schedule §7.5); resolved as a deploy-target detail in **Phase 2**, does not change the strategy.
2. **admin `.claude/base` inheritance state** → a consolidation detail in **Phase 4.8**.
3. **jarvis deploy host** (long-running worker) → an I-Surface adapter detail in **Phase 5.3**.
4. **`goal-progress`/M1 ledger unbuilt** → *confirmed*; already a **Phase 1** build item.
5. **PLOS engine-copy currency** → the CI drift-gate already governs it; a **Phase 4.8** detail.

### A.2 Determination & FREEZE
The final, deliberately-targeted probe (Configuration & Secret Management) surfaced exactly one resolvable item
(§57) and leaves no obvious next probe; every surface above is covered; the five open items are confirmable
decision-points, not investigations. **Discovery is genuinely complete.**

> **DISCOVERY IS HEREBY FROZEN (2026-06-28).** The four authoritative inputs are the sole factual basis for
> migration planning. New current-state facts discovered *during* the migration are handled as sprint-level
> findings (and, if they reveal a competing/hidden path, by the I-LegacyGuard build, §52) — they do not reopen
> Discovery. Any proposed change to the Runtime itself is a separate, founder-authorized spec action (as §57 was),
> never a migration decision.

---

## PART B — First principles (the migration is *derived*, not assumed)

Eight principles, taken directly from the frozen inputs, fully determine the plan. Every later choice traces to one.

- **FP1 — Reuse over rebuild (the substrate already exists).** Conflict Audit + Discovery establish the Result Bus
  (C11), engine-step tick (C13), dispatch (C15), the goal/approval/agent-result/seam APIs, the durable outbox,
  jarvis, and the locked ownership model as **SAFE / production-ready**. *Therefore migration = adopt + extend +
  govern the existing engine, not build a runtime.* (RA-DOS reuse mandate; Conflict SAFE register.)
- **FP2 — The end-state is the DoD, not a wishlist.** The migration is the ordered *closure of the gap* between
  the current state and the Runtime's Definition of Done (RS-DOS §16/§37.2). The DoD defines "done" (Part C); the
  Conflict Audit + gap map define the start; the path is what connects them.
- **FP3 — De-risk-early + fail-closed + irreversible-gates.** Close the *dangerous and un-gated* before building
  anything that increases autonomy or blast radius. A prod-write bypass, tree secrets, un-gated deploys, and
  unenforced config (CONFLICT-03/02, §57) are preconditions to trusting *any* later step. (RA-DOS §17; GOVERNANCE
  de-risk-early, irreversible-gates.)
- **FP4 — Expand/contract + coexistence, never big-bang.** Every step is additive then flag-cut then archived;
  old and new run side-by-side; authority flips by *evidence-gated cutover*. (RS-DOS §11 expand/contract; the
  bus-lease invariant makes concurrent old/new safe via SKIP-LOCKED.)
- **FP5 — The dependency order is forced, not chosen.** The spec's own component dependencies fix the sequence:
  durable stores (C12) → MetricProbe (§36) → pre-flight (C9) and Goal Supervisor (C7) → reconciler (C2-LOOP) →
  PO-mind (C2-MIND); and §54 trust boundary → any multi-provider. The critical path is read off the spec.
- **FP6 — The largest object is off the critical path.** The discovery second-runtime (CONFLICT-01) depends only
  on the engine (which exists) and is flag-gated/fenced; it is a *parallel workstream*, not a blocker — built
  early, cut over late (after the governance organs exist, so it lands under the full Runtime).
- **FP7 — Author≠verifier governs the migration itself.** Every migrated piece is independently verified; the
  I-LegacyGuard (§52) becomes the *standing* enforcement that nothing regresses to executing outside the Runtime.
- **FP8 — Readiness is enforced, not remembered (§57).** Config/secret readiness is a first-class, fail-closed
  precondition wired into C9/D7/C13 — so the foundation that prevented the founder's recurring failures is built
  *first* and everything deploys through it.

---

## PART C — The end-state (the DoD the migration must reach)
*Verbatim targets from RS-DOS §37.2 (the CORE DoD, human-present, panel-gated autonomy excluded). The migration is
"done" when every one holds in production. Each phase below closes a named subset.*

| DoD | The Runtime guarantee | Closed by |
|---|---|---|
| **DoD-1** | the durable spine is the sole state of record | Phase 1 (stores) — engine already lives there |
| **DoD-2** | pre-flight refuses statically-unreachable goals before effort | Phase 3.1 (C9) |
| **DoD-3** | halt-and-summon from *outside* the loop on no-progress | Phase 3.2 (C7) + Phase 2.3 (C8) |
| **DoD-4** | no >300s on serverless (checkpointed) | already true (engine tick); preserved through Phase 4 seed-port |
| **DoD-5** | prod never takes traffic first (staging) | Phase 2.2 |
| **DoD-6** | author≠verifier at slice/goal/orchestration | already (CODEOWNERS/verify-gate); uniform in Phase 2 |
| **DoD-9** | no silent failure (every failure → detection → escalation, F1–F15) | Phases 1–3 (stores + GS + dead-man's-switch) |
| **DoD-10** | durable breaker/idempotency/dead-letter/cost stores | Phase 1.4 (C12) |
| **§57** | config/secret readiness enforced at the gates | Phase 1.1–1.3 |
| **Unification** | *nothing executes outside the Runtime* | Phase 4 (discovery port + I-LegacyGuard) |

---

## PART D — The forced dependency order & the phase map (derived from FP5)

```
  SAFETY FLOOR + SUBSTRATE         DEPLOY/WATCHDOG SAFETY        GOAL GOVERNANCE
  (close dangerous, build base)    (gate the irreversible)      (the missing organs)
  ┌─────────────────────────┐      ┌────────────────────┐       ┌──────────────────────┐
  │ P1.1 secrets+break-glass│      │ P2.1 D7 on push    │       │ P3.1 pre-flight (C9) │
  │ P1.2 single registry    │─────▶│ P2.2 staging+health│──────▶│ P3.2 Goal Supervisor │
  │ P1.3 I-Config gates     │      │ P2.3 dead-man C8   │       │ P3.3 PO reconciler   │
  │ P1.4 durable stores C12 │      │ P2.4 tiered sched. │       │ P3.4 PO-mind C2-MIND │
  │ P1.5 MetricProbe        │      └────────────────────┘       │ P3.5 founder summon  │
  │ P1.6 GoalContract state │                                   │ [VALIDATE] headless  │
  └─────────────────────────┘                                   └──────────────────────┘
        │                                                                  │
        │   EXECUTION UNIFICATION (parallel from P2; cutover after P3)     │
        │   ┌──────────────────────────────────────────────────────────┐  │
        └──▶│ P4.1 I-LegacyGuard (guards the migration) · P4.2 WRAP     │◀─┘
            │ P4.3-4.6 port discovery stages · P4.7 cutover · 4.8 consolidate · 4.9 retire │
            └──────────────────────────────────────────────────────────┘
                                      │
                                      ▼   (only after human-present core proven + [VALIDATE] pass)
            ┌──────────────────────────────────────────────────────────┐
            │ P5 PANEL-GATED AUTONOMY: Sprint Engine · PO auto-loop ·    │
            │ full Slack surface · multi-provider/node/tenant adapters   │
            └──────────────────────────────────────────────────────────┘
```
**Critical path** (longest forced chain to a goal-governed run): P1.4 stores → P1.5 MetricProbe → P3.1 pre-flight
→ P3.2 GS → P3.3 reconciler → P3.4 PO-mind. **Off-critical-path parallel:** P1.1–1.3 (safety, start immediately),
P2 (deploy/watchdog), P4.2–4.6 (discovery port build). **Hard ordering:** nothing in P3 that *acts* ships before
P2 (deploy gate + dead-man's-switch); discovery *cutover* (P4.7) follows P3; autonomy (P5) follows the proven core.

---

## PART E — PHASE 1 (FULL DETAIL): Foundation & Safety Floor

**Phase objective.** Make the ecosystem *safe to migrate on* and lay the durable substrate every later organ
reads: close the security overrides, enforce config/secret readiness (§57), and build the greenfield durable
stores — all additive, none dependent on the missing organs. **Phase exit (DoD closed): DoD-1, DoD-10, §57; the
CONFLICT-03 security floor; the CONFLICT-05 config split.** **Phase founder-gate:** secrets/credentials handling
(1.1) and the break-glass policy.

> Field key — **Complexity / Risk** are 1–10 (implementation difficulty / chance-of-incident). **DoD** = the
> evidence that closes the sprint (author≠verifier; no self-sign). **Founder checkpoint** = an explicit human gate.

### Sprint 1.1 — Secrets to platform stores + audited break-glass (closes CONFLICT-03)
- **Objective:** no secret in any working tree; no standing prod-write bypass.
- **Scope:** rotate all `.env`-resident secrets (both repos) into platform stores (Vercel/GitHub/Supabase);
  delete `.env` from trees (keep `.env.example`); replace `ALLOW_PROD_DB_WRITE=1` with a time-limited, founder-
  signed, single-use, immutable-ledger break-glass (the immutability-guard pattern already used for the financial
  SoR). *Out of scope:* a richer break-glass workflow (Future ADR §57.8 F-CSM-6).
- **Deliverables:** all secrets in platform stores; trees clean (grep-verified in CI); `prod_write_override`
  break-glass + append-only audit ledger; `ALLOW_PROD_DB_WRITE` removed from every config registry.
- **Dependencies:** none (can start immediately).
- **Complexity 3 · Risk 5** (touches prod auth/DB; rotation can break running apps).
- **Validation:** an independent security reviewer (not the rotator) confirms zero tree secrets, platform-store
  parity, app reads correctly, and break-glass is single-use + immutable-logged.
- **DoD:** CI secret-scan green on both repos; bypass absent; break-glass exercised once in staging (consumed,
  audit-logged, re-use fails); rollback path proven (revert to prior secret version).
- **Founder checkpoint: YES** — credential rotation + break-glass policy (Class-C, §3.1/§12).

### Sprint 1.2 — Single Config & Secret Registry + I-Config oracle (closes CONFLICT-05 config split; §57.2/57.4)
- **Objective:** one canonical config/secret registry + one readiness oracle across the ecosystem.
- **Scope:** consolidate the two `config-registry.json` + two validators (PLOS Zod / admin manual) to one schema;
  `config-doctor` becomes the sole `I-Config` readiness implementation (`PRESENT/MISSING/INVALID/DRIFTED`) over the
  provider planes. *Out of scope:* drift *auto-remediation* (evidence-only, §50).
- **Deliverables:** canonical registry schema (metadata only, never values; `data_class`/`env_scope`/`owner`/
  `source_provider`/`rule`); `I-Config` oracle; the two legacy loaders retired behind it.
- **Dependencies:** 1.1 (secret sources known).
- **Complexity 4 · Risk 3.**
- **Validation:** independent auditor confirms every key from both legacy registries is present in the canonical
  one with identical schema/validation; 100% read-agreement over a sample.
- **DoD:** one registry; `I-Config` returns correct verdicts for all required keys in all envs; both repos read it.
- **Founder checkpoint:** no (mechanical consolidation).

### Sprint 1.3 — Capability requirements + readiness as a fail-closed gate precondition (§57.3/57.5/57.6)
- **Objective:** the Runtime *knows* which capability needs which config/secret, and *blocks* on it.
- **Scope:** add `requires_config`/`requires_secret` to capability descriptors (§31); wire `I-Config` readiness as
  a **named fail-closed precondition** into the C9-stub (pre-flight), D7 (deploy), and C13 (startup) entry points;
  wire `I-LegacyGuard` detections for tree-secrets/bypass/drift/duplicates (the standing guarantee).
- **Deliverables:** capability requirement declarations; readiness gate-bindings in all three gates; the four
  I-LegacyGuard config detections emitting to the founder audit/boundary.
- **Dependencies:** 1.2 (registry + oracle).
- **Complexity 4 · Risk 3.**
- **Validation:** independent reviewer proves a missing/invalid required key *blocks* a build, a deploy, and a
  startup (three fail-closed tests), and that a planted tree-secret/bypass is *detected* by I-LegacyGuard.
- **DoD:** §57.5 holds — deploy/startup block on missing required config; detections fire; no false-open.
- **Founder checkpoint:** no.

### Sprint 1.4 — The five durable stores (C12) (closes DoD-10; greenfield)
- **Objective:** the durable substrate the Goal Supervisor and reconciler will read.
- **Scope:** schemas + migrations + access for the goal-delta ledger, attempt-ledger + circuit-breaker,
  idempotency/de-dup, dead-letter terminal, portfolio-cost ledger (RS-DOS §8.3). All append-only / immutability-
  guarded, RLS-scoped (§54.3), homed per RA-DOS §17.2.
- **Deliverables:** five stores live with forward-only migrations; breaker state *durable* (never RAM).
- **Dependencies:** none on legacy (greenfield); benefits from 1.2 (config) for connection/scope.
- **Complexity 6 · Risk 3** (greenfield, no legacy conflict; correctness-sensitive).
- **Validation:** independent verifier proves append-only enforcement (trigger), idempotency on intent-key,
  breaker open/close/cooldown survives a restart, portfolio-cost aggregates across goals.
- **DoD:** DoD-10 — all five stores exist and enforce their invariants under a concurrency test.
- **Founder checkpoint:** no.

### Sprint 1.5 — MetricProbe substrate + goal-progress (§36; the GS/pre-flight input)
- **Objective:** registered, versioned, least-privilege probes that read acceptance metrics externally.
- **Scope:** `MetricProbe` descriptor + registry + invocation (§36.1); the `goal-progress` tool that appends
  `ProgressSample` to the goal-delta ledger (the C7 input that is *MISSING on disk*).
- **Deliverables:** probe registry + runtime; `goal-progress` appending to 1.4's ledger.
- **Dependencies:** 1.4 (goal-delta ledger).
- **Complexity 5 · Risk 3.**
- **Validation:** independent verifier confirms a probe re-reads the metric from its canonical source under
  least-privilege creds and is version-pinned; a `ProgressSample` lands correctly.
- **DoD:** a metric can be externally re-probed and recorded; ready for C9/C7 consumption.
- **Founder checkpoint:** no.

### Sprint 1.6 — Goal Contract durable state (C2-STATE) (§4.1)
- **Objective:** the durable accountability record a goal lives in.
- **Scope:** the GoalContract schema (objective, acceptance metric + `data_class`, budget/H1 cap, ledger refs,
  the §4.3 state machine fields) as durable rows; reconciled-state, not a daemon (OM-INV-5).
- **Deliverables:** GoalContract store + the C2-STATE machine fields; `data_class` carrier (§54.1).
- **Dependencies:** 1.4 (ledgers it references).
- **Complexity 4 · Risk 3.**
- **Validation:** independent verifier confirms the state machine's legal-edge set (§4.3) is enforced and the
  contract survives restart (OM-INV-5).
- **DoD:** a GoalContract can be created, persisted, and transitioned legally; ready for the reconciler (P3.3).
- **Founder checkpoint:** no.

**Phase 1 exit gate (founder review):** secrets closed + readiness enforced + stores live → the ecosystem is safe
to migrate on. *Author≠verifier across all six sprints; the founder reviews the security/break-glass evidence.*

---

## PART F — PHASES 2–5 (sprint resolution; full DoD detail acquired when reached)

### PHASE 2 — Deploy Discipline & Scheduler Safety (gate the irreversible)
*Exit DoD: DoD-5, DoD-6 (uniform), and the liveness watchdog. Precondition for any acting organ in P3.*
| Sprint | Objective | Key deliverables | Cx · Risk | Founder checkpoint |
|---|---|---|---|---|
| 2.1 | Wire D7 state-gated deploy *on top of* push-deploy (audit-mode→enforce) | `.deploy-lane.json` per repo; `deployment-auth` reads SDLC state + I-Config readiness (P1.3); push-deploy demoted to Class-C | 5 · 4 | **YES** (deploy authority) |
| 2.2 | Staging rung + parity + post-deploy health | staging env per repo; bidirectional content-hash parity gate; binding health gate (no continue-on-error) + rollback | 5 · 4 | no |
| 2.3 | Dead-man's-switch (C8) | external monitor on a *different failure domain*; alarms on heartbeat/GS silence within N min | 4 · 4 | no |
| 2.4 | Tiered scheduler consolidation (§7.5) | collapse the 21 mechanisms to engine-tick · PO-reconciler-slot · GS-slot · dead-man's-switch; resolve Hobby-cap | 6 · 5 | **YES** (Hobby-cap platform/cost decision) |

### PHASE 3 — Goal Governance (the missing organs; closes the safety DoD, human-present)
*Exit DoD: DoD-2, DoD-3, DoD-9. Build order forced by FP5.*
| Sprint | Objective | Key deliverables | Cx · Risk | Founder checkpoint |
|---|---|---|---|---|
| 3.1 | Pre-flight Feasibility Gate (C9) — THE primary incident fix | serverless-ceiling lint + reachability/precedent (§36.3) + config-readiness (§57.5); refuse-and-summon at hour 0 | 6 · 4 | **YES** (what goals are accepted) |
| 3.2 | Goal Supervisor (C7) | external re-probe via MetricProbe; dGoal/dEffort; flat-delta trip; halt-and-summon; reads goal-delta ledger | 7 · 5 | **YES** (halt-and-summon behavior; slow-asymptotic [VALIDATE]) |
| 3.3 | PO reconciler (C2-LOOP) | level-triggered desired-vs-observed on durable state; boundary detection; dispatch via C15 | 7 · 5 | no |
| 3.4 | PO boundary intelligence (C2-MIND) | bounded Claude session at boundaries: sprint plan (frozen criteria) + completion review | 6 · 5 | no |
| 3.5 | Founder summon (C1 core) | non-SaaS fallback channel (SMS/email) + BoundaryFAP wiring (Class-C fail-closed) | 4 · 3 | no |
| [VALIDATE] | headless-Claude-invocation spike (RA-DOS §17.4) | empirical proof the G9 spawner runs unattended | 5 · 6 | **YES** (go/no-go on the autonomy path) |

### PHASE 4 — Execution Unification (bring the second runtime INTO the Runtime; closes "nothing executes outside")
*Builds in parallel from P2; CUTOVER follows P3 so the ported pipeline runs under the full Runtime.*
| Sprint | Objective | Key deliverables | Cx · Risk | Founder checkpoint |
|---|---|---|---|---|
| 4.1 | I-LegacyGuard standing detector (§52) — *built before cutover, guards the migration* | standing detection of execution-outside-engine, competing schedulers, hidden paths, out-of-band mutation | 5 · 3 | no |
| 4.2 | WRAP the discovery pipeline (compat shim) | the fenced pipeline emits engine events; observable from the bus; no behavior change | 4 · 3 | no |
| 4.3–4.6 | Port stages onto engine workflows (research → contacts → promote → seed-as-long-lane-run) | each stage a checkpointed step via agent-runner + I-Provider; lead.status → engine state; external calls engine-coordinated; fenced trial cohort | 7 · 6 (peak at seed) | no (per-stage) |
| 4.7 | Cutover discovery authority to the engine; retire old pipeline | evidence (golden-master replay + parity + throughput) → flag-flip → old pipeline read-only → archive | 4 · 5 | **YES** (the live lead pipeline) |
| 4.8 | Consolidate sources of truth (CONFLICT-05 engine/memory) | single canonical engine install; unified memory/registries | 4 · 3 | no |
| 4.9 | Retire dead/inert legacy (CONFLICT-06) | delete the setTimeout loop, tick relay, queue stub, debris; resolve install lag | 2 · 1 | no |

### PHASE 5 — Panel-Gated Autonomy (only after the proven core + [VALIDATE] pass)
*Each is spec-gated on its own §11 panel — authorization is a founder act, not a migration default.*
| Sprint | Objective | Cx · Risk | Founder checkpoint |
|---|---|---|---|
| 5.1 | Sprint Engine / Evidence Cycle (C10) — unattended auto-sprint | 7 · 7 | **YES (§11 panel)** |
| 5.2 | PO auto-loop (C2-organ, unattended) | 6 · 7 | **YES (§11 panel)** |
| 5.3 | Full Slack surface (C1: identity-bound approvals, single-screen) | 5 · 4 | **YES (§11 panel)** |
| 5.x | Future ADR §57.8 + multi-provider/node/tenant adapters (§54.5) | build-on-pull | **YES (per panel)** |

---

## PART G — Cross-cutting strategy (one rule per concern, derived from FP4/FP7)

- **Compatibility layers / temporary adapters:** only where old and new must coexist — the discovery WRAP (4.2),
  the D7 audit-shim (2.1), the secret `.env`-fallback window (1.1), the dual-registry read window (1.2). Each is
  *thin, time-boxed, and removed at cutover* — never a fork.
- **Coexistence:** old and new run side-by-side under SKIP-LOCKED isolation; flags default OFF; the legacy path
  adds no new capability during migration.
- **Cutover triggers:** evidence-gated, never calendar — each cutover names its proof (e.g., 4.7 = golden-master
  replay ≥ parity + throughput + founder FAP). Fail-closed if proof is absent.
- **Rollback:** expand/contract everywhere — additive build → flag-flip authority → archive (not delete) legacy
  for one audit window. Rollback = flag-revert (minutes), never a schema reversal. Security items (1.1) are the
  one *complete-removal* exception (no archive of a bypass).
- **Validation:** author≠verifier on every sprint; an independent reviewer signs the DoD; no self-certification.
- **Testing:** real-surface (not mocks) for seams; concurrency/abort repro for the engine; golden-master replay
  for the discovery port; parity-hash for staging→prod; fail-closed tests for every gate.
- **Deployment:** everything ships local→QA→staging→prod under the D7 lane *once 2.1/2.2 exist*; before then,
  Phase-1 items ship through the current pipeline plus the new readiness gate (1.3).
- **Legacy retirement:** flag-OFF (observable no-op, never silent) → 30-day stable → archive → (config, not data)
  delete. I-LegacyGuard (4.1) standingly prevents re-introduction.
- **Risk mitigation (top items):** discovery-port quality regression (golden-master replay + identical I-Provider
  calls) · prod-write bypass closure (immutable audit ledger + single-use tokens) · D7 cutover (audit-mode proof
  before enforce) · GS false-trip (spec-pinned §7.2 logic + flag rollback) · unmonitored heartbeat (the dead-man's
  -switch, built in 2.3, *before* any autonomous acting in P3).

---

## PART H — Consolidated founder checkpoints (the only human gates)
1. **P1.1** — secrets rotation + break-glass policy (Class-C).
2. **P2.1** — deploy authority (D7 enforce).
3. **P2.4** — Hobby-cap resolution (platform/cost).
4. **P3.1** — goal-acceptance policy (what pre-flight refuses).
5. **P3.2** — halt-and-summon behavior + the slow-asymptotic [VALIDATE] ruling.
6. **[VALIDATE] P3** — headless-invocation spike go/no-go (gates autonomy).
7. **P4.7** — discovery cutover (the live lead pipeline).
8. **P5.×** — every §11 autonomy panel.
*Everything else is author≠verifier engineering with no per-step founder prompt (the autonomy the Runtime exists
to provide), within these gates.*

---

## PART I — What this supersedes / honest divergences (FP-driven, not assumed)
Re-derived from first principles, this blueprint **diverges from earlier migration drafts** in three load-bearing ways:
1. **The security floor + §57 readiness are Phase 1, not a side workstream.** De-risk-early + fail-closed (FP3/FP8)
   make closing the prod-write bypass and *enforcing* config-readiness the *first* work — you do not build
   governance organs on an ecosystem that can still write to prod out-of-band. (Earlier drafts treated these as a
   parallel "CONFLICT closure" track; first principles promote them to the foundation.)
2. **The deploy gate + dead-man's-switch precede the acting organs.** Irreversible-gates (FP3) put D7 (2.1) and C8
   (2.3) *before* the Goal Supervisor/reconciler (P3) — you do not let an organ *act* or *deploy* before the gate
   and the watchdog that bound it exist. (Earlier drafts placed the GS earlier and D7 later.)
3. **The discovery port builds in parallel but cuts over last (before autonomy).** FP6 — it is off the critical
   path (needs only the engine) yet its *authority flip* waits for the governance organs, so the ported pipeline
   lands under the full Runtime, guarded by I-LegacyGuard (built 4.1, *before* cutover).
Where earlier analysis holds under scrutiny (the disposition set, the gap matrix, the engine-as-Result-Bus, the
expand/contract discipline), it is retained — but as *re-derived conclusions*, not assumptions.

**No improvement idea here modifies the Runtime.** Items that would extend the architecture are recorded only as
Future ADR Candidates (§57.8 and any surfaced during build) and are out of scope until separately ratified.

*End of MMB-v1, Phase 1 detailed. Phases 2–5 acquire full sprint DoD detail as each is reached. This document
plans the build; it implements nothing and changes neither the Runtime nor the architecture.*
