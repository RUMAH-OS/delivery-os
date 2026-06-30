# Delivery OS — Dependency Enforcement & the Standing Delete Test

**Status:** DESIGN (no code, nothing installed). The enforcement layer for
`PRINCIPLE-repository-and-dependency-rule.md`.
**Author:** lead-architect (design only — author≠verifier; this needs an independent VERIFY before any build).
**Date:** 2026-06-30.

> The Repository Principle says: one repo, many subsystems, the architecture preserved by **enforced
> dependency rules**, not by repo splits. A principle in a document decays. This design makes the boundary
> **structural** — true by construction, caught the instant it is crossed — via two checks that generalize
> patterns already proven on disk:
>
> 1. **the dependency-direction gate** — `residency-guard.mjs` (the no-concrete-DB import detector),
>    generalized from "one folder, three forbidden patterns" into a repo-wide architectural-boundary linter
>    driven by a declarative config.
> 2. **the standing Delete Test** — the CI twin of `CONSUMER-INDEPENDENCE-PROOF-2026-06-29.md` (which proved
>    a deleted *consumer* leaves Core intact), turned inward: delete an *adapter subsystem* and assert Core
>    still builds, the Contracts still resolve, and the Core self-tests still pass.
>
> Both are **data-driven** off a single `architecture.config.json` so the boundary is configuration, not
> rules scattered across scripts. Both plug into the existing `delivery-os` enforcement (the
> `core.hooksPath` pre-push + CI). The static gate is free (milliseconds, every push); the Delete Test is
> the expensive one and is designed to stay cheap (path-filtered CI + the future self-hosted runner +
> a local opt-in).

---

## 0. What already exists (the patterns being generalized)

| Existing artifact | What it proves | What this design reuses |
|---|---|---|
| `templates/governance-engine/residency-guard.mjs` | a fail-closed, zero-dep, self-testing import detector over one folder + a forbidden list | the **shape**: pure `detect(files)` → findings, `walk()`, `--self-test` with planted offenders, exit 1 on violation |
| `examples/finance-os-demo/scripts/scan-zero-admin-imports.mjs` | a **transitive** import walk that resolves each `.js` specifier to a concrete file and classifies it | the **resolver + transitive walk** for the direction gate |
| `scripts/check-no-backflow.mjs` | a repo-wide, folder-scoped lint already run framework-side | the **repo-wide scoping** convention |
| `.claude/tools/check-os-drift.mjs` | a read-only "the kernel cannot lie" gate, wired into pre-push | the **gate ergonomics** (warn vs. fail, one-line verdict) |
| `.githooks/pre-push` (via `git config core.hooksPath`) | the committed, model-independent pre-push backstop (Gates 1–4) | the **wiring point** — this adds Gate 5 |
| `docs/reviews/CONSUMER-INDEPENDENCE-PROOF-2026-06-29.md` | delete the consumer → Core survives (proven manually, once) | the **Delete-Test template**, now standing + inward |

The residency-guard is the proven model: it already enforces *part* of dependency-rule #1 (Core imports no
`postgres`/`pg`, no `db/client`, no `execFileSync` of a relative tool) over `templates/governance-engine/`.
This design **subsumes and generalizes it**: the residency rules become three rows of the infra-SDK denylist
for the `core`/`contracts` layers, and the scope widens from one folder to the whole repo's layer map.

---

## 1. The dependency-direction gate

### 1.1 What it asserts (the invariant, from the principle)

Dependencies flow **strictly inward**: `adapter → contract → core`, never outward.

| Rule | Encoded as |
|---|---|
| Core imports nothing outward | `core.mayImport = ["core", "contracts"]` |
| Core imports no infra SDK | `core.denyInfraSdk = true` |
| Contracts import only Core | `contracts.mayImport = ["core", "contracts"]`, `denyInfraSdk = true` |
| Adapters consume Core **only via Contracts** | `adapters.mayImport = ["contracts", "adapters"]` (NOT `core`) |
| Adapters may use infra SDKs | `adapters.denyInfraSdk = false` |
| Consumers are out-of-repo | no consumer layer in-repo; vendored copies under `examples/` are excluded |

Two distinct violation classes, one gate:

- **a direction violation** — a file in layer L imports a file the matrix forbids for L (e.g. a Core organ
  imports an adapter file; an adapter reaches a Core internal instead of going through a Contract).
- **an infra-SDK violation** — a file in a `denyInfraSdk` layer imports a denylisted infrastructure package
  (Neo / Docker / dockerode / Tailscale / GitHub-Runner SDK / Slack SDK / `postgres` / `pg` / a `runner`).

### 1.2 Detection

Single pass, hybrid static analysis (regex-extract specifiers → resolve relative ones to a layer):

1. **Enumerate** every source file under the configured layer folders (`.ts .tsx .mts .cts .js .mjs .cjs`),
   skipping `node_modules .git dist build` and the `examples/**` vendored/consumer trees.
2. **Classify** each file into a layer by longest-prefix folder match against the config. A file matched by a
   layer's `exclude` is reassigned (e.g. `templates/governance-engine/**` is `core`, but
   `templates/governance-engine/ports.ts` and `.../adapters/**` are re-pinned to `contracts` / `adapters`).
   Files in no layer are **unclassified** → not gated (docs, `scripts/`, `.claude/tools/`).
3. **Extract import specifiers** per file — static `import`/`export … from "x"`, side-effect `import "x"`,
   `require("x")`, and **string-literal** `import("x")`. Comments are stripped first (block then line), exactly
   as `scan-zero-admin-imports.mjs` does, so prose like the word `postgres` in a comment never trips the gate.
4. **For each specifier:**
   - **relative** (`./` `../`) → resolve to a concrete file (the finance-scan resolver: try `.ts/.tsx`,
     `base.ts`, `index.ts`, ESM `.js`→`.ts`), classify the target's layer, and check the **edge**
     `(fromLayer → toLayer)` against `fromLayer.mayImport`. Not allowed ⇒ a **direction violation**.
   - **bare** (a package) → if `fromLayer.denyInfraSdk`, test the specifier against `infraSdkDenylist`
     (exact name or scope glob). Match ⇒ an **infra-SDK violation**. (Bare specifiers in adapter layers are
     allowed — that is where the SDKs legally live.)
5. **Verdict:** any finding ⇒ exit 1 (fail-closed, like the residency-guard); clean ⇒ exit 0.

The detector is a **pure function** `detectBoundaryViolations(files, config) → findings[]`, separate from
the filesystem walk — so the self-test plants offenders in memory, with no disk I/O (the residency-guard
pattern, kept).

### 1.3 Output (contributor-facing — tells you exactly which rule you broke)

```
arch-boundary-guard — dependency-direction + infra-SDK over the layer map
scope: <repo>  (142 files: core 38, contracts 9, adapters 12, unclassified 83)

  !!! [direction] templates/governance-engine/goal-supervisor.ts:14
      CORE must import nothing outward — this imports an ADAPTER file.
      rule: core.mayImport = [core, contracts]; got edge core → adapters
      offending: import { dockerRun } from "./adapters/postgres/plane.js";
      fix: depend on a CONTRACT (a port in ports.ts), and let the adapter implement it.

  !!! [infra-sdk] templates/governance-engine/reconciler.ts:3
      CORE is infrastructure-agnostic — it may not import an infra SDK.
      rule: core.denyInfraSdk = true; matched denylist entry "dockerode"
      offending: import Docker from "dockerode";
      fix: move the SDK use behind an ExecutionProviderPort adapter; Core takes the port.

  VIOLATION — 2 boundary offender(s). Dependencies must flow inward: adapter → contract → core.
```

### 1.4 How it self-tests (planted violation → caught)

`node scripts/arch-boundary-guard.mjs --self-test` feeds the pure detector a fixed in-memory fixture and a
synthetic config, asserting each detector fires on its planted offender and stays silent on the clean controls:

```js
const planted = [
  // direction: a Core organ reaching into an adapter
  { path: "templates/governance-engine/core-bad.ts",
    content: `import { x } from "./adapters/postgres/plane.js";` },          // → [direction] core→adapters
  // infra-SDK: a Core organ importing a denylisted SDK
  { path: "templates/governance-engine/core-bad2.ts",
    content: `import Docker from "dockerode";` },                            // → [infra-sdk] dockerode
  // direction: an adapter reaching a Core INTERNAL instead of a contract
  { path: "templates/governance-engine/adapters/postgres/bad.ts",
    content: `import { tick } from "../../reconciler.js";` },               // → [direction] adapters→core
  // clean controls (must NOT trip):
  { path: "templates/governance-engine/core-good.ts",
    content: `import type { GoalState } from "./state-machine.js";` },       // core→core: OK
  { path: "templates/governance-engine/adapters/postgres/good.ts",
    content: `import type { Port } from "../../ports.js";\nimport pg from "postgres";` }, // adapter→contract + SDK: OK
  { path: "templates/governance-engine/comment.ts",
    content: `// historically this imported "dockerode" — comment only` },   // comment: must NOT trip
];
```

Asserts: 3 violations caught (`direction core→adapters`, `infra-sdk dockerode`, `direction adapters→core`),
0 on the three clean controls. Exit 1 if any assertion fails — so the gate's own correctness is itself gated.
This planted-violation harness is the proof the gate works, and it is wired as a CI step so a future refactor
that breaks the detector fails the build.

---

## 2. The standing Delete Test

The inward twin of the consumer-independence proof. That proof deleted a **consumer** and showed Core
survived; this deletes an **adapter subsystem** and shows the same — automated, per-subsystem, standing in CI.

### 2.1 What it runs (per subsystem)

1. **Materialize a throwaway copy** — `git worktree add --detach .delete-test/<subsystem> HEAD` (cheap, no
   re-clone; auto-removed after). A worktree, not the live tree, so a contributor's working copy is never
   mutated.
2. **Remove the subsystem folder(s)** listed in the matrix (`rm -rf` inside the worktree only).
3. **Assert "Core builds"** — `tsc --noEmit` against a Core-only tsconfig that includes **only** the `core` +
   `contracts` layer folders and **excludes** every adapter folder ⇒ **0 errors**. "Core builds" means
   concretely: every Core/Contract file type-resolves with all adapter folders absent — i.e. no Core file had a
   compile-time dependence on the deleted subsystem. (A direction violation that the static gate somehow missed
   surfaces here as an unresolved-import compile error.)
4. **Assert "Contracts resolve"** — the contracts entrypoints (`templates/governance-engine/ports.ts`,
   `contracts/**`) typecheck standalone with the subsystem gone (they may import only Core, which is present).
5. **Assert "Core self-tests pass"** — run the in-memory governance proof, which exercises the full Runtime on
   **in-memory ports with the concrete adapters absent**: `examples/finance-os-demo → npm run finance:proof`
   (GREEN 10/10) + `npm run scan:zero-admin` (CLEAN). This is the existing, already-green proof reused as the
   Core liveness oracle — it runs a real goal to DONE and a real stall to HALTED+summon with **zero** concrete
   infrastructure, which is exactly "Core works without the adapter."
6. **Verdict:** all green ⇒ the boundary held *by construction* for that subsystem. Any red ⇒ Core had a hidden
   dependence on the deleted adapter (the failure the test exists to catch). Remove the worktree regardless.

### 2.2 The per-subsystem matrix

Declared in `architecture.config.json → deleteTest.subsystems`. A subsystem whose folder is **absent** (not
yet built — Execution Infra gets its own top-level folder only when implementation resumes, per the principle)
is **skipped with a WARN**, so the matrix is armed and ready ahead of the code.

| Subsystem | Folder(s) removed | "Core builds" assertion | "Self-tests pass" assertion |
|---|---|---|---|
| **Execution Infrastructure** *(first target)* | `execution-infra/` + `templates/governance-engine/adapters/postgres/` | Core-only `tsc --noEmit` → 0 errors | `finance:proof` GREEN 10/10 + `scan:zero-admin` CLEAN |
| **Slack Surface** | `slack-surface/` | Core-only `tsc` → 0 errors | `finance:proof` GREEN — the summon falls back to `durable-last-resort` (already proven in §3 of the consumer proof) |
| **Monitoring** | `monitoring/` | Core-only `tsc` → 0 errors | `finance:proof` GREEN — health-emission is a contract Core defines, never consumes |

The first row is the one the principle names explicitly ("starting with Execution Infrastructure") and is
buildable today against `adapters/postgres/` (the only concrete adapter on disk). The other two rows arm the
moment those folders are created.

### 2.3 What "Core builds" needs (a small prerequisite, called out honestly)

A Core-only `tsconfig` must exist (or be generated by the test) that includes the `core` + `contracts` folders
and excludes adapters. Today the engine typechecks as one unit; the Delete Test needs the **split** tsconfig to
make "builds without adapters" a concrete, runnable assertion. That tsconfig is itself a structural artifact of
the boundary and should live beside the config. (This is the one piece of new scaffolding the Delete Test
implies; the static gate needs none.)

---

## 3. The config — the boundary as data

A single declarative `architecture.config.json` at the repo root. The layers, folders, allowed-import matrix,
the infra-SDK denylist, and the delete-test matrix are **data**, so the boundary is one reviewable file, not
logic spread across scripts. A `architecture.schema.json` validates it (and the gate refuses to run on an
invalid config — fail-closed).

```jsonc
{
  "$schema": "./architecture.schema.json",
  "version": 1,

  // Layer membership: longest-prefix folder match; `exclude` re-pins sub-paths to another layer.
  "layers": {
    "core": {
      "description": "The Runtime — Governance / Workflow / Capability Framework. Infrastructure-agnostic.",
      "folders": ["templates/governance-engine"],
      "exclude": ["templates/governance-engine/ports.ts",
                  "templates/governance-engine/adapters"],
      "mayImport": ["core", "contracts"],
      "denyInfraSdk": true
    },
    "contracts": {
      "description": "Ports / SDKs — the only legal cross-layer surface. Defined by Core.",
      "folders": ["templates/governance-engine/ports.ts", "contracts"],
      "mayImport": ["core", "contracts"],
      "denyInfraSdk": true
    },
    "adapters": {
      "description": "Outer ring — Execution Infra, Slack Surface, Monitoring. Consume Core only via Contracts.",
      "folders": ["templates/governance-engine/adapters", "execution-infra", "slack-surface", "monitoring"],
      "mayImport": ["contracts", "adapters"],     // NOT "core" — must go through a port
      "denyInfraSdk": false                        // SDKs legally live here
    }
  },

  // Excluded from the scan entirely: consumer/vendored trees + build output.
  "exclude": ["node_modules", ".git", "dist", "build", "examples/**", ".delete-test/**"],

  // Infra SDKs forbidden in any denyInfraSdk layer. Exact names or scope globs.
  // (The first three rows are the residency-guard's rules, now generalized repo-wide.)
  "infraSdkDenylist": [
    "postgres", "pg",                       // the SQL plane (residency rule)
    "dockerode", "docker",                  // Docker
    "tailscale",                            // Tailscale
    "neo",                                  // Neo
    "@slack/*", "@slack/web-api",           // Slack surface SDK
    "@octokit/*", "@actions/*",             // GitHub Runner / Actions SDK
    "*runner*"                              // any concrete runner SDK
  ],
  // Forbidden inline-execution patterns (kept from the residency-guard — execFileSync of a relative tool):
  "infraCallDenylist": [
    { "id": "execfile-relative-tool",
      "re": "\\b(?:execFileSync|execSync|spawnSync|exec)\\s*\\([^)]*?[\"'][.]{1,2}/",
      "why": "shelling a relative-path tool is plane wiring — it belongs to an adapter, not Core/Contracts" }
  ],

  "deleteTest": {
    "coreTsconfig": "tsconfig.core.json",          // includes core+contracts, excludes adapters
    "selfTest": {
      "cwd": "examples/finance-os-demo",
      "commands": ["npm run finance:proof", "npm run scan:zero-admin"]
    },
    "subsystems": [
      { "id": "execution-infrastructure",
        "remove": ["execution-infra", "templates/governance-engine/adapters/postgres"] },
      { "id": "slack-surface",  "remove": ["slack-surface"] },
      { "id": "monitoring",     "remove": ["monitoring"] }
    ]
  }
}
```

Editing the boundary = editing this file (caught by CODEOWNERS review). The gate scripts carry **no** hard-coded
folder names — they read the config, exactly as the principle asks ("the boundary is data, not scattered rules").

---

## 4. The wiring

Two tiers, matched to cost. The static gate is milliseconds and runs **everywhere**; the Delete Test is
minutes and is kept off the every-push path.

### 4.1 Pre-push (local, free) — `.githooks/pre-push` (already wired via `core.hooksPath`)

Add **Gate 5** after the existing Gates 1–4, in the same fail-closed style:

```sh
# Gate 5 — architectural-boundary guard: dependencies must flow inward (adapter → contract → core).
if [ -f scripts/arch-boundary-guard.mjs ]; then
  if ! node scripts/arch-boundary-guard.mjs >&2; then
    echo "✗ push blocked by Delivery OS arch-boundary-guard: an import crosses an architectural boundary." >&2
    echo "  (see the [direction]/[infra-sdk] finding above for the exact rule + fix)" >&2
    exit 1
  fi
fi
```

This is static analysis over a few hundred files — **tens of milliseconds**, zero install, no network. It is
the right thing to run on every push: it travels in the repo, fires for any git client, and catches the
boundary crossing at the moment it is authored. The Delete Test is deliberately **not** here.

### 4.2 CI — the binding copy on neutral hardware

A workflow with two jobs:

- **`architecture-boundary`** — runs `node scripts/arch-boundary-guard.mjs` **and** its `--self-test`. Cheap
  (seconds); runs on **every** PR. This is the binding re-run of the local advisory on neutral hardware
  (the same author≠verifier posture the verify-gate already uses).
- **`delete-test`** — runs the per-subsystem matrix (§2). Heavier (worktree + `tsc` + the in-memory proof =
  low single-digit minutes). **Path-filtered**: triggered only when a PR touches a layer folder
  (`templates/governance-engine/**`, `execution-infra/**`, `slack-surface/**`, `monitoring/**`, `contracts/**`)
  or `architecture.config.json` / `tsconfig.core.json`. A docs-only PR never pays for it.

### 4.3 The GitHub-Actions-minutes reality (honest)

The Delete Test is the only expensive piece, and Actions minutes are a real budget. Mitigations, by design:

- **Path-filter** (above) — most PRs skip `delete-test` entirely.
- **Local opt-in** — `npm run delete-test:execution` lets a contributor touching Execution Infra run that one
  subsystem before pushing (one worktree, one `tsc`, one proof — seconds-to-a-minute), so CI is a confirmation,
  not the first discovery.
- **Self-hosted runner** — the principle and roadmap already anticipate a self-hosted GitHub Runner (it is one
  of the Execution-Infra adapters). Once it exists, `delete-test` targets it (`runs-on: self-hosted`) and the
  Actions-minute cost goes to **zero**. The design is written so this is a one-line `runs-on` change, not a
  rewrite.
- **Matrix laziness** — absent subsystems are skipped with a WARN, so CI cost scales with what actually exists.

Net: the **direction gate** is free and ubiquitous (pre-push + every CI run); the **Delete Test** is bounded by
a path filter today and free on the self-hosted runner tomorrow.

---

## 5. Worked example — a caught violation, end to end

A contributor wiring the Docker execution adapter takes a shortcut and imports it straight into the supervisor:

```ts
// templates/governance-engine/goal-supervisor.ts   (a CORE file)
import { runInDocker } from "./adapters/postgres/plane.js";   // (1) direction: core → adapters
import Docker from "dockerode";                                // (2) infra-sdk in a denyInfraSdk layer
```

- **Locally**, `git push` fires Gate 5. `arch-boundary-guard` classifies `goal-supervisor.ts` as `core`, sees
  the relative import resolve into the `adapters` layer (forbidden by `core.mayImport`) and the bare
  `dockerode` (on the denylist, and `core.denyInfraSdk = true`). It prints both findings (§1.3) and exits 1.
  **The push is blocked before it leaves the laptop.**
- If the push is bypassed or the file lands another way, **CI** `architecture-boundary` re-runs on neutral
  hardware and fails the PR with the same two findings.
- If somehow only a subtle direction leak slips through (e.g. a transitively-reached adapter symbol), the
  **`delete-test`** job removes `execution-infra/` + `adapters/postgres/`, the Core-only `tsc` can no longer
  resolve `./adapters/postgres/plane.js`, and the build goes red — the boundary breach surfaces as a compile
  error with the adapter gone.

The fix the message points to: define an `ExecutionProviderPort` in `ports.ts` (a **contract**), let the Docker
adapter implement it, and have Core depend on the port — restoring `core → contracts ← adapters`.

---

## 6. What it can and cannot catch (honest limits)

**Catches (statically, cheaply):**
- Any **static** import/`require`/`export-from`/string-literal-`import()` that crosses a layer the wrong way.
- Any denylisted infra SDK imported into Core or Contracts (the residency-guard's job, now repo-wide).
- A hidden **compile-time** dependence of Core on an adapter — surfaced by the Delete Test even if the static
  gate's resolver missed the edge (defense in depth: the gate reasons about edges; the Delete Test reasons
  about buildability).

**Cannot catch (stated plainly, with the mitigation):**
- **Dynamic / computed imports** — `import(someVariable)`, `require(buildPath())`, `eval`, reflection. Static
  analysis sees only literal specifiers. *Mitigation:* the Delete Test catches the subset that breaks the build;
  a lint rule banning dynamic import in Core/Contracts (future) would close more. Runtime coupling through a
  string the gate cannot read is the residual risk.
- **Runtime coupling that is legal by design** — the composition root (`createGovernanceRuntime`) *does* wire
  concrete adapter instances into Core through ports. That is the inversion the architecture *wants*; it is not
  an import edge and must not be flagged. The gate enforces the **import** boundary; the **instance** boundary
  is enforced by the port types + the Delete Test (Core builds and runs with no concrete adapter present).
- **Shared mutable state / globals / env** — two layers coupling through `process.env`, a global singleton, or
  a shared file is invisible to import analysis. Out of scope by construction.
- **Type-only leaks are treated as violations** — a `import type { X } from "./adapters/…"` in Core is flagged
  even though it erases at runtime. This is **intentional**: the boundary is about *knowledge*, not just runtime
  bytes — Core must not even name an adapter's internals. (Configurable later if it proves noisy.)
- **The Delete Test proves buildability independence, not feature completeness** — Core building with an adapter
  gone means "no compile/structural dependence," not "every feature still works." A capability that legitimately
  needs Docker is simply *unconfigured* in the in-memory proof (ports default to inert/in-memory), which is the
  correct, expected state — exactly as the consumer proof ran a real goal to DONE on in-memory ports.

**Cost summary (honest):**
- Direction gate: **~tens of ms**, zero deps, zero network — free on every push and every CI run.
- Delete Test: **low single-digit minutes** per subsystem (worktree + `tsc` + the existing proof). Bounded by a
  CI path filter today; **free** on the self-hosted runner once it lands; runnable locally per-subsystem.

---

## 7. Build order (when implementation resumes — not part of this design)

1. Write `architecture.config.json` + `architecture.schema.json` (the data).
2. Generalize `residency-guard.mjs` → `scripts/arch-boundary-guard.mjs` (pure detector + walk + `--self-test`),
   reusing the finance-scan resolver. Retire the residency-guard's three rules into the config's denylist.
3. Add `tsconfig.core.json` (core+contracts, adapters excluded).
4. Write `scripts/delete-test.mjs` (worktree → remove → `tsc` core → run the proof) driven by the matrix.
5. Wire Gate 5 into `.githooks/pre-push`; add the `architecture-boundary` + path-filtered `delete-test` CI jobs.
6. Each step ships with its planted-violation self-test; the whole thing goes through an independent VERIFY
   (author≠verifier) before it is trusted — the gate that guards the architecture is itself gated.
```