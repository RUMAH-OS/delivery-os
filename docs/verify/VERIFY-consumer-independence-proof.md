---
slice: "consumer-independence-proof — brand-new Finance OS consumer runs the governance Runtime with zero admin code (Extraction Slice 6, TERMINAL gate)"
verifier: "qa-test (independent verifier; author≠verifier, Governance §3/§12)"
verified_at: "2026-06-29T21:35:44Z"
git_head: "5a6c3d8"
independence_basis: recorded-distinct-invocation
machine_probe: "cd examples/finance-os-demo && npm run finance:proof && npm run scan:zero-admin"
verify_status: verified
---

# VERIFY — Consumer-Independence Proof (Extraction Slice 6, the TERMINAL gate)

**Verdict: VERIFIED.** A brand-new Finance OS consumer runs the entire Delivery OS governance Runtime —
goal→DONE and stall→HALTED+summon — through the vendored `governance-engine`, with **genuinely zero
rumah-admin / property-lead-os Runtime code on any live transitive path.** The zero-admin claim survived an
adversarial attack (independent transitive grep + dynamic-import / alias / dependency hunt). The vendored engine
is byte-faithful to `templates/governance-engine/` modulo the documented exclusions. Typecheck is clean.

Code under test: `C:\Users\brian\RUMAH\delivery-os\examples\finance-os-demo\`. **No implementation was modified.**
All evidence is from real, independently-recorded invocations on a clean `node_modules` (deleted + reinstalled).

---

## Evidence table (criteria 1–5)

| # | Criterion | Method (run for real) | Result |
|---|---|---|---|
| 1 | Goal genuinely runs to DONE + stall to HALTED+summon; terminal states re-read from the durable store; full lifecycle fires (not a hard-coded DONE) | `npm run finance:proof` (exit 0) | **PASS — GREEN 10/10.** GOAL 1 `CREATED→EXECUTING→REVIEWING→DONE` with `C6=COMPLETE(reprobe=50000)`; GOAL 2 `…→HALTED` with `GS HALT_AND_SUMMON` + `SUMMON[ENFORCE]→durable-last-resort`. Terminal states asserted via `runtime.contract.readContract(goalId).state` (a re-read of the GoalContract store, distinct from the `LifecycleResult` object) — both checks PASS. |
| 2 | ★ ZERO admin code — attacked hardest | `npm run scan:zero-admin` (exit 0) + my own independent transitive grep + dynamic-import/alias/dep hunt | **PASS — CLEAN.** No live transitive path to admin/PLOS Runtime code. See "The attack" below. |
| 3 | Vendored engine is faithful (real verified platform, not a hand-modified copy) | `diff -rq vendor/governance-engine templates/governance-engine` | **PASS.** Only differences are **deletions** (the `adapters/` dir incl. postgres + the 13 self-test scripts; `scripts/in-memory-store.ts` retained). **Zero content differences in any retained organ file.** |
| 4 | Domain genuinely new + no Runtime logic in the consumer | Source read of all 5 consumer files | **PASS.** Consumer source = probe descriptors (`monthly-recurring-revenue`, `invoices-collected-ratio`, `qualified-leads-count` — fictional `finance_subscription`/`finance_invoice`/`plos_lead` schema, not admin's probes) + budget/acceptance constants + fixture trajectories + wiring. No state-machine / reconciler / GS / C6 / summon logic is reimplemented — all organs come from the vendored engine. |
| 5 | Typecheck clean | `npm run typecheck` (`tsc --noEmit`) | **PASS — 0 errors.** |

Bonus (N≥2): `npm run plos:bonus` → exit 0, GREEN — a 2nd unrelated domain (`qualified-leads-count`) reaches DONE on the same `createGovernanceRuntime`.

---

## Criterion 1 — the goal genuinely runs to DONE (objective, not a stub)

Verbatim `npm run finance:proof` output (exit 0):

```
[GOAL 1 — Grow MRR to >= €50,000]
  phase       : ADMITTED   posture: ENFORCE
  preflight   : admit=true
  statePath   : CREATED → EXECUTING → REVIEWING → DONE
  finalState  : DONE
    tick 0: EXECUTING → REVIEWING  [GS CONTINUE dGoal=20000 confirmed=true]  plan=TRANSITION_DONE  executed=true
    tick 1: REVIEWING → DONE  [GS CONTINUE dGoal=10000 confirmed=true]  plan=TRANSITION_DONE  executed=true  C6=COMPLETE(reprobe=50000)
  summons     : 0

[GOAL 2 — Collect 100% of issued invoices (STALL)]
  statePath   : CREATED → EXECUTING → REVIEWING → HALTED
  finalState  : HALTED
    tick 0: EXECUTING → REVIEWING  [GS HALT_AND_SUMMON dGoal=0 confirmed=false]  plan=EXECUTE_HALT  executed=true  SUMMON[ENFORCE]→durable-last-resort
    tick 1: REVIEWING → HALTED  [GS HALT_AND_SUMMON dGoal=0 confirmed=false]  plan=EXECUTE_HALT  executed=true
  summons     : 1
RESULT: GREEN (10/10)
```

This is the **real §4.3 lifecycle through the vendored controller**, not a hard-coded outcome:
- **The reconciler is the sole mutator** (`executed=true`) — every state edge is a real `runtime.contract.transition`.
- **C6 independently gated DONE** — GOAL 1 reaches DONE only because the platform's `reviewCompletion` re-probe returned `COMPLETE(reprobe=50000)`. The loop did not self-certify.
- **The GS tripped on its own judgement** — GOAL 2's consumer supplies a *flat 0.40 trajectory* (effort spent, no movement); the **platform's** Goal Supervisor — not the consumer — decided `HALT_AND_SUMMON` (`dGoal=0 confirmed=false`). The consumer chooses the inputs; the organ chooses the verdict. That is the proof the organ is real.
- **The summon was delivered, never dropped** — `SUMMON[ENFORCE]→durable-last-resort`, `summons=1`.
- **Durable re-read** — both terminal states are asserted from `runtime.contract.readContract(goalId).state` (the store), independent of the result object; both PASS.

## Criterion 2 — ZERO admin code (the attack)

`npm run scan:zero-admin` → **CLEAN** (exit 0): `consumer-domain 5`, `platform-engine 17`, only `node:crypto` reached, "ZERO references to rumah-admin / property-lead-os / @plos anywhere in the reachable graph."

I did **not** trust the scan. My independent corroboration:

- **(2a) Transitive coverage is real.** The scan recurses every resolved import edge from all 5 entry files; the engine barrel `index.js` fans out to the 17 organ/port files. `19 vendor .ts files − 2 unreachable cage files = 17` matches the scan's count exactly.
- **(2b) Tried to fool it — nothing got through.**
  - **Dynamic `import()` / `require()`:** none in the consumer or vendor tree (the 2 grep hits are a `console.log` string and a prose comment — not call sites).
  - **Re-exports:** the scan's regex matches `export … from "…"`, so re-export edges are followed.
  - **`package.json` dependency on admin/PLOS:** none — only devDeps `tsx`/`typescript`/`@types/node`; no admin/PLOS token in `package-lock.json`. The only runtime code is the vendored engine + `node:` builtins.
  - **tsconfig path alias:** no `paths` key — no alias to reach a sibling app.
  - **Relative `../../../rumah-admin` import reach-out:** no `import`/`from` statement resolves outside the consumer dir.
  - **Compiled `.js` shadow files** (could bypass a `.ts` scan): none in `vendor/` or `src/`.
- **(2c) My own `grep -rn`** for `rumah-admin | property-lead-os | @plos | ../../src` across the consumer + vendor tree: **every hit in a reachable file is comment prose or a console-log string** (e.g. the `// PLATFORM EXTRACTION SLICE n — the port-injected mirror of rumah-admin/src/…` provenance headers, the `FORBIDDEN` regex literals in the scan itself, and the package description). Confirmed line-by-line.
- **(2d)** Confirmed `package.json` declares no admin/PLOS dependency; the only runtime dep is the vendored engine + node builtins.

**OBSERVATION (NON-BLOCKING) — two excluded cage files contain live admin path strings.**
`vendor/governance-engine/golden-master.ts:49` and `vendor/governance-engine/runtime-stores-cage.ts:35` build a filesystem path with `join(…, "rumah-admin", "migrations", "0053_goal_contract.sql" / "0052_runtime_durable_stores.sql")` behind an `ADMIN_*_SQL` env default. These are **live code, not comments** — but they are the **only** such references, and they are **harmless to this proof**:
- both files are **unreachable** — nothing in `index.ts` or the reachable graph imports them (confirmed: zero importers);
- both are **tsconfig-excluded** (`golden-master.ts`, `runtime-stores-cage.ts`);
- they reference admin **migration SQL** (a golden-master/cage faithfulness self-test), **not admin Runtime code** — so even if run they would not import an admin organ.

This does **not** meet criterion 2's blocking condition ("any live transitive path to admin Runtime code"). The zero-admin claim holds for the consumer's actual run path. *Tightening suggestion for the engineer (not a gate failure): exclude these two cage scripts from the vendored copy too, alongside the self-test scripts, so the vendored tree carries no admin-path strings at all.*

## Criterion 3 — vendored engine is faithful

`diff -rq examples/finance-os-demo/vendor/governance-engine templates/governance-engine` reports **only "Only in templates…"** lines (the `adapters/` dir + the 13 `*-self-test.ts` scripts). **No "Files … differ" line** — every retained organ/port/barrel file is byte-identical to the source of truth. The consumer runs the real, verified platform engine; the documented exclusions (`adapters/postgres` + self-test scripts, `scripts/in-memory-store.ts` retained) are exactly what is absent.

## Criterion 4 — domain genuinely new, no Runtime logic in the consumer

The 5 consumer files contain only: `MetricProbe` descriptors over a fictional finance/lead schema (genuinely not admin's probes), `BudgetCap`/`AcceptanceShape` constants, fixture trajectories, a `rampExecutor` that drives the **platform's** `runtime.contract.transition` over legal §4.3 edges (it does not implement a state machine), and the `createGovernanceRuntime(ports)` wiring. No reconciler / supervisor / completion-review / summon / state-machine body is written by the consumer.

## Criterion 5 — typecheck clean

`npm run typecheck` (`tsc --noEmit`) → 0 errors (exit 0).

---

## Final answer to the gate question

**Does the brand-new consumer run the entire governance Runtime with genuinely ZERO rumah-admin code? — YES.**

The Finance OS consumer obtains the full Runtime (Goal Intake · pre-flight · reconciler · Goal Supervisor · Sprint
Engine · completion-review · founder-summon · lifecycle controller) from a single `createGovernanceRuntime(ports)`
call over the vendored, byte-faithful platform engine. It runs a finance goal to a C6-gated DONE and a finance
stall to a GS-tripped HALTED+summon, with both terminal states re-read from the durable store. Across an
adversarial transitive scan + my independent grep + a dynamic-import / alias / dependency / compiled-shadow hunt,
**I found no live transitive path to rumah-admin or property-lead-os Runtime code.** The only admin string
references in the vendored tree are in two unreachable, tsconfig-excluded cage/self-test files that point at admin
*migration SQL*, not Runtime logic — benign to the claim. If rumah-admin were deleted, this consumer keeps every
Runtime organ. **Delivery OS is the platform; rumah-admin is only a consumer. The extraction's terminal gate is
VERIFIED.**

### Re-run to reproduce
```sh
cd examples/finance-os-demo
rm -rf node_modules && npm install
npm run finance:proof    # exit 0, GREEN 10/10
npm run scan:zero-admin  # exit 0, CLEAN
npm run plos:bonus       # exit 0, GREEN
npm run typecheck        # 0 errors
diff -rq vendor/governance-engine ../../templates/governance-engine   # only deletions, no content diffs
```
