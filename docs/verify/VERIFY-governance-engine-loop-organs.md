---
slice: "governance-engine-loop-organs — 4 ports + 5 inverted loop-core organs (Extraction Slice 3)"
author: Builder
verifier: qa-test (INDEPENDENT — author≠verifier)
verified_at: 2026-06-29T20:15:31Z
independence_basis: recorded-distinct-invocation
machine_probe: "tsx templates/governance-engine/scripts/reconciler-self-test.ts"
verify_status: verified
---

# VERIFY — Governance Engine Extraction Slice 3 (4 ports + 5 inverted loop-core organs)

**Verdict: VERIFIED.** Every inverted organ reproduces admin's verdicts BYTE-FOR-BYTE on identical inputs; the
three load-bearing invariants (sole-mutator §15, completion-review fail-closed DONE, sprint-engine cap-fail-closed)
each survived a dedicated adversarial attack suite; residency is clean and no slice-1/2 regression. The
implementation was NOT modified. All probes ran on disk via `rumah-admin/node_modules/.bin/{tsx,tsc}` and `node`.

Could I force a **false-DONE**, a **cap bypass**, or a **second mutator** on any inverted organ? **No** — every
attempt was defeated fail-closed (see criteria 2/3/4 below).

## Independence basis
I did not author this code. I diffed each inverted organ against its admin source, and — beyond re-running the
builder's own self-tests — I authored my OWN two harnesses (a recorded-distinct-invocation), located at
`C:\Users\brian\RUMAH\delivery-os\tmp-verify\equality-harness.mts` and `…\tmp-verify\attack-harness.mts`, which
import BOTH admin's original organs AND the inverted package organs and compare/attack them in one process.
Admin modules load lazily under a dummy `DATABASE_URL` (postgres connects only on first query; the pure
functions are never given one).

## Execution-evidence table

| # | Acceptance criterion | Probe (run for real) | Result |
|---|---|---|---|
| 1 | Decision logic unchanged (verdict-equality) | `diff` admin↔inverted (all 5); 5 builder self-tests; **my own** original-vs-inverted equality harness | `diff`: only sanctioned changes (comments + import re-pointing + free-fn→factory-over-port; DB default removed; types→ports). Self-tests: metric-probe **14/14**, preflight **12/12**, reconciler **25/25**, completion-review **12/12**, sprint-engine **45/45**. Equality harness: **24/24** identical outputs (reconcile ×10 branches, reviewCompletion ×7, runSprint ×7). **PASS** |
| 2 | ★ Reconciler sole-mutator (§15) | independent `grep` of every `.transition(` call site across the package; read of `goal-contract.ts`; reconciler self-test (E)+(F) | Only **two** code call sites: `reconciler.ts:426` (the SOLE mutator door) and `goal-contract.ts:41/51` (the §4.3 validator-wrapper = the door DEFINITION / port itself, admin's excluded `goal-contract.ts` analogue). `metric-probe`/`preflight`/`completion-review`/`sprint-engine` call transition **zero** times. No second mutator exists; a state change can only route through the reconciler. **PASS** |
| 3 | ★ Completion-review fail-closed DONE | **my own** attack harness §3 — 15 adversarial cases | Loop-claimed-done vs independent re-probe 0.4 → INCOMPLETE; throwing re-probe → INCOMPLETE (not swallowed); Infinity/-Infinity/NaN/null → INCOMPLETE; 6 malformed acceptances + a "good" re-read → INCOMPLETE; no re-probe wired → INCOMPLETE. COMPLETE reachable in EXACTLY ONE positively-proven state (well-formed ∧ ok ∧ finite ∧ met); strict `>` at exactly-target → INCOMPLETE. **15/15, no false-DONE. PASS** |
| 4 | ★ Sprint-engine cap-fail-closed | **my own** attack harness §4 — 13 adversarial cases | Malformed/≤0/string/object/NaN/±Infinity axis → ZERO work + `halted_at_cap` (8 cases); positive bound EXACT (max_turns:3/8→3; cost 250@100→200≤250); **cumulative across re-invocations** (2nd sprint adds 0 — still 3, not 6); absent `{}` → uncapped per spec, bounded by plannedSteps. **13/13, no cap bypass, no unbounded work. PASS** |
| 5 | Ports DB-agnostic + residency + no regression | `node residency-guard.mjs` (+`--self-test`, + live planted import); `grep` ports.ts; preflight self-test; slices 1+2 self-tests; both cages; `tsc --strict` | residency **CLEAN over 21 files** exit 0; detector self-test 5/5; **live planted `postgres` import → VIOLATION exit 1** (not a rubber stamp); ports.ts SQL/postgres/execFileSync hits are **all comments** only; preflight fails CLOSED with no `ConfigReadinessPort` (self-test RESIDENCY case); slice-1 `self-test.ts` ALL PROOFS HOLD exit 0; GS self-test **39/39**; golden-master **PINNED** exit 0; runtime-stores-cage **PINNED** exit 0; `tsc --strict --noEmit --module esnext --moduleResolution bundler` → **exit 0, no diagnostics**. **PASS** |

## Diff summary (criterion 1 — sanctioned changes only)
- **reconciler.ts**: free functions `applyReconcilePlan`/`reconcileTick`/`reconcileToSettled` wrapped into `createReconciler(port)` factory; `transition`/`readContract` (from `./goal-contract.js`) → `contract.transition`/`contract.readContract` on the injected `GoalContractStorePort`; `./goal-supervisor-c7.js`→`./goal-supervisor.js`. `reconcile()` / `acceptanceMet` / `legalPath` / `currentValueOf` / EDGE_GUARD / AUTONOMOUS_EDGES / NON_TICKABLE byte-identical.
- **completion-review.ts**: imports re-pointed (`./goal-contract.js`→`./ports.js`, `./goal-supervisor-c7.js`→`./goal-supervisor.js`, `./po-reconciler-c2.js`→`./reconciler.js`); adjudication core byte-identical.
- **sprint-engine.ts**: `?? realStores` DB default REMOVED; `SprintStores` interface→`Pick<RuntimeStoresPort>`; types→`./ports.js`; additive `createSprintEngine`/`runtimeStoresPortToSprintStores`; `asControllerHook` deferred to slice 4. `runSprint`/`capAxis`/`capFor`/H1 bounds/idempotency/abort byte-identical.
- **metric-probe.ts**: top-level `import postgres` REMOVED; `makeReadOnlySqlReader`/`sqlCredentialResolver` removed (consumer adapter); `ProbeReader`/`CredentialResolver` types→`./ports.js` (re-exported under admin names); `assertReadOnlyTarget` exported. Substrate (`ProbeRegistry`/`invokeProbe`/L3 regexes) byte-identical.
- **preflight.ts**: `makeIConfigReadiness()` execFileSync default REMOVED; `ReadinessState`/`KeyReadiness`/`ConfigReadinessFn` types→`./ports.js`; a NEW fail-closed branch added (no port + required keys → `capability-not-ready`). Five-check verdict logic byte-identical.

## Independent equality probe (recorded-distinct-invocation)
`cd rumah-admin && DATABASE_URL=postgres://verify@127.0.0.1/dummy tsx tmp-verify/equality-harness.mts` → **24 passed, 0 failed**.
`cd rumah-admin && tsx tmp-verify/attack-harness.mts` → **28 passed, 0 failed**.

## Notes
- Verification scratch (`tmp-verify/{equality,attack}-harness.mts`) is the repro for criteria 1/3/4; it is not part of the package and triggers no residency scan over the package boundary. The transient planted-offender dir used for the live guard negative test was removed after use.
