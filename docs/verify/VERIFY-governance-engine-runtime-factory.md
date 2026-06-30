---
slice: "governance-engine-runtime-factory — surfaces + controller + createGovernanceRuntime (Extraction Slice 4)"
verify_status: verified
author: "Builder (software-engineer build session)"
verifier: "qa-test (independent — claude-opus-4-8), 2026-06-29T20:56:12Z"
independence_basis: recorded-distinct-invocation
machine_probe: "tsx templates/governance-engine/scripts/governance-runtime-self-test.ts"
date: "2026-06-29"
---

# VERIFY — Governance Engine Runtime Factory (Extraction Slice 4)

## Verdict

**verify_status: `verified`.**

A complete goal lifecycle runs through `createGovernanceRuntime(ports)` with **ZERO Postgres** — the factory
wires every organ + the controller from the 6 injected ports alone and drives a goal CREATED→…→DONE on the
in-memory adapters. All four load-bearing invariants survived independent attack:

1. **§15 single-mutator** — `po-autoloop.ts` and `goal-intake.ts` call `transition()` ZERO times; `reconciler.ts`
   is the ONLY organ `.transition(` call site; intake's resume + the controller's transitions route through
   `applyReconcilePlan`. SURVIVED.
2. **C6-gates-DONE (B1 fix)** — loop-claims-1.0 / C6-reprobes-0.5 ended **PLANNING**, never DONE, no contradictory
   DONE+INCOMPLETE summon; a genuinely-met goal (C6 1.0) reached DONE. No path forces a false-DONE. SURVIVED.
3. **summon never-dropped + draft-don't-send** — across all channel-availability combos (incl. all-unavailable +
   empty chain) `dropped` is structurally false (durable terminal); SHADOW with a configured notifier drafts,
   never sends. SURVIVED.
4. **intake identity fail-closed** — non-founder / unverified / absent / unset-binding (allow-NONE) cannot SUBMIT
   or APPROVE; FAP forge / replay / expired / mismatch all rejected. SURVIVED.

Logic-unchanged + residency + no-regression all hold (criterion 5).

> Independence basis: this verifier did NOT author the code. Every result below is from a distinct invocation of
> `rumah-admin/node_modules/.bin/{tsx,tsc}` recorded in this session, plus an independently-authored fixture
> (`qa-independent-verify.ts`, 29/29) that builds the runtime from ports alone and attacks invariants 1/3/4 from
> scratch. The fixture was run transiently and removed so the slice's file set stays pristine (31 files).

## Probe results (verbatim)

| Probe | Result |
|---|---|
| `tsx scripts/governance-runtime-self-test.ts` (PRIMARY) | **10/10 passed · exit 0** |
| `tsx scripts/po-autoloop-self-test.ts` | **42/42 passed · exit 0** |
| QA independent fixture (factory-from-ports + invariant attacks 1/3/4) | **29/29 passed · exit 0** |
| `tsx scripts/founder-summon-self-test.ts` | **24/24 passed · exit 0** |
| `tsx scripts/boundary-plan-self-test.ts` | **15/15 passed · exit 0** |
| `tsx scripts/goal-intake-self-test.ts` | **34/34 passed · exit 0** |
| `tsx golden-master.ts` (§4.3 TS⇄DB cage, incl. admin-0053 cross-check) | **PINNED · exit 0** |
| `tsx runtime-stores-cage.ts` (C12 cage, incl. admin-0052 cross-check) | **PINNED · exit 0** |
| slices 1–3 self-tests (state-machine · reconciler · sprint-engine · GS · C6 · metric-probe · preflight) | **all green · exit 0** |
| `node residency-guard.mjs` (31 files) | **CLEAN · exit 0** |
| `node residency-guard.mjs --self-test` + live planted `postgres`/`./db/client.js` import | **catches (exit 1), CLEAN after removal** |
| `tsc --strict --noEmit` over `index.ts` (production graph, NodeNext, @types/node) | **clean · exit 0** |

## Execution evidence — acceptance criteria 1–5

### Criterion 1 — the factory runs a full lifecycle with ZERO Postgres (package-complete proof) · PASS
- `scripts/governance-runtime-self-test.ts`: `createGovernanceRuntime({goalContractStore, runtimeStores, founderBinding, probeRegistry})`
  composed contract organ + reconciler + supervisor + sprint engine + controller; `runGoalLifecycle` drove a goal
  to **DONE** in ENFORCE on the in-memory adapters (REAL §4.3 transitions; C6 owned the DONE boundary with a
  COMPLETE verdict; a real transition executed via the reconciler; the durable in-memory stores captured the
  observed series). The C1 SUBMIT/APPROVE front doors admitted the founder and rejected the non-founder. 10/10.
- **Independent fixture** (mine): built the runtime from the in-memory ports alone and drove **one HAPPY goal →
  DONE** (durable contract = DONE) **and one STALL goal → HALTED + a non-dropped summon** — proving a consumer
  needs only the 6 ports (no DB, no hand-wiring). No `postgres` / `./db/client.js` import on the executed path
  (residency-guard CLEAN over all 31 files; `runtime.ts` imports only `./*.js` organs + `./ports.js`).

### Criterion 2 — ★ §15 single-mutator preserved · PASS (BLOCKING gate cleared)
- Whole-package `.transition(` scan: the only production-organ driving call site is `reconciler.ts:426`
  (`contract.transition(plan.goalId, edge.to)`). `goal-contract.ts:51` is the §4.3 validator-organ store-delegation
  door (the wrapper the reconciler calls *through*), correctly excluded by the reconciler cage's organ set.
- `po-autoloop.ts` and `goal-intake.ts` call `transition()` **ZERO** times (no non-comment `.transition(` match).
- The controller routes mutation through `applyReconcilePlan` (`po-autoloop.ts:337` → `reconciler.applyReconcilePlan`,
  driven at `:361`/`:439`); intake's resume routes through `reconciler.applyReconcilePlan` (`goal-intake.ts:632`).
- Confirmed by `po-autoloop-self-test` (NO-SECOND-MUTATOR ×3), `goal-intake-self-test` (NO-SECOND-MUTATOR ×3),
  and `reconciler-self-test` (SINGLE-MUTATOR: reconciler is the only caller, exactly once). **No second mutator.**

### Criterion 3 — ★ C6-gates-DONE (the B1 fix) preserved · PASS
- My inverted-controller attack: the loop's OWN observed metric reported 1.0 every tick (a goal trying to
  self-certify done), but C6's INDEPENDENT re-probe returned 0.5. Result: durable contract ended **PLANNING**,
  finalState ≠ DONE. No tick both transitioned to DONE and carried an INCOMPLETE summon (no contradictory
  terminal). The gated boundary demonstrably used C6's 0.5 re-probe, not the loop's 1.0.
- Twin: a genuinely-met goal (C6 re-probe 1.0) STILL reached DONE — the gate is not stuck-closed.
- Mechanism confirmed: DONE is reached IFF `decideNextBoundary(review.verdict)`→`to:"DONE"`, which fires IFF
  `review.verdict==="COMPLETE"` from C6's independent re-probe (`po-autoloop.ts:423-425`, `c6GatedPlan` sets
  `observed_state` to the C6 value so routing and summary cannot disagree). No path through the controller forces
  a false-DONE. Mirrored by `po-autoloop-self-test` B1 + B1-twin + PORT-ENFORCE-B1.

### Criterion 4 — ★ summon never-dropped + intake identity fail-closed · PASS
- **Summon (founder-summon.ts):** all-channels-unavailable (no notifier) → escalated to the durable last-resort
  (`cannot_be_lost:true`), `dropped:false`; EMPTY channel array → `ensureDurableTerminal` still guarantees a
  terminal, `dropped:false`; ENFORCE with a configured notifier but no send seam → fails over to the durable
  terminal, never dropped. SHADOW with a notifier reporting Slack configured → **drafted, every attempt
  `sent:false`** (draft-don't-send; the real `send` is never invoked). `dropped` is structurally false on every
  result; the `if (!delivered) throw` makes a dropped summon un-returnable.
- **Intake identity (goal-intake.ts `checkFounderIdentity`):** SUBMIT and APPROVE both reject non-founder
  (`identity-not-founder`), unverified/self-asserted/forged (`identity-unverified`), absent (`identity-absent`),
  and **unset `FounderBindingPort`** (`founder-binding-unset` — allow-NONE, even for the real founder); the bound
  founder is admitted (not stuck-closed). SUBMIT proved the lifecycle seam NEVER ran on a rejected identity.
  FAP guards: forge→`unknown-fap`, expired→`expired-fap`, goal-mismatch→`fap-goal-mismatch`, replay→first
  succeeds then `fap-already-resolved` (no double-resume). 29/29 across my fixture + 24/24 + 34/34 self-tests.

### Criterion 5 — logic unchanged + residency + no regression · PASS
- **Diffs vs admin source** (comment + whitespace normalized, both directions):
  - `boundary-plan.ts` vs `boundary-plan-c2mind.ts`: only header comments + import re-pointing
    (`./goal-contract.js`→`./ports.js`, `./goal-supervisor-c7.js`→`./goal-supervisor.js`,
    `./completion-review-c6.js`→`./completion-review.js`) + deferred-throw/provenance string literals.
    `decideNextBoundary` / `computeRemaining` byte-for-byte.
  - `founder-summon.ts` vs `founder-summon-c1.ts`: the sanctioned `process.env[ref]`→`NotifierPort.isConfigured`
    residency closure (`notifierAvailability` added; `defaultProbe` made residency-clean + exported) + import
    re-pointing + label/string text. Chain walk, `ensureDurableTerminal`, `if(!delivered) throw` verbatim.
  - `po-autoloop.ts` vs `po-autoloop-c2.ts`: the free DB-coupled `tick`/`runGoalLifecycle` became closures inside
    `createGoalLifecycleController(ports)`; the four store accessors + `applyReconcilePlan` (now the reconciler
    *instance* method) + `reconciler = createReconciler(ports.contract)` are the only added executable lines.
    Decision logic (the gating conditions, summon branches, c6GatedPlan) unchanged.
  - `goal-intake.ts` vs `goal-intake-c1.ts`: `process.env.RUNTIME_FOUNDER_ID`→injected `FounderBindingPort`
    (`resolveFounderBindingFromPort`, fail-closed `founderId:null`); `runGoalLifecycle`→injected `ctx.runLifecycle`;
    `dbReadContract`/free `applyReconcilePlan`→injected reader + `reconciler.applyReconcilePlan` (no DB default,
    fail-closed throws). `checkFounderIdentity` (all four branches) + the FAP guards byte-for-byte (one string
    "Slack request-signature"→"request-signature").
- **Residency:** `residency-guard.mjs` CLEAN over all 31 package files; `--self-test` 5/5; a live-planted
  `postgres` + `./db/client.js` import was caught (exit 1, 2 offenders) and the scan returned CLEAN after removal.
- **No regression:** slices 1–3 self-tests + both invariant cages (§4.3 golden-master incl. admin-0053
  cross-check; C12 runtime-stores incl. admin-0052 cross-check) STILL green. `tsc --strict --noEmit` over
  `index.ts` (the production graph) clean.

## Bug reports
None. No criterion was unmet; no flake observed across repeated runs.

## Regression entries (already permanent in the harness)
- `governance-runtime-self-test.ts` (10) — factory composes + runs a full lifecycle on ports-only.
- `po-autoloop-self-test.ts` B1 / B1-twin / PORT-ENFORCE-B1 — C6-gates-DONE; NO-SECOND-MUTATOR ×3.
- `founder-summon-self-test.ts` / `goal-intake-self-test.ts` — never-dropped + identity fail-closed + FAP guards.
- `golden-master.ts` + `runtime-stores-cage.ts` — the TS⇄DB / C12 invariant pins (admin cross-checks live).

## Direct answers
- **Does a complete goal lifecycle run through `createGovernanceRuntime` with zero Postgres?** **YES** — proven by
  the primary probe (10/10) and an independently-authored ports-only fixture driving HAPPY→DONE and STALL→HALTED.
- **Do all four invariants survive?** **YES** — §15 single-mutator, C6-gates-DONE (B1), summon never-dropped, and
  intake identity-binding each survived direct independent attack.
