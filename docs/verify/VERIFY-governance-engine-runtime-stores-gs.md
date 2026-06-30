---
slice: "governance-engine-runtime-stores-gs — RuntimeStoresPort + inverted Goal Supervisor (Extraction Slice 2)"
verify_status: verified
author: "Builder (software-engineer build session)"
verifier: "qa-test (independent, claude-opus-4-8) — 2026-06-29T21:42+0200"
independence_basis: recorded-distinct-invocation
machine_probe: "tsx templates/governance-engine/scripts/goal-supervisor-self-test.ts"
---

# VERIFY — Governance Engine Extraction Slice 2 (RuntimeStoresPort + inverted Goal Supervisor)

## Verdict
**verify_status: `verified`.** The inverted Goal Supervisor produces verdicts BYTE-FOR-VERDICT IDENTICAL to
admin's 5-pass-verified original on every case — including the load-bearing 5-pass-fixed cases — proven by an
INDEPENDENT cross-check that feeds identical inputs to BOTH evaluators and compares verdict + dGoal + every
soundness detail + the human reason string (16/16 identical, 0 divergences). The C12 cage is PINNED and is NOT a
rubber stamp: three separately-injected drifts (idempotency write-once removed, breaker cooldown gate removed,
DDL append-only trigger dropped) each made it FAIL non-zero. Residency is CLEAN over the new files (and the guard
catches a planted `postgres` import), slice-1 regression still passes, and `tsc --strict` is clean.

Two questions posed in the mandate, answered directly:
- **Does the inverted GS produce ANY different verdict than admin's original?** NO. Across the builder's 39/39
  harness AND my independent 16-case cross-check against admin's actual `src/goal-supervisor-c7.ts`, zero
  verdict divergences; dGoal, progressConfirmed, effortSound, progressSound, epsilon, epsilonClamped, and the
  emitted reason string are identical on every case.
- **Does the C12 cage fail on injected drift?** YES. Each of the three injected divergences flipped the cage to
  exit 1 / `BROKEN`. The clean copy is exit 0 / `PINNED`.

## Independence basis
Distinct QA invocation; the verifier authored an ORIGINAL cross-check fixture (NOT the builder's harness) that
imports admin's real original organ and the platform's inverted organ side-by-side and asserts verdict equality.
The implementation was not modified. All probes run on disk via `rumah-admin/node_modules/.bin/tsx` + `tsc`.

## Execution evidence (direct runtime output)

| # | Criterion | Probe (run for real) | Result |
|---|-----------|----------------------|--------|
| 1 | GS logic UNCHANGED — same verdicts (load-bearing) | (a) `diff rumah-admin/src/goal-supervisor-c7.ts templates/governance-engine/goal-supervisor.ts`; (b) `tsx scripts/goal-supervisor-self-test.ts`; (c) independent QA cross-check fixture | (a) ONLY differences are comments + the store-access path (import line; `runtimeStoresAdapter` default → `runtimeStoresPortToSupervisionStore`; removal of `= runtimeStoresAdapter` default) + the ADDITIVE `createGoalSupervisor` factory — ZERO changes inside `computeEffort`/`computeDGoal`/`movementTowardTarget`/`computeFingerprint`/`evaluateGoalSupervision`/`composeHaltAndFap`. (b) **39/39 passed, exit 0.** (c) **16/16 IDENTICAL (admin == inverted), 0 divergences, 0 expectation-misses, exit 0** — verdict, dGoal, progressConfirmed, effortSound, progressSound, epsilon, epsilonClamped AND reason string equal on all cases. PASS |
| 2 | C12 cage catches drift (not a rubber stamp) | (a) `tsx runtime-stores-cage.ts`; (b) 3 throwaway drift injections; (c) provenance vs admin `migrations/0052_runtime_durable_stores.sql` | (a) **PINNED, exit 0** (all assertions PASS). (b) DRIFT-A idempotency write-once removed → `FAIL consume write-once`, BROKEN exit 1; DRIFT-B breaker cooldown gate removed → 2 FAILs (cool-before-elapsed + durable-survives-restart), BROKEN exit 1; DRIFT-C DDL append-only trigger dropped from attempt_ledger → `FAIL the 4 append-only stores all carry the guard`, BROKEN exit 1. (c) provenance cross-check vs admin's real 0052 = **drift 0** (same 6 tables, same append-only trigger set, same write-once/immutable-cols, same breaker states, same unique indexes, no UPDATE/DELETE RLS on append-only). PASS |
| 3 | RuntimeStoresPort faithful + append-only structural | Read `ports.ts` vs `runtime-stores.ts`; method count; mutation-method scan; import scan | 14 methods present and matching the 14 exported `runtime-stores.ts` functions (appendProgressSample, readProgressSeries, recordAttempt, countAttempts, getBreaker, recordFailure, coolBreaker, closeBreaker, reserveIntent, consumeIntent, isConsumed, recordDeadLetter, appendCost, readCumulativeCost). NO update/delete method exists on any of the 4 append-only stores (cage [2] confirms `forbidden.length===0`). Only import in ports.ts is `import type { GoalState } from "./state-machine.js"` — NO `postgres`/`pg`/`./db/client.js`. PASS |
| 4 | In-memory adapter preserves real semantics | cage sections [2]/[3]/[4] + drift A/B | re-append to an append-only store is a no-op (false), first value NOT overwritten; attempt duplicate THROWS (23505 mirror); idempotency consume is write-once (2nd consume false, cannot un-consume); breaker closed→open at threshold w/ cooldown → half_open ONLY after cooldown elapses → closed; threshold=1 opens on first failure; cumulative cost per-goal monotonic (100→150, `readCumulativeCost` filters by goalId). Drift A/B prove the write-once + cooldown rules are load-bearing (removing them breaks the cage). PASS |
| 5 | Residency + no regression | `node residency-guard.mjs`; `tsx golden-master.ts`; `tsx scripts/self-test.ts`; `tsc --strict`; planted-violation negative test | residency **CLEAN over 10 files** (incl. all new slice-2 files), exit 0; planted `postgres` import in ports.ts → guard VIOLATION exit 1 (not a rubber stamp); slice-1 golden-master **PINNED exit 0**; slice-1 self-test **ALL PROOFS HOLD exit 0**; `tsc --strict --module esnext --moduleResolution bundler` over the whole package → **exit 0, no diagnostics**. PASS |

## Criterion-1 diff detail (the load-bearing regression claim)
`diff` of admin original vs inverted shows the non-comment changes are EXACTLY:
- `import` line: `from "./goal-contract.js"` + the 4 DB store functions → `import type { BudgetCap, GoalState, RuntimeStoresPort, GoalContractStorePort } from "./ports.js"`.
- `runtimeStoresAdapter` (DB-bound default const) → `runtimeStoresPortToSupervisionStore(port)` (port re-point function).
- `runGoalSupervision(..., store: SupervisionStore = runtimeStoresAdapter, ...)` → `store: SupervisionStore` (default removed; residency forbids a concrete default).
- ADDED `createGoalSupervisor`/`GoalSupervisorPorts`/`SuperviseGoalInput`/`GoalSupervisor` — additive composition glue that calls the UNCHANGED `runGoalSupervision`.

The decision-logic span (the pure evaluator and its helpers) is unchanged — confirmed by both the diff and the
runtime verdict-equality cross-check.

## Independent cross-check method (criterion 1, the verifier's own fixture)
A QA-authored fixture (`cross-check.ts`, run as a throwaway) imported `evaluateGoalSupervision` from BOTH
`rumah-admin/src/goal-supervisor-c7.ts` (admin's 5-pass-verified original; pure function, its lazy DB import
chain never connects because a pure evaluator issues no query — exercised with a dummy ambient `DATABASE_URL`)
and `templates/governance-engine/goal-supervisor.ts` (the inverted organ). It fed deep-cloned IDENTICAL fact
objects (with NaN/Infinity re-injected post-JSON) to both and compared verdict + dGoal + progressConfirmed +
effortSound + progressSound + epsilon + epsilonClamped + reason. The cases were authored fresh to replay the
5-pass-hunt fixes: fail-closed default (effort unreadable / progress unreadable / re-probe failed), the strict
ε-boundary (dGoal == ε → SUMMON; just-over → CONTINUE; ε=0 clamped + integer-stuck-at-0 → SUMMON),
effort-without-progress → SUMMON (flat & regressing while spent), genuinely-early → CONTINUE, non-finite/unreadable
→ fail-closed (NaN budget axis, Infinity re-read, negative attempts), op== gap-closing, and the op<=+increase
contradiction guard. Result: **16/16 identical, 0 divergences.** (Fixture and throwaway drift copies were removed
after the run; the builder's `scripts/goal-supervisor-self-test.ts` 39/39 is the permanent regression harness.)

## Bugs
None. No defects found; nothing filed.

## Re-run instructions (clean checkout)
```
cd templates/governance-engine
tsx scripts/goal-supervisor-self-test.ts      # 39/39, exit 0
tsx runtime-stores-cage.ts                     # PINNED, exit 0 (provenance drift 0 vs admin 0052)
node residency-guard.mjs                        # CLEAN, exit 0
tsx golden-master.ts && tsx scripts/self-test.ts  # slice-1 regression, exit 0
tsc --strict --noEmit --module esnext --moduleResolution bundler templates/governance-engine/**/*.ts  # clean
```
