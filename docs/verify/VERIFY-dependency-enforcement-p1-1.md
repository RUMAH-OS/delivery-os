---
slice: "dependency-enforcement-p1-1 — arch-boundary gate + corrected Delete Test + Gate 5 + drift coverage"
author: Builder (Sprint P1.1 worker)
verifier: qa-test (independent dedicated verifier — distinct from author and from the PO stand-in)
independence_basis: recorded-distinct-invocation
verifier_note: >
  This validation SUPERSEDES the earlier PO stand-in entry (the dedicated qa verifier had been
  rate-limited at that time). It re-runs every probe AND adds independently-authored adversarial
  tests the stand-in did not: (a) my own planted offenders run against the real config in throwaway
  trees including sneak forms (literal dynamic import, aliased re-export, deep relative path,
  require, computed/template-literal dynamic import); (b) a DISTINCT Core->adapter leak (a different
  organ + a different adapter binding than the builtin oracleProbe) proving the Delete Test goes RED;
  (c) Gate-5 block on a planted real violation; (d) drift fail-closed with the artifacts hidden.
  author != verifier holds.
machine_probe: "node scripts/arch-boundary-guard.mjs --self-test"
verify_status: verified
date: 2026-06-30
---

# VERIFY — Dependency-Enforcement Layer (Sprint P1.1)

**Verdict: PASS.** The Repository Principle is now structural. The gate caught **every** planted
direction and infra-SDK violation across all static import forms — including the sneak attempts. The
corrected Delete-Test oracle fails RED on my **own, distinct** Core→adapter leak at both compile and
runtime against the REAL `templates/governance-engine` tree. Classifications are honest. Gate 5 and
drift coverage work and fail-closed.

## Load-bearing answers (the three the brief demanded)
- **Could I make the gate MISS a real violation?** No static-form direction or SDK violation escaped.
  The only escape is a **computed / template-literal** dynamic import (`import(varOrTemplate)`) — the
  explicitly admitted gap (WAVE1-CHALLENGE §6), backstopped at runtime by the Delete Test. **No new
  DIRECTION-violation gap.** Note: even the *string-literal* `import("x")` form IS caught.
- **Could I FOOL the Delete Test?** No. My distinct leak — `runtime.ts` importing
  `makeReadOnlySqlReader` from the adapter (a different organ + binding than the builtin probe) — turned
  it RED on compile (TS2307) AND runtime (MODULE_NOT_FOUND), with a requireStack proving the REAL tree
  (`.delete-test/.../templates/governance-engine/runtime.ts`), not the vendored copy.
- **Did I find a DISHONEST classification?** No. `metric-probe.ts` genuinely imports only `./ports.js`;
  the `scripts/` exclusions shield only test harnesses, never an organ.

## Execution evidence (verbatim exit codes)

| # | Criterion | Probe | Result |
|---|---|---|---|
| 1 | Gate self-tests | `node scripts/arch-boundary-guard.mjs --self-test` | **10/10, exit 0** |
| 2 | Real repo clean | `node scripts/arch-boundary-guard.mjs` | **CLEAN, exit 0** (130 files: core 33, contracts 7, adapters 6, unclassified 84) |
| 3 | Delete Test clean | `node scripts/delete-test.mjs` | **CLEAN, exit 0** (adapter deleted; real Core builds + 3 self-tests pass; 3 absent subsystems SKIP-armed) |
| 4 | Oracle valid (builtin) | `node scripts/delete-test.mjs --prove-oracle` | **ORACLE VALID, exit 0** (tsc TS2307 + ERR_MODULE_NOT_FOUND, real tree) |
| 5 | Core typechecks | `tsc --noEmit -p tsconfig.core.json` (finance-os-demo toolchain, tsc 5.9.3) | **0 errors, exit 0** |
| 6 | Pre-push reaches Gate 5 clean | `printf '' \| sh .githooks/pre-push` | **exit 0** (Gates 1–5 pass; Gate 5 arch-boundary CLEAN) |
| 7 | Drift clean | `node .claude/tools/check-os-drift.mjs` | **OK, exit 0** |

## Independently-authored adversarial probes (not in the prior entry)

**1 — Planted offenders, real config, throwaway trees.** Run as
`--root <tmp> --config <real architecture.config.json>`. All static forms FIRED (exit 1):

| Probe | Form | Result |
|---|---|---|
| Core ← `dockerode` / `@slack/web-api` / `tailscale` | bare SDK | **CAUGHT** (3 infra-sdk) |
| Core ← `./adapters/postgres/plane.js` | import-from | **CAUGHT** core→adapters |
| Adapter ← `../../reconciler.js` | direction | **CAUGHT** adapters→core |
| Core `await import("dockerode")` | **literal** dynamic | **CAUGHT** |
| Core `export { default as Docker } from "dockerode"` | aliased re-export | **CAUGHT** |
| Core ← `./adapters/postgres/deep/nested/thing.js` | deep relative | **CAUGHT** core→adapters |
| Core `require("./adapters/postgres/plane.js")` | require | **CAUGHT** core→adapters |

Admitted-gap probes (`/tmp/abg-gap`) — **computed / template-literal** specifiers, all NOT caught
(documented limit, not a direction-rule hole): `const pkg="dockerode"; await import(pkg)`;
`const p="./adapters/..."; await import(p)`; `` await import(`./adapters/${seg}/plane.js`) ``.

**2 — Delete-Test teeth with a DISTINCT leak.** Prepended
`import { makeReadOnlySqlReader } from "./adapters/postgres/probe-reader.js"; void makeReadOnlySqlReader;`
to `templates/governance-engine/runtime.ts` (≠ the builtin probe's `goal-contract.ts` +
`createPostgresRuntimeStores`), ran `delete-test --subsystem governance-postgres-adapter`:
- (a) Core builds → **FAIL** `runtime.ts(1,39): error TS2307: Cannot find module './adapters/postgres/probe-reader.js'`
- (b) `governance-runtime-self-test.ts` → **FAIL** `MODULE_NOT_FOUND`, requireStack
  `.delete-test/governance-postgres-adapter/templates/governance-engine/runtime.ts` ← `…/scripts/governance-runtime-self-test.ts`
- exit 1. `runtime.ts` restored byte-for-byte; `.delete-test/` pruned.

**3 — Gate 5 blocks a real planted violation.** `templates/governance-engine/__qa_probe_violation.ts`
importing `dockerode` → guard prints the `[infra-sdk]` finding + "push blocked", **exit 1**. File removed.

**4 — Drift fails-closed.** Ran `check-os-drift.mjs` from a temp cwd holding only
`architecture.config.json` (guard/tsconfig/delete-test/schema absent) → **4 phantom-dispatch FAILs,
exit 1** — the kernel cannot advertise enforcement the disk lacks. `templates/tools/check-os-drift.mjs`
carries the identical arch-block (3 `arch-boundary-guard` refs); its only divergence from the `.claude/`
copy is the unrelated CODEOWNERS/os_version logic (documented self-install lag, out of slice scope).

## Classification honesty (criterion 5, scrutinized)
- `metric-probe.ts` → **contracts**: only specifiers are `import/export type … from "./ports.js"`
  (lines 37–38). No driver, no adapter — a genuine contracts surface, not a Core→adapter coupling
  reclassified to dodge the gate. **Doc nit (non-blocking):** line-5 comment narrates an
  `import postgres from "postgres"` that is NOT present in the code; the guard scans imports not
  comments and is CLEAN, but the stale comment should be refreshed.
- `ports.ts` → contracts: imports only `./state-machine.js` (a Core type) — allowed.
- `scripts/` exclusions re-pin only test harnesses. The one harness importing the adapter
  (`scripts/postgres-faithfulness-self-test.ts` ← `../adapters/postgres/index.js`) is legitimate test
  wiring AND is deliberately NOT in `deleteTest.coreSelfTests`, so the post-deletion suite is
  adapter-free by design. `golden-master.ts` and `runtime-stores-cage.ts` classify as **core** (gated),
  confirming the exclusions are narrow. No organ is shielded.

## Verdict
`verify_status: verified`. The dependency-direction gate catches every planted direction/SDK violation
(only computed dynamic-import admitted); the corrected Delete-Test oracle fails on a genuine, distinct
Core→adapter leak at compile and runtime against the real tree; the split Core tsconfig builds; Gate 5
blocks and drift fail-closes; classifications hide no inward-rule violation. **One non-blocking nit:**
refresh the stale `import postgres` comment at `metric-probe.ts:5`.
