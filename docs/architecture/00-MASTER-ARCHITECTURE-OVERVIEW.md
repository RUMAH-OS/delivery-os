# Delivery OS — Master Architecture Overview

**Status:** SYNTHESIS — closes the architecture phase. Designed, not built; installs nothing, changes no code.
**Date:** 2026-06-30. **Type:** the single founder-facing synthesis that ties the whole architecture initiative
together. It **indexes + reconciles** the architecture corpus; it does **not** re-design. Where it disagrees with a
canonical detail doc, the **detail doc wins — fix this file.**
**Authoritative corrections folded in:** `docs/architecture/WAVE1-CHALLENGE.md` (ACCEPT-WITH-CHANGES). Every place
this overview states a claim weaker or differently than a source doc, the challenge is the reason — it is called out
inline.

> **The architecture in three sentences.** Delivery OS is **one repository** of co-evolving platform subsystems
> whose dependencies flow **strictly inward** toward an infrastructure-agnostic **Runtime** (the governance +
> workflow engines), with the only legal cross-layer surface being a thin ring of **Core-owned contracts/ports**.
> The **Execution Infrastructure** (Neo = Execution Node 1) is an **outer Adapter** that *consumes* those contracts
> and is never depended-upon by Core — so the host is a reversible deployment choice (swap Neo for Linux later by
> node-registration, not redesign). The dependency *direction* is clean today (independently re-verified); the
> *enforcement* of it (gate + Delete Test) and the *Execution Infrastructure* itself are **designed, not built** —
> and this overview is honest about that gap throughout.

---

## 1. Executive summary — the current truth, honestly

**The shape.** Delivery OS is a **single repository** holding the entire platform: the Runtime (Governance Engine,
Workflow Engine, Capability Framework), the Contracts/Ports, the Adapters (Execution Infrastructure, Monitoring,
the reference Postgres adapter, the Vercel+Supabase plane), the Templates (the vendorable slice consumers install),
the Tooling/Governance (gates, harness, propagation), and the Documentation. The **repository boundary is not the
architectural boundary**: the architecture is preserved by **enforced inward-only dependency rules** between
subsystems, not by splitting repos. (`docs/architecture/PRINCIPLE-repository-and-dependency-rule.md`, ratified
2026-06-30.)

**Two boundaries, two mechanisms** (the distinction the whole model turns on):
- **Platform ⇄ consumer = a REPOSITORY boundary.** rumah-admin, PLOS, Finance OS are *separate repos* that *consume*
  Delivery OS (vendor the Templates / call the contracts). The relationship is **independence**.
- **Subsystem ⇄ subsystem (inside Delivery OS) = a DEPENDENCY boundary.** Runtime, engines, Execution Infra,
  Monitoring, SDKs all live in the **one** repo and **co-evolve** (one version, one roadmap, atomic cross-cutting
  change, no cross-repo version drift). The relationship is **co-evolution**.
- **The discriminator:** *"could two different consumers share it?"* Generic/domain-agnostic ⇒ inside (platform);
  bound to one business domain ⇒ outside (consumer).

**The Runtime is the infra-agnostic core.** It knows nothing of Neo, Docker, Tailscale, launchd, GitHub-runners, or
any concrete environment. The **Execution Infrastructure (Neo Node 1)** is an adapter that consumes two Core-owned
contracts — the `ExecutionProviderPort` (compute in) and the Health-Emission Contract (health out) — and implements
them behind the boundary. Replace Neo with a Linux node later and **not one Runtime file changes**.

**The current truth (stated plainly, per the Wave-1 challenge):**
1. **Dependency direction is clean — VERIFIED.** Independent re-verification (challenge Attack 1, SURVIVES)
   confirms: the governance/workflow **organ surface** imports nothing outward (comments excluded); the only
   `postgres` imports are in the sanctioned reference adapter; no platform→consumer code import exists. **Caveat:**
   this is true over the *organ surface the residency-guard scans*, not a whole-repo proof — and **nothing yet
   enforces it** (the guard is run by no hook/CI).
2. **Enforcement is DESIGNED, NOT BUILT.** The dependency-direction gate, the `architecture.config.json`,
   `tsconfig.core.json`, the standing Delete Test, and Gate 5 in `.githooks/pre-push` **do not exist on disk**.
   delivery-os has **no `.github/workflows/` of its own** (CI exists only as vendorable templates). The boundary is
   currently "true by discipline," not "guaranteed by construction."
3. **Execution Infrastructure is DESIGNED, NOT BUILT.** The Neo node, the `ExecutionProviderPort`, the
   Health-Emission Contract, the bootstrap/scripts/plists/templates are **design + templates + script-designs only**
   — no node joined, no daemon loaded, no contract code in `ports.ts`.

The kernel invariant (`CLAUDE.md §3`) was earlier overstated as present-tense "enforced"; per the challenge's
single most dangerous gap, **that wording has been corrected to "designed, not yet built"** (Phase 0, below, makes
it true rather than just claimed).

---

## 2. Repository structure, subsystem map & dependency graph

Source of record: `docs/architecture/REPOSITORY-AUDIT-subsystem-map.md` (read-only audit, 2026-06-30 — 22
subsystems, zero dependency-direction violations).

### 2.1 The 22 subsystems by layer

| Layer | Subsystems (audit #) |
|---|---|
| **Core / Runtime** (5) | Workflow Engine (#1) · Governance Engine — 14 organs + `createGovernanceRuntime` (#3) · Build-time goal harness (#7) · Core doctrine/kernel `core/` (#17) |
| **Contracts / Ports** (4) | Workflow-engine ports (#2) · Governance-engine ports `ports.ts` (#4) · Governance migrations + cages — invariant spec (#6) · Cross-system seam/inventory contracts (#13) |
| **Adapters** (4 — 2 design-only) | Governance reference Postgres adapter (#5) · Config/readiness/deploy/rollback — Vercel+Supabase+`gh` plane (#9) · Observability/platform-health (#10) · **Execution Infrastructure — Neo (#11, DESIGN-ONLY)** · **Slack control surface (#12, NOT BUILT)** |
| **Templates** (vendorable slice) (2) | Vendorable doc/template slice (#19) · Domain packs / processes / checklists (#20) |
| **Tooling / Governance** (5) | Verification/gate tooling (#8) · Capability framework + ledger (#14) · Skills (#15) · Agents (#16) · Propagation/drift tooling (#18) |
| **Documentation** (2) | Portability example apps — `examples/` (#21) · Knowledge/history (#22) |

**No production consumer code lives in delivery-os.** The only domain-bound code is the two demo apps under
`examples/` (`engine-demo-app`, `finance-os-demo`) — portability proofs, unmanifested, not shipped; they are the
in-repo Delete-Test analogue.

### 2.2 The dependency graph (the Dependency Rule, inward-only)

```
        ┌──────────────────────── Delivery OS (ONE repo) ────────────────────────┐
        │                                                                          │
        │   TEMPLATES (vendorable slice)        DOCUMENTATION (spans all layers)   │
        │        │ copied into consumers              │                            │
        │        ▼                                    ▼                            │
        │   ┌─────────────────── CORE / RUNTIME ───────────────────┐               │
        │   │  Governance Engine · Workflow Engine · Capability FW  │  imports      │
        │   │  infrastructure-AGNOSTIC · imports nothing outward    │  ONLY self    │
        │   └───────────────────────▲───────────────────────────────┘  + contracts │
        │                           │ defines                                       │
        │   ┌─────────────── CONTRACTS / PORTS ───────────────┐  the ONLY legal     │
        │   │ ExecutionProviderPort · Health-Emission contract │  cross-layer        │
        │   │ store ports · SDKs · seam contracts              │  surface            │
        │   └───────────────────────▲───────────────────────────┘                   │
        │                           │ adapters consume contracts, never internals   │
        │   ┌──────────────── ADAPTERS (outer ring) ─────────────────┐               │
        │   │ Execution Infra (Neo·Docker·Tailscale·runner) [design] │               │
        │   │ Monitoring · reference Postgres · Vercel+Supabase plane │               │
        │   │ Slack surface [not built]                               │               │
        │   └──────────────────────────────────────────────────────────┘            │
        │     TOOLING/GOVERNANCE (gates·harness·propagation) — build/CI-time, never  │
        │     vendored into a consumer app                                           │
        └──────────────────────────────────────────────────────────────────────────┘
              Dependencies flow strictly inward:  adapter → contract → core.  Never outward.

        SEPARATE REPOS (consumers — independence, a REPO boundary, NOT shown above):
              rumah-admin · property-lead-os (PLOS) · Finance OS  —  vendor Templates / call contracts
```

### 2.3 Layout recommendation — adopt the WEAKENED finding (lighter sub-folder split)

The audit's §5 headline proposed a full top-level rename (`runtime/` + `adapters/` + `execution-infrastructure/` +
`tooling/`). **The Wave-1 challenge WEAKENED this (Attack 2)** and that ruling is adopted here:

- The full engine rename touches **39+ `templates/tools/*` path entries** + the engine `source` path in
  `capabilities/os-foundation.manifest.json`, plus `os-inherit.mjs`'s own path logic and every consumer's
  `--from` wiring. "Minimal, mechanical" undersells a 40+ path atomic rewrite of the file that *defines the install
  set*. The real risk is **install-path coupling** (it breaks `os-inherit sync` resolution if not done atomically),
  not content-sha drift.
- **Adopt the audit's own §5.2 minimum instead:** the **lighter in-place sub-folder split** inside `templates/tools/`
  (`tools/core/`, `tools/adapters/`, `tools/gates/`) achieves the path-legibility F4 wants **without** the
  cross-repo install-path churn, plus the **cheap top-level lift** of the design-only `neo/` docs into a top-level
  `execution-infrastructure/design/`.
- **Defer** the full `runtime/` engine rename until a real second engine + a real second consumer make the
  legibility pay for the churn. If ever taken, it MUST be one atomic slice (manifest + installer + every `--from`)
  behind the verify-gate, with an `os-inherit sync` dry-run on a consumer as the acceptance gate.

---

## 3. Architectural invariants + the consolidated ADR summary

### 3.1 The invariant set (the floor that outranks any change)

- **The Repository Principle** (ratified): one repo; the repo boundary is not the architectural boundary; two
  boundaries (platform⇄consumer = repo; subsystem⇄subsystem = dependency); dependencies flow **strictly inward**
  (adapter → contract → core); Core imports nothing outward and no infra SDK; adapters consume only contracts;
  contracts are platform-owned.
- **The kernel set** (`CLAUDE.md §3`): POINTS-never-RESTATES · one-source-of-truth-per-concern · author≠verifier ·
  **verification is operationally enforced, not remembered** · no speculative scaffolding (Waterline) · surface
  disagreements, never smooth them.
- **Honest enforcement status** (`CLAUDE.md §3`, corrected per challenge §6): the Repository Principle is **designed,
  not yet enforced on disk** — the gate + Delete Test are Phase-0/1 work, not a present-tense fact. This principle
  must be added to `check-os-drift` coverage so the kernel-vs-disk gap cannot recur.

### 3.2 Consolidated ADR summary (every ADR across the corpus, one table)

22 decisions. The Neo set is consolidated in `neo/00 §10`; the repository/enforcement set is in the Principle +
enforcement docs. ★ = founder-decided or founder-gated.

| ADR | Title | Decision (one line) | Source |
|---|---|---|---|
| **REPO-1** | The Repository & Dependency Principle | One repo of co-evolving subsystems; architecture preserved by enforced inward-only dependency rules, not repo splits; two boundaries (platform⇄consumer = repo, subsystem⇄subsystem = dependency). | `PRINCIPLE-repository-and-dependency-rule.md` (ratified) |
| **ENF-1** | Dependency-direction gate (config-driven) | Generalize `residency-guard.mjs` into a repo-wide `arch-boundary-guard.mjs` driven by `architecture.config.json`; fail-closed; pre-push Gate 5 + CI; static, free. | `DEPENDENCY-ENFORCEMENT-and-delete-test.md` §1 |
| **ENF-2** | The standing Delete Test | Delete an adapter subsystem in a worktree; assert Core still builds (`tsconfig.core.json`) + contracts resolve + Core self-tests pass — the inward twin of the consumer-independence proof. **Oracle corrected (see §5).** | `DEPENDENCY-ENFORCEMENT-and-delete-test.md` §2 |
| **★ HOST-1** | Execution Node 1 = Neo (Apple Silicon MacBook) | Founder-decided 2026-06-30. A reversible, host-agnostic deployment choice (the port makes Node 1 swappable, zero PO change); challenge's technical findings ACCEPTED as Neo risks+mitigations, its host-RESEAT SUPERSEDED; Linux migration = node-registration, not redesign. | `neo/00 §1.3`, `neo/06` |
| **★ HOST-2** | Ed25519 timing + co-equal deploy token | Do Ed25519 (SEC-3) BEFORE go-live; treat `VERCEL_TOKEN` co-equally with break-glass (deploy author≠verifier / approval gate); bound the break-glass `(table,op)` set; state the dead-man covers availability, not integrity. | `neo/00 §10`, `neo/05` |
| **★ HOST-3** | FileVault unattended-reboot resolution | FileVault stays ON (portable secret store); battery = built-in UPS; planned reboots use `fdesetup authrestart`; rare unplanned reboot = accepted manual-login RTO (watchdog pages); boot secrets from System keychain/file-ACL, never login keychain; cold-boot recovery test is a go-live M-gate. | `neo/00 §1.4/§9.3`, `neo/06 §3` |
| **EN-1** | Ephemeral self-hosted runner | The node runs an ephemeral GH Actions runner for required checks; GitHub stays event+gate plane, the node is compute; checks move by a one-line `runs-on` change. | `neo/01 ADR-001` |
| **EN-2** | launchd/systemd supervisor; reject pm2/cron | launchd (macOS)/systemd (Linux) supervises; pm2 + cron rejected — the worker must own its clock (no cron-of-an-LLM). | `neo/01 ADR-002` |
| **EN-3** | Accept self-hosted-runner exposure (bounded) | Accept the runner code-exec exposure for solo private repos, bounded by ephemerality + non-admin user + no-`pull_request_target` + scoped tokens + ACL egress; explicit re-evaluation trigger (2nd contributor / public fork). | `neo/01 ADR-003` |
| **EN-4** | `runs-on` swap = rollback contract / kill-switch | No node move is a one-way door; `runs-on: ${{ vars.CI_RUNNER }}` is a UI-flippable kill-switch (reroutes future/queued runs — in-flight drains, per challenge §5b); keep disabled GHA crons in SHADOW. | `neo/01 ADR-004` |
| **SEC-1** | Tailscale is the foundational fabric | WireGuard mesh; services bind tailnet/`127.0.0.1`, never a public IP; SaaS stays off-tailnet as outbound TLS; Tailscale is the control plane, not the data plane. | `neo/02 ADR-1` |
| **SEC-2** | Tailscale SSH; no public `sshd` | Keyless, ACL-governed Tailscale SSH replaces host SSH keys; no public `sshd`; local-console fallback. | `neo/02 ADR-2` |
| **SEC-3** | Ed25519 break-glass | Migrate break-glass HMAC→Ed25519 so the signing key never lives on the node; a compromised node cannot mint a grant. **Do before go-live** (HOST-2). | `neo/02 ADR-3` |
| **SEC-4** | `tag:external` enforces `data_class` | A future cloud node is ACL-quarantined; PII/SECRET physically cannot reach `tag:external` — the network enforcement of the trust boundary. | `neo/02 ADR-4` |
| **HBM-1** | Off-node dead-man's-switch | The dead-man lives OFF the node (Healthchecks.io push) + a Windows-task pull backup; failure-domain independence; push beats pull (no inbound, unforgeable absence). | `neo/03 ADR-001` |
| **HBM-2** | No Prometheus/Grafana | The durable Postgres bus IS the metrics store + an off-node Vercel status page + rotated logs; no second job, no shared failure domain. | `neo/03 ADR-002` |
| **HBM-3** | Dead-man gated on `/ready` | The check-in fires only when `/ready` is green — proves *supervision*, not just *power* (catches degraded-but-running); a false page is safer than a false silence. | `neo/03 ADR-003` |
| **FEL-1** | Durable-bus-backed replaceable nodes | All state on the bus; no node holds essential RAM state; in-flight work between checkpoints is re-run (bounded by budget), not recovered. | `neo/04 ADR-FEL-1` |
| **FEL-2** | Constraint-first, fail-closed placement | Gate on `data_class` eligibility first, optimize second; empty eligible set is fail-closed (wait or halt-and-summon), never a silent downgrade. | `neo/04 ADR-FEL-2` |
| **FEL-3** | Asymmetric DR | Back up the database obsessively (PITR + off-provider dump); back up no node disk; recovery = restore DB + stand up fresh node + re-vendor secrets + resume. | `neo/04 ADR-FEL-3` |
| **FEL-4** | Reliability-first fleet growth | Incremental fleet (Linux reliability → Mac Studio capacity → cloud burst); each justified by a real driver, reversible, never two changes at once. | `neo/04 ADR-FEL-4` |
| **EXEC-1** | Execution Infra is a top-level Adapter subsystem | Place the Neo infra in `infrastructure/execution-node/`, NOT under `templates/`; contracts live Core-side; enforce with the direction gate + Delete Test. | `neo/07 ADR-EXEC-1` |
| **EXEC-2** | Formalize `SprintExecutor` → `ExecutionProviderPort` | Build the EIB §9 port as a Core-owned contract; re-express `runSprint`/`admitToExecuting` as callers emitting `ExecutionRequest` into a `PlacementPort`; keep `DEFERRED_EXECUTOR` as the null-registry no-op (the §44 "zero behavior change" acceptance test — unproven until it runs, per challenge §4c). | `neo/07 ADR-EXEC-2` |
| **EXEC-3** | Health-Emission Contract (emit-side Core-owned) | Core emits `HeartbeatRecord` + `PlatformHealthReport` and exports `isReady`; the adapter transports it (Healthchecks pusher, Windows pull, status page); Core names no monitor. **Host-agnostic — SURVIVES the challenge cleanly (Attack 4b).** | `neo/07 ADR-EXEC-3` |

---

## 4. Deliverable index

The architecture phase's required deliverables, each pointed to its doc. "Standalone" = its own doc; "Embedded" =
specified inside a larger doc, not yet extracted.

| # | Deliverable | Home | Status |
|---|---|---|---|
| 1 | **Repository & Dependency Principle** | `docs/architecture/PRINCIPLE-repository-and-dependency-rule.md` | Standalone (ratified) |
| 2 | **Repository Audit — subsystem map + dependency graph + layout** | `docs/architecture/REPOSITORY-AUDIT-subsystem-map.md` | Standalone |
| 3 | **Enforcement strategy (dependency-direction gate)** | `docs/architecture/DEPENDENCY-ENFORCEMENT-and-delete-test.md` §1, §3, §4 | Standalone (design) |
| 4 | **Delete Test design** | `docs/architecture/DEPENDENCY-ENFORCEMENT-and-delete-test.md` §2 | Standalone (design; oracle defect — see §5) |
| 5 | **Independent challenge / refutation (author≠verifier)** | `docs/architecture/WAVE1-CHALLENGE.md` | Standalone (authoritative corrections) |
| 6 | **Execution Layer master architecture (founder approval artifact)** | `docs/architecture/neo/00-ARCHITECTURE-execution-layer.md` | Standalone |
| 7 | **Neo node + CI/CD blueprint** | `docs/architecture/neo/01-execution-node-and-cicd.md` | Standalone |
| 8 | **Tailscale + security model blueprint** | `docs/architecture/neo/02-tailscale-and-security.md` | Standalone |
| 9 | **Heartbeat + monitoring blueprint** | `docs/architecture/neo/03-heartbeat-and-monitoring.md` | Standalone |
| 10 | **Future execution layer (multi-node, failover, DR)** | `docs/architecture/neo/04-future-execution-layer.md` | Standalone |
| 11 | **Adversarial challenge (Neo streams)** | `docs/architecture/neo/05-adversarial-challenge.md` | Standalone |
| 12 | **Neo operations + migration runbook** | `docs/architecture/neo/06-neo-node1-operations-and-migration.md` | Standalone |
| 13 | **Execution Infrastructure complete (the two contracts + bootstrap + supervision + CI/CD)** | `docs/architecture/neo/07-execution-infrastructure-complete.md` | Standalone |
| 14 | **Automation strategy** | `docs/architecture/neo/08-automation-strategy.md` | Standalone |
| 15 | **Configuration templates inventory** | `docs/architecture/neo/templates-and-scripts-inventory.md` | Standalone (manifest; the templates themselves are designs, not files on disk) |
| 16 | **Installation assets (bootstrap scripts + launchd plists + ACL + colima)** | `neo/07 §3–§6` + `templates-and-scripts-inventory.md` | **Embedded-only** — specified, not yet materialized under `infrastructure/execution-node/` |
| 17 | **Founder Installation Guide** | `docs/architecture/neo/FOUNDER-INSTALLATION-GUIDE.md` | Standalone |
| — | **`ExecutionProviderPort` + Health-Emission contract (code)** | designed in `neo/07 §2`; target `templates/governance-engine/ports.ts` | **Embedded-only / not built** — no code in `ports.ts` yet |
| — | **`architecture.config.json` · `tsconfig.core.json` · `arch-boundary-guard.mjs` · Gate 5** | designed in `DEPENDENCY-ENFORCEMENT…` | **Not built** — absent on disk |

**Completeness:** the *analysis + design* corpus is complete and largely standalone (15 of 17 deliverables are
standalone docs). What is **embedded-only / not built** is everything executable: the install assets (#16), the two
Core contracts in code, and the entire enforcement layer (config, core-tsconfig, gate, Delete Test, delivery-os CI).
These are exactly the Phase-0/1/2 build items below.

---

## 5. Remaining architectural risks

Consolidated from the Wave-1 challenge + the Neo §9 risk register + the audit F1–F8.

1. **Enforcement is vapor today (the most dangerous gap).** The Repository Principle is enforced by *nothing* on
   disk — no `architecture.config.json`, no `arch-boundary-guard.mjs`, no `tsconfig.core.json`, no Gate 5, no
   delivery-os CI — and `check-os-drift` does not cover this principle, so the kernel-vs-disk gap is itself
   un-gated. (Challenge §6.1 / single most dangerous gap. Kernel wording already corrected; the build closes it.)
2. **The Delete-Test oracle tests the wrong tree (REFUTED as designed).** Its `finance:proof` self-test oracle runs
   against the **vendored, adapter-free copy** under `examples/finance-os-demo/vendor/`, which is structurally
   immune to deleting `templates/governance-engine/adapters/` — so it is **green no matter what you delete**. And
   its "Core builds" `tsc` assertion **cannot run** (no `tsconfig.core.json`). The defense-in-depth is currently
   neither depth nor defense. (Challenge §3b — must redesign the oracle to exercise the tree under deletion.)
3. **The single point of failure (SPOF) — node + founder.** One machine concentrates CI + verify + worker + deploy,
   owned by one person with no on-call. Bounded (off-node dead-man, one-line `runs-on` rollback, durable-bus state,
   backed-up Supabase, a Linux reliability node next) — **not removed** until N≥3 with redundant capability coverage.
   (`neo/00 §9.1`, `neo/04 R1`.)
4. **The solo-SRE residual tax.** Reversibility bounds *blast radius*; it does not reduce the **~14-component
   standing surface**, the MTTR bounded by one human, or availability now capped by that human's availability to
   repair. ~1–3 hrs/week steady, variance-dominated by spiky incidents (~half macOS-laptop-specific). Measured, with
   objective migration trigger 4b at >3 hrs/wk laptop-specific toil. (Challenge §1 / `neo/00 §9.2`.)
5. **The unmanifested governance-engine (F2).** `templates/governance-engine/` appears nowhere in
   `os-foundation.manifest.json` — a *second engine* propagating with no sha-record / no `engine-check` DDL-parity;
   the finance-os-demo vendor copy is a literal hand-copy. This re-creates the exact vendored-engine-drift anti-pattern
   the principle cites. (Audit F2 / challenge §6.2.)
6. **The dangling `goal-progress.mjs` (F3).** `os-foundation.manifest.json:33` lists a tool that does **not exist on
   disk**; os-inherit treats the manifest as the install set, so a fresh consumer `sync` references a missing tool —
   a live `engine:install`/`sync` foot-gun today. (Audit F3 / challenge §6.3.)
7. **Circular ordering (the build cannot start cleanly).** Enforcement's `architecture.config.json` layer paths
   depend on the layout decision; the layout move depends on the manifest being fixed first (F2+F3); the manifest fix
   depends on a founder a/b call — and no stream owns the sequencing. **Resolved explicitly in §6.** (Challenge §6.4.)
8. **The in-flight-work failover caveat.** "Every node replaceable" holds only at the granularity of the *durable,
   checkpointed step* — in-flight work between checkpoints (an LLM call mid-generation, a half-written build) is
   **re-run, not recovered**, bounded by the job `budget` (no double-spend past the cap). The moment a
   `resource_class` is single-homed, that node is a pet again. (`neo/04 §7.2`.)

**Lower-tier (carried, not blocking):** the `resource_class:"macos"/"gpu"` host-vocabulary leak in the Core-owned
port union (challenge §4 — make it opaque); the §44 "zero behavior change" claim unproven until the acceptance test
runs; the Supabase common-mode dependency (halts runtime *and* misattributes the page — Windows pull must probe
`/health` + Supabase directly); the integrity-vs-availability watchdog gap (the dead-man covers a *dead* node, not a
*lying* one); the residential-ISP/power availability ceiling; the no-delivery-os-CI gap that leaves the "binding
re-run on neutral hardware" homeless until CI or the self-hosted runner exists.

---

## 6. THE RECOMMENDED IMPLEMENTATION ORDER (load-bearing)

The challenge's **circular ordering** problem is resolved by making the dependency explicit and sequencing the
prerequisites *before* any Neo build: **founder a/b decision → manifest hygiene → layout split → write the config →
build the gate → build the corrected Delete Test → wire Gate 5 + CI → only then the Execution Infra (M-pre→M7).**
No stream may assume another has landed. Every step is **Build → Independent-Verify → Founder-Review → Merge**,
reversible, with founder ★ gates marked. **GitHub-Actions-minutes reality:** the enforcement gate + Delete Test must
run **cheap/local** (pre-push static gate = tens of ms; Delete Test path-filtered + a local opt-in) until the
self-hosted runner lands — the binding "neutral hardware" re-run has no home in delivery-os until then.

### Phase 0 — Architecture-completion fixes (BEFORE any Neo build)
The prerequisites that break the circular dependency. None touch production; none install infra.
- **0a. Kernel wording — DONE.** `CLAUDE.md §3` no longer claims present-tense enforcement; the principle is stated
  as designed-not-built. (Add this principle to `check-os-drift` coverage in Phase 1.)
- **0b. Manifest hygiene (F2 + F3) — FIRST, and it needs a founder a/b call.**
  - **F2:** register `governance-engine` as a **second `engines[]` entry** (source `templates/governance-engine`,
    its own `INHERITED-<key>.json` sha-record, `ddlParity` over `migrations/0001..0002`) so it propagates and
    drift-checks like the workflow-engine.
  - **F3:** the dangling `goal-progress.mjs` — **founder a/b: remove vs restore. Recommend REMOVE** (the tool was
    never built; `goal-init`/`goal-stop`/`progress-stall` cover the harness).
- **0c. The lighter repo sub-folder split (NOT the full rename).** In-place `templates/tools/{core,adapters,gates}/`
  split + lift the design-only `neo/` docs to a top-level `execution-infrastructure/design/`. Defer the `runtime/`
  engine rename (§2.3).
- **0d. Add `tsconfig.core.json`** (core + contracts only; adapters excluded) — the prerequisite that gives the
  Delete Test's "Core builds" assertion any teeth.
- **0e. Redesign the Delete-Test oracle** to exercise the **tree under deletion** (import `templates/governance-engine`
  directly, or re-vendor from the post-deletion worktree) — not the static, adapter-free vendored copy.
- **0f. Fix the `resource_class` host-leak** in the `ExecutionProviderPort` type design (opaque string / adapter-owned
  vocabulary; drop `"macos"/"gpu"` from the Core union) before the port is built in Phase 2.

### Phase 1 — Enforcement layer (make the boundary structural)
- Write `architecture.config.json` + `architecture.schema.json` (the boundary as data — now possible because the
  layout (0c) is settled).
- Generalize `residency-guard.mjs` → `scripts/arch-boundary-guard.mjs` (pure detector + walk + planted-violation
  `--self-test`); retire the residency rules into the config denylist.
- Wire **Gate 5** into `.githooks/pre-push` (static, free) + add the corrected **standing Delete Test** (path-filtered
  CI + a local `npm run delete-test:*` opt-in).
- **Add this principle to `check-os-drift` coverage** so the kernel can no longer advertise un-built enforcement.

### Phase 2 — Contracts (Core-side, host-agnostic)
- Build the real **`ExecutionProviderPort`** + **`PlacementPort`** in `templates/governance-engine/ports.ts`
  (re-exported via `contracts/execution-provider-port-v1.d.mts`); re-express `runSprint` as a caller; keep
  `DEFERRED_EXECUTOR` as the null-registry no-op. Run the §44 zero-behavior-change acceptance test (don't assert it
  until green).
- Build the **Health-Emission contract** Core-side (`HeartbeatRecord` · `PlatformHealthReport` · `isReady`),
  standardizing on the existing `platform-health.mjs` shape.
- The Delete Test (Phase 1) now arms against the real `execution-infra/` folder the moment it exists.

### Phase 3..N — Execution Infrastructure (the M-pre → M7 order, Neo first)
Each milestone independently reversible (one `runs-on` line or one daemon-unload); ★ = founder gate.
- **M-pre ★** — Neo provisioning + the FileVault/reboot resolution (HOST-3) + instrument the objective migration
  triggers. Nothing on the meter-path yet.
- **M0 ★** — the **safety floor**: off-node watchdog (Healthchecks `/ready`-gated push + Windows-task backup) +
  the worker daemon. Price the M0-only world (≈90% of the minutes saving by deleting the cron, no runner). **Pick the
  tick cadence** (recommend 15–30s, not 5s — 5s is ~60× the cron load on Supabase).
- **M1** — register the **ephemeral runner**; non-required `runs-on:[self-hosted]` duplicate of `ci`; **parity-prove**
  byte-identical verdicts vs GitHub-hosted.
- **M2** — flip **non-binding** checks to the node.
- **M3 ★** — flip **binding** checks one at a time; author≠verifier becomes physical.
- **M4** — wire the heartbeat layers (engine-tick + `engine_heartbeat`, `/health`+`/ready` tailnet-only, KeepAlive +
  log rotation, the GS slot); **add the cold-boot recovery test** (HOST-3).
- **M5 ★** — move **deploy** to the node + stand up permanent staging; make post-deploy health gate binding. **Do
  Ed25519 (SEC-3) + the co-equal deploy-token control (HOST-2) BEFORE this lands as the standing path.**
- **M6** — ship the `ExecutionProviderPort` registration end-to-end; route a real `verify`-kind job by policy; prove a
  3rd **mock** adapter takes a job by changing only `placement_req`/labels (zero PO change).
- **M7** — repeat M1–M5 for **PLOS** (per-repo); add the **Linux reliability node** when its driver fires
  (reliability before re-seat).

---

## Appendix — provenance

This overview synthesizes, without re-designing: the ratified Repository & Dependency Principle; the Repository Audit
(22 subsystems, F1–F8); the Dependency Enforcement + Delete Test design; the Wave-1 Challenge (ACCEPT-WITH-CHANGES —
the authoritative corrections); and the Neo execution-layer corpus (`neo/00`–`08` + the templates/scripts inventory +
the Founder Installation Guide). It folds in the challenge's must-fix list (kernel wording, the Delete-Test oracle,
`tsconfig.core.json`, manifest hygiene F2+F3, the lighter layout, the `resource_class` opacity, and the explicit
circular-ordering resolution). It changes no code and installs nothing; an independent §11 panel ratifies
(author≠verifier) and a founder gate authorizes before any build. Where this file disagrees with a canonical source
under `core/` or a detail doc, the canonical source wins — fix this file.

*End of Master Architecture Overview — synthesis only; closes the architecture phase.*
