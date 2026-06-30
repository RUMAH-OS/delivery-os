# Delivery OS — Repository Audit: Subsystem Map, Dependency Graph & Layout Recommendation

**Date:** 2026-06-30
**Type:** READ-ONLY architecture audit. No code changed; no install performed. This document is the only artifact.
**Principle under test:** `docs/architecture/PRINCIPLE-repository-and-dependency-rule.md` (ratified 2026-06-30) — the Dependency Rule (Clean/Hexagonal, inward-only), the two boundaries (Platform⇄consumer = REPO; subsystem⇄subsystem = DEPENDENCY), and the discriminator *"could two consumers share it?"*
**Builds on (re-verified, not redone):** `docs/reviews/PLATFORM-EXTRACTION-AUDIT-2026-06-29.md` (the prior dependency-graph audit — found the runtime direction CLEAN but the governance organs un-extracted).

> **Headline since the prior audit:** the single biggest gap the 2026-06-29 audit flagged — *"there is no `templates/governance-engine/`, no `GoalStorePort`, no `createGovernanceRuntime`; the extraction is NOT STARTED"* — **has been built.** `templates/governance-engine/` now exists (32 files: organs + ports + reference Postgres adapter + migrations + a residency-guard + self-tests), and a **second-consumer portability proof** ships at `examples/finance-os-demo/` (a finance domain + a PLOS-lead domain, on an in-memory store, with ZERO admin code). The platform's central claim moved from *aspirational* to *demonstrated*. What remains is **not** a dependency-direction violation — it is **enforcement wiring** and **manifest/propagation hygiene**, detailed in §3–§4.

---

## 1. Subsystem map

Walked the full tree. Layers per the Dependency Rule: **Core/Runtime** · **Contracts/Ports** · **Adapters** · **Templates (vendorable slice)** · **Tooling/Governance** · **Documentation**. "Reusable?" = could a brand-new consumer obtain it without copying consumer code.

| # | Subsystem | Folder(s) | Layer | Platform / Consumer | Reusable? |
|---|---|---|---|---|---|
| 1 | **Workflow Engine (C11 bus)** | `templates/workflow-engine/` (engine.ts, state-machine, schema, handlers, agent-runner, goals-route, approvals-route, verifiers, capability-pack/-selector, migrations/) | **Core/Runtime** | platform | YES — proven on 2 consumers |
| 2 | **Workflow Engine contracts/ports** | `templates/workflow-engine/contracts/approvals-v1.ts`; `EngineContext`/`DbLike`/`EngineTables`/`HumanPrincipalPort` declared in `engine.ts`, `human-principal.ts` | **Contracts/Ports** | platform | YES |
| 3 | **Governance Engine (the goal OS)** | `templates/governance-engine/` — 14 organs (po-autoloop, reconciler, goal-supervisor, sprint-engine, completion-review, preflight, reachability-evaluator, boundary-plan, founder-summon, goal-intake, metric-probe, goal-contract, state-machine, runtime) + `runtime.ts` `createGovernanceRuntime` | **Core/Runtime** | platform | YES — NEW since prior audit; proven by finance-os-demo |
| 4 | **Governance Engine ports** | `templates/governance-engine/ports.ts` — `GoalContractStorePort`, `RuntimeStoresPort`, `ProbeReaderPort`, `ConfigReadinessPort`, `NotifierPort`, `FounderBindingPort` | **Contracts/Ports** | platform | YES |
| 5 | **Governance reference Postgres adapter** | `templates/governance-engine/adapters/postgres/` (connection, goal-contract, runtime-stores, probe-reader, plane) — imports `postgres`, holds the raw SQL / `pg_advisory_xact_lock` | **Adapter** | platform (reference) / consumer-owned in production | YES (as a copy-in reference) |
| 6 | **Governance migrations + cages** | `templates/governance-engine/migrations/` (0001 goal_contract, 0002 runtime stores), `golden-master.ts`, `runtime-stores-cage.ts`, `state-machine.ts` | **Contracts/Ports** (invariant spec) | platform | YES |
| 7 | **Build-time goal harness** | `templates/tools/goal-init.mjs`, `goal-stop.mjs`, `progress-stall.mjs`, `stall-classify.mjs`, `boundary-classify.mjs`, `change-classify.mjs` | **Core/Runtime** (build-time session governor) | platform | YES |
| 8 | **Verification / gate tooling** | `skills/verify-gate/`, `templates/hooks/verify-gate.mjs`, `.claude/hooks/verify-gate.mjs`, `templates/tools/verify-coverage-ci.mjs`, `verify-independence-ci.mjs`, `verify-fingerprint.mjs`, `verified-tree.mjs` | **Tooling/Governance** | platform | YES |
| 9 | **Config / readiness / deploy / rollback tools** | `templates/tools/` — `i-config.mjs`, `config-doctor.mjs`, `deploy-lane.mjs`, `deployment-auth.mjs`, `rollback-helper.mjs`, `post-deploy-verify.mjs`, `*.schema.json` | **Adapter** (Vercel+Supabase+`gh` plane) | platform (on-plane) | YES on-plane |
| 10 | **Observability / platform-health** | `templates/tools/platform-health.{mjs,d.mts,schema.json}`, `agent-health.mjs`, `smoke.mjs` | **Adapter** (Monitoring) | platform | YES |
| 11 | **Execution Infrastructure (Neo node / CI-CD / Tailscale)** | `docs/architecture/neo/` (7 design MDs) + `docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md` | **Adapter** | platform | **DESIGN-ONLY — no code; `ExecutionProviderPort` not built** |
| 12 | **Slack control surface** | — (seam = `goals-route.ts`; notifier port defined) | **Adapter** | platform | **NOT BUILT** (only the `NotifierPort` seam + a notify webhook) |
| 13 | **Cross-system seam/inventory contracts** | `contracts/admin-plos-seam-v1.mjs`, `inventory-properties-v1.{mjs,d.mts}`, `deployment-auth-v1.mjs` | **Contracts/Ports** | platform-owned; #1–#2 name specific consumer domains | YES (vendored byte-identical) |
| 14 | **Capability framework + ledger** | `capabilities/` (CAPABILITY-LEDGER, manifests, *.capability.json, os-foundation.manifest.json, signals.jsonl) | **Tooling/Governance** | platform | YES |
| 15 | **Skills (process organs)** | `skills/` (28 dirs) — verify-gate, learning-review, repo-governance, ci-release-orchestrator, principle-11-review, founder-action/review-package, migration-assessment, discovery-interview, … | **Tooling/Governance** | platform | YES |
| 16 | **Agents** | `agents/` (lean default + pack roles + integration-architect, founder-experience-reviewer, deployment-operator); `.claude/agents/` | **Tooling/Governance** | platform | YES |
| 17 | **Core doctrine (the kernel)** | `core/` (OPERATING-LOOP, DEFINITION-OF-DONE, GOVERNANCE §1–§12, SEVERITY) | **Core/Runtime** (doctrine) | platform | YES |
| 18 | **Propagation / drift tooling** | `templates/tools/os-inherit.mjs`, `os-sync.mjs`, `check-os-drift.mjs`, `render-kernel.mjs`, `check-hook-paths.mjs`; `.claude/tools/*`; `.githooks/pre-push` | **Tooling/Governance** | platform | YES |
| 19 | **Vendorable doc/template slice** | `templates/*.md(.template)`, `CLAUDE.md.template`, `commands/`, `hooks/`, `githooks/`, `workflows/`, `runbooks/`, `memory/`, `test-harness/` | **Templates** | platform | YES |
| 20 | **Domain packs / processes / checklists** | `domain-packs/`, `processes/`, `checklists/`, `discovery/` | **Templates / Documentation** | platform | YES |
| 21 | **Portability example apps** | `examples/engine-demo-app/` (workflow-engine proof), `examples/finance-os-demo/` (governance-engine proof — finance + lead domains, vendored copy) | **Documentation** (executable proof) | consumer-SHAPED, but demo-only (not shipped, not manifested) | n/a (proof) |
| 22 | **Knowledge / history** | `proposals/`, `case-studies/`, `wiki/` (ku-*), `docs/{adr,reviews,review,feedback,execution,migration,audits,verify,goals,founder-burden,architecture,archive}/`, CHANGELOG-v2..v5 | **Documentation** | platform | YES |

**Subsystem count: 22.**
**Layer breakdown:** Core/Runtime = 5 (#1,#3,#7,#17 + harness) · Contracts/Ports = 4 (#2,#4,#6,#13) · Adapters = 4 (#5,#9,#10,#11/#12 — two of which are **design-only/not-built**) · Templates = 2 (#19,#20) · Tooling/Governance = 5 (#8,#14,#15,#16,#18) · Documentation = 2 (#21,#22).

---

## 2. Platform vs consumer classification (the discriminator)

Applying *"could two different consumers share it?"* to every subsystem above:

- **Platform (generic / domain-agnostic) — all of #1–#20, #22.** Each is either the mechanism (engines, harness, tools), the doctrine (core, skills, agents), or the contracts/templates a consumer vendors. The discriminator is satisfied directly by the two live consumers (rumah-admin, PLOS) plus the two demo consumers.
- **Consumer-SHAPED but demo-only — #21 (`examples/`).** `examples/finance-os-demo/src/finance-domain.ts` and `plos-lead-domain.ts` define *business* domains (MRR, invoices-collected, lead-bonus) — domain-bound by the discriminator. **But they are illustrative proofs, not products:** they are not in `os-foundation.manifest.json`, not vendored anywhere, and exist precisely to demonstrate that the platform engine accepts a domain it has never seen. Their header is explicit: *"FINANCE OS — the consumer's OWN domain… IMPORTS: ONLY the vendored governance-engine barrel. ZERO rumah-admin / property-lead-os imports."* This is the in-repo **Delete-Test analogue** and is acceptable.

**No production consumer code lives in delivery-os.** Confirmed: the only domain-bound code is the two demo apps under `examples/`, which exist as portability proofs. The named-consumer *contracts* (`admin-plos-seam-v1.mjs`, `inventory-properties-v1.mjs`) are platform-owned seam *definitions* (zero-dependency, vendored byte-identical to both sides) — they name consumers but contain no consumer logic; this is the correct home for a cross-consumer seam.

---

## 3. Dependency-direction verification

**Re-verified against the NEW taxonomy (the governance-engine did not exist at the prior audit).**

### 3.1 Core imports nothing outward — VERIFIED CLEAN
- **Workflow engine:** grep of `templates/workflow-engine/**.ts` for `governance-engine`, `/tools/`, `postgres`, `vercel`, `tailscale`, `slack` → **zero code hits** (only the loose `DbLike` injected via `EngineContext`, `engine.ts:49-67`). Core knows no concrete DB.
- **Governance engine organ surface:** the `residency-guard.mjs` (the principle's "dependency-direction gate") run against `templates/governance-engine/` returns **`CLEAN — no residency violations`** across 32 files; its `--self-test` passes **5/5** (it proves each detector fires on planted `./db/client.js` / `postgres` / `execFileSync` offenders). Every `postgres`/`db/client` string in the organ surface is inside a **comment**, not an import. Durable I/O crosses `GoalContractStorePort` / `RuntimeStoresPort`.
- The only real `import postgres` lines live in `templates/governance-engine/adapters/postgres/{connection,runtime-stores,probe-reader}.ts` — the **sanctioned reference adapter**, which `residency-guard` excludes by design (`SKIP_DIR` includes `adapters`). This is the outer layer, correctly isolated.

### 3.2 No platform → consumer dependency — VERIFIED CLEAN
The prior audit's Rule-A proof (zero code imports of `rumah-admin`/`property-lead-os`/`@plos` in delivery-os) still holds and now extends to the new governance-engine: its files import only sibling `./*.js` and `./ports.js`. The finance-os-demo imports only its own vendored `../vendor/governance-engine/index.js` — no reach back into delivery-os source.

### 3.3 Adapters consume only contracts — VERIFIED
The reference Postgres adapter implements `RuntimeStoresPort`/`GoalContractStorePort` via injected `sql` factories (`createPostgresRuntimeStores(sql)`), never importing an organ's internals. Dependencies flow strictly inward: adapter → port → core.

**Verdict: ZERO dependency-direction violations in either direction.** The architectural invariant is intact by construction for the runtime; the open items below are enforcement-wiring and hygiene, not direction breaches.

---

## 4. Coupling & ambiguity findings (ranked)

**F1 — HIGH — The principle's enforcement is BUILT but NOT WIRED ("remembered, not enforced").**
The principle's §Enforcement mandates two structural checks: the **dependency-direction gate** (residency-guard, generalized) and the **standing Delete Test**.
- `templates/governance-engine/residency-guard.mjs` exists and works, but **no CI workflow or git hook invokes it.** `.githooks/pre-push` runs four gates (verify-gate, check-os-drift, agents-check, check-hook-paths) — **residency-guard is not among them**; `grep -rln residency-guard` over `templates/workflows`, `.githooks`, `.claude`, `scripts` returns only the guard's own file. delivery-os has **no `.github/workflows/`** of its own (CI lives only as vendorable *templates* under `templates/workflows/`).
- The **Delete Test is not implemented** as a standing CI job anywhere (`grep` for "Delete Test"/"delete-test" → none). The finance-os-demo is a *manual* analogue, not an automated gate.
- **Effect:** the boundary is currently "true by discipline + a guard nobody runs," which is exactly the failure mode the principle (and the North Star §12) exists to prevent. **Wire residency-guard into `.githooks/pre-push` and into `templates/workflows/` (a `dependency-direction.yml` + a `delete-test.yml`).**

**F2 — HIGH — The governance-engine is UNMANIFESTED — a second engine with no propagation or drift lock.**
`capabilities/os-foundation.manifest.json` declares exactly **one** engine (`workflow-engine`, with an `INHERITED-engine.json` sha-record + `os-inherit engine-check` DDL-parity gate). `templates/governance-engine/` appears **nowhere** in the manifest (`grep -c governance-engine` → 0) — not in `engines`, `tools`, or `contracts`. Consequently:
- `os-inherit sync`/`engine-check` will neither install nor drift-guard it; `check-os-drift.mjs` doesn't know it exists.
- The `examples/finance-os-demo/vendor/governance-engine/` copy is a **hand-copy with no sha-record / no `engine-check`** — precisely the cross-repo "vendored-engine drift" class the principle cites as the reason to enforce by gate. A real second consumer would fork the same way.
- **Fix:** add `governance-engine` as a second `engines[]` entry (source `templates/governance-engine`, its own `INHERITED-<key>.json`, `ddlParity` over `migrations/0001..0002`), so it propagates and drift-checks exactly like the workflow-engine.

**F3 — MEDIUM — Dangling manifest entry: `goal-progress.mjs` is listed but absent on disk.**
`os-foundation.manifest.json:33` lists `templates/tools/goal-progress.mjs`; the file **does not exist** (`ls` → No such file). os-inherit treats the manifest as the install set, so a fresh `sync` would reference a missing tool. (`goal-init`, `goal-stop`, `progress-stall` exist; `goal-progress` is the phantom.) **Fix:** remove the entry or restore the tool.

**F4 — MEDIUM-HIGH — `templates/` overloads the "vendorable Runtime" with infra adapters, gates, and doc templates — blurring the Core/Adapter line.**
The principle says explicitly: *"Place Execution Infrastructure in its own top-level folder (not under `templates/`, which is the vendorable Runtime — a different kind of artifact)."* Today `templates/` mixes four distinct artifact classes under one roof:
- **Core/Runtime engines** (`workflow-engine/`, `governance-engine/`),
- **Adapters** to the Vercel+Supabase+`gh` plane (`tools/i-config.mjs`, `rollback-helper.mjs`, `deploy-lane.mjs`, `post-deploy-verify.mjs`),
- **Governance gates + build-time harness** (`tools/verify-coverage-ci.mjs`, `goal-init.mjs`, `render-kernel.mjs`),
- **Doc/CI templates** (`*.md.template`, `workflows/`, `githooks/`, `runbooks/`).
`templates/tools/` is a 64-file grab-bag where a plane-bound adapter (`i-config.mjs`) sits beside a Core harness tool (`goal-init.mjs`) beside a CI gate (`verify-coverage-ci.mjs`), with nothing in the path signalling layer. A future contributor cannot tell from the folder which tools are infrastructure-agnostic Core and which are plane Adapters — the exact ambiguity the principle wants removed. (See §5.)

**F5 — LOW-MEDIUM — The reference Postgres adapter ships *inside* the Core package directory.**
`templates/governance-engine/adapters/postgres/` is an outer-layer **Adapter** physically nested in the Core engine package. It is correctly fenced (residency-guard `SKIP_DIR`), and shipping a reference adapter is defensible — but an Adapter living inside Core invites scope-creep (a contributor adding "just one more query" inside the engine package). Consider hoisting it to a sibling (`governance-engine-adapters/postgres/`) or clearly marking it `adapters/` as "vendor-and-replace, not part of the Core surface" (the README already says so; make it structural).

**F6 — LOW — `$schema` sibling-path blemish (carried from prior audit) is consumer-side; the schema home in delivery-os is correct.**
The prior audit's `$schema → ../delivery-os/templates/tools/config-registry.schema.json` sibling-checkout coupling lives in the **consumer** registries (rumah-admin/PLOS `infra/config-registry.json`), not in delivery-os. Within delivery-os the schemas are canonically homed at `templates/tools/*.schema.json`. Worth fixing where it lives (vendor the schema beside each consumer's registry), but it is not a delivery-os-layout defect.

**F7 — LOW — Documentation folder-naming overlap.** `docs/review/` (singular) and `docs/reviews/` (plural) coexist as distinct folders with overlapping intent (foundation/founder review packages vs architecture-validation reviews). Minor retrieval ambiguity; consolidate to one.

**F8 — LOW — Two unbuilt Adapters advertised by the principle.** `ExecutionProviderPort` (Execution Infrastructure) is **design-only** (`docs/architecture/neo/`, 7 MDs, zero code) and the **Slack control surface** is unbuilt (only `NotifierPort` + a notify webhook). The principle lists both as platform Adapters; they are honestly absent, not mis-placed. Track as designed-not-built so the map stays truthful.

---

## 5. Recommended repository layout

**Intent:** make the Core / Contracts / Adapters / Templates boundary *legible from the path*, so a contributor cannot accidentally put plane-bound infra inside the vendorable Runtime, and cannot grow an Adapter inside Core. The repository stays **one repo** (the principle's whole point); the change is **intra-repo folder topology + enforcement wiring**, not a repo split.

### 5.1 Target top-level shape

```
delivery-os/
  core/                      # doctrine (loop · DoD · governance · severity) — unchanged
  runtime/                   # the VENDORABLE Runtime — Core + Contracts only (today: templates/*-engine/)
    workflow-engine/         # ← moved from templates/workflow-engine/
    governance-engine/       # ← moved from templates/governance-engine/  (organs + ports + migrations + cages)
  adapters/                  # OUTER layer — consume runtime ONLY via ports. Never depended-upon by runtime.
    governance-postgres/     # ← hoisted out of governance-engine/adapters/postgres/  (F5)
    plane-vercel-supabase/   # ← i-config · rollback-helper · deploy-lane · post-deploy-verify · *.schema.json (F4)
    monitoring/              # ← platform-health · agent-health · smoke
  execution-infrastructure/  # ← NEW top-level for the Neo/Docker/Tailscale runner (principle §"Concrete implications")
    design/                  # ← docs/architecture/neo/ (until the ExecutionProviderPort + runner are built)
  tooling/                   # build-time governance (NOT vendored Runtime): the gates + harness + propagation
    harness/                 # goal-init · goal-stop · progress-stall · *-classify   (build-time session governor)
    gates/                   # verify-coverage-ci · verify-independence-ci · check-os-drift · check-hook-paths
    propagation/             # os-inherit · os-sync · render-kernel
  contracts/                 # cross-consumer seam + projection contracts — unchanged (platform-owned)
  skills/  agents/  processes/  checklists/  domain-packs/  discovery/   # process organs + doctrine — unchanged
  templates/                 # ONLY copy-in scaffolding artifacts: *.md.template · CLAUDE.md.template · commands/ · workflows/ · githooks/ · runbooks/ · memory/
  examples/                  # portability proofs (engine-demo-app, finance-os-demo) — unchanged
  docs/  proposals/  case-studies/  wiki/  capabilities/                # knowledge + history — unchanged
```

The discriminating rule a contributor can apply by eye: **`runtime/` = infrastructure-agnostic, vendored byte-identical, imports nothing outward; `adapters/` = plane-bound, imports a port; `tooling/` = runs at build/CI time, never vendored into a consumer's app; `templates/` = inert files copied at scaffold.**

### 5.2 Migration delta from today (minimal, mechanical)

| Move | From → To | Why |
|---|---|---|
| `templates/workflow-engine/`, `templates/governance-engine/` | → `runtime/` | name the vendorable Runtime distinctly from scaffolding (F4) |
| `templates/governance-engine/adapters/postgres/` | → `adapters/governance-postgres/` | Adapter out of the Core package (F5) |
| `templates/tools/{i-config,config-doctor,rollback-helper,deploy-lane,post-deploy-verify,deployment-auth}.mjs` + `*.schema.json` | → `adapters/plane-vercel-supabase/` | plane-bound infra out of the Runtime grab-bag (F4) |
| `templates/tools/{platform-health,agent-health,smoke}.*` | → `adapters/monitoring/` | Monitoring adapter |
| `templates/tools/{goal-init,goal-stop,progress-stall,*-classify}.mjs` | → `tooling/harness/` | build-time session governor |
| `templates/tools/{verify-*-ci,check-os-drift,check-hook-paths}.mjs` + `os-inherit/os-sync/render-kernel` | → `tooling/gates/` + `tooling/propagation/` | gates ≠ vendored Runtime |
| `docs/architecture/neo/` | → `execution-infrastructure/design/` | principle's explicit instruction; reserve the folder for the runner when built |

**Path-reference cost (the honest part):** these moves touch every path string in `capabilities/os-foundation.manifest.json`, `.githooks/pre-push`, `render-kernel.mjs`/`check-os-drift.mjs`, the engine `INHERITED-*.json` records, and consumer `os-inherit --from` wiring. This is a **coordinated, gated rename**, not a free move — it should run as its own slice behind the verify-gate, with the manifest updated atomically. If the full rename is judged too costly now, the **minimum** to remove the worst ambiguity (and satisfy the principle's letter) is the two highest-value moves: lift **Execution-Infrastructure to a top-level folder** (cheap — it is design-only docs) and **split `templates/tools/` plane-adapters from the Core harness** (a sub-folder split inside `templates/tools/` — `tools/core/`, `tools/adapters/`, `tools/gates/` — is a lighter alternative that achieves the legibility without the cross-repo path churn).

### 5.3 Enforcement to ship alongside the layout (closes F1, F2, F3)

1. **Wire `residency-guard.mjs` into `.githooks/pre-push`** (Gate 5) and add `templates/workflows/dependency-direction.yml` so the dependency-direction gate runs in CI for every consumer too.
2. **Add a standing Delete-Test CI job** (`templates/workflows/delete-test.yml`) that removes `adapters/` (and the execution-infrastructure folder) and asserts `runtime/` still type-checks and the ports still resolve — the automated twin of the finance-os-demo proof.
3. **Register `governance-engine` as a second engine** in `os-foundation.manifest.json` (sha-record + `engine-check` DDL-parity over its `migrations/`), so the finance-os-demo vendor copy and any future consumer is drift-locked, not hand-copied.
4. **Remove/restore the dangling `goal-progress.mjs`** manifest entry.

---

## 6. Summary

- **22 subsystems.** Layer breakdown: **Core/Runtime ≈5, Contracts/Ports ≈4, Adapters ≈4 (two of them design-only/unbuilt: Execution Infrastructure + Slack), Templates ≈2, Tooling/Governance ≈5, Documentation ≈2.**
- **Dependency direction: ZERO violations** in either direction. The new `governance-engine` organ surface is residency-guard-CLEAN (self-test 5/5); workflow-engine imports nothing outward; no platform→consumer code import; the only `postgres` imports are in the sanctioned reference adapter. The prior audit's clean verdict holds and now extends to the freshly-extracted governance engine.
- **No production consumer code in delivery-os.** The only domain-bound code is the two demo apps under `examples/` (portability proofs, unmanifested, not shipped).
- **Top findings:** (F1) the principle's enforcement — residency-guard + Delete Test — is **built but not wired** into any hook/CI; (F2) the new **governance-engine is unmanifested**, so a second engine propagates with no sha-record/drift gate (the finance-os-demo copy is a hand-copy); (F3) a **dangling `goal-progress.mjs`** manifest entry; (F4) `templates/` **overloads** the vendorable Runtime with plane-adapters, gates, and doc templates, blurring Core vs Adapter.
- **Layout recommendation headline:** keep the **one repository**, but make the layers legible by path — split the vendorable **`runtime/`** (workflow + governance engines) from a top-level **`adapters/`** (Postgres, Vercel/Supabase plane, monitoring), a top-level **`execution-infrastructure/`** (per the principle's explicit instruction, currently design-only), and a **`tooling/`** tree (harness + gates + propagation) — leaving `templates/` for inert scaffolding only. Then **wire the residency-guard + a standing Delete Test into pre-push/CI** so the boundary is guaranteed by construction, not by discipline.

*Audit performed read-only on 2026-06-30. All paths and line ranges are as found on disk that day. Repo: `C:\Users\brian\RUMAH\delivery-os`.*
