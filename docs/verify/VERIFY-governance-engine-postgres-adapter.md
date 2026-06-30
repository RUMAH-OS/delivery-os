---
slice: "governance-engine-postgres-adapter — de-admin'd migration template + reference Postgres adapter (Extraction Slice 5)"
author: Builder
verifier: qa-test (independent)
verified_at: 2026-06-29T00:00:00Z
independence_basis: recorded-distinct-invocation
machine_probe: "tsx templates/governance-engine/scripts/postgres-faithfulness-self-test.ts"
verify_status: verified
---

# VERIFY — governance-engine Postgres adapter + de-admin'd migration template (Extraction Slice 5)

**Verdict: VERIFIED.** The organs behave **byte-identically on real Postgres as on in-memory.** Run live against
admin's throwaway test DB (`postgres:16-alpine`, host `:55432`, `RUMAH_ENV=test`; **never prod**; DB torn down after).
The reference Postgres adapter is a faithful port implementation: a full goal lifecycle through `createGovernanceRuntime`
produced the **identical** run summary on both adapters, the six store invariants matched head-to-head, and the live
`0001/0053` state-machine trigger refused a raw `CREATED→DONE` UPDATE. The template applies + rolls back forward-only
clean, both cages stay PINNED (drift-0), the residency boundary is correct, and slices 1–4 show no regression.

## Independence
I did not author this code (author = Builder). Every result below is from my **own distinct invocations** recorded
verbatim. Probe binary: admin's `tsx`/`tsc` (`C:\Users\brian\RUMAH\rumah-admin\node_modules\.bin`), `NODE_PATH` →
admin `node_modules`, exactly the documented invocation.

## The load-bearing answer — do the organs behave byte-identically on Postgres vs in-memory?
**YES.** `createGovernanceRuntime` ran the canonical happy-path lifecycle on each adapter and distilled a comparable
`RunSummary`. Both produced, character-for-character:

```
in-memory: {"finalState":"DONE","contractStateAfter":"DONE","c6Complete":true,"realTransitionExecuted":true,"progressSeriesLen":6,"cumulativeCost":0}
postgres : {"finalState":"DONE","contractStateAfter":"DONE","c6Complete":true,"realTransitionExecuted":true,"progressSeriesLen":6,"cumulativeCost":0}
```

`JSON.stringify(memSummary) === JSON.stringify(pgSummary)` → **true.** Same DONE state, same C6 gate, same real §4.3
transition, same 6-point progress series. Store invariants (`storeInvariantParity`) were also byte-identical between
adapters. **18/18 passed, exit 0.**

## Execution-evidence table (criteria 1–5)

| # | Criterion | Probe (my invocation) | Result | Verdict |
|---|---|---|---|---|
| 1 | **Postgres faithfulness** (load-bearing) | `npm run db:test:up` (admin), then `GOVERNANCE_TEST_DATABASE_URL=postgres://rumah:rumah@localhost:55432/rumah_admin_test NODE_PATH=<admin>/node_modules tsx scripts/postgres-faithfulness-self-test.ts` | **18/18 passed, exit 0.** Lifecycle DONE on both adapters; **summaries byte-identical**; all 6 store invariants identical mem⇄pg (append-only no-op, dup-attempt throw, PK-race write-once, consume write-once, breaker opens@threshold+cooldown, cumulative cost 100→150); live `0001/0053` trigger **refused** raw `CREATED→DONE` UPDATE (state stayed CREATED) | PASS |
| 2 | **Template applyable + de-admin'd + cage-consistent** | (a) explicit up→verify→down→verify→re-up cycle via `applyTemplateMigrations`/`dropTemplateMigrations`; (b) `grep "{{...}}" migrations/`; (c) `tsx golden-master.ts`; (d) `tsx runtime-stores-cage.ts` | (a) UP → **7/7 tables, 10 triggers, 3 guard fns**; DOWN → **0/0/0** (forward-only clean); RE-UP → 7/3; final clean 0. (b) only `{{app_role}}` (26 occ), no other placeholder. (c) golden-master **PINNED, drift=0, admin 0053 expands to 34 edges == shipped**, exit 0. (d) runtime-stores cage **PINNED, 6 tables == admin 0052**, exit 0 | PASS |
| 3 | **Adapter faithful (SQL verbatim)** | spot-diff `adapters/postgres/{runtime-stores,goal-contract}.ts` vs admin `src/{runtime-stores,goal-contract}.ts` | CAS transition (`UPDATE goal_contract SET state=… WHERE goal_id=… AND state=<observed> RETURNING *`), `pg_advisory_xact_lock(hashtext(goalId))` in `sql.begin`, `ON CONFLICT (goal_id,cycle) DO NOTHING`, `ON CONFLICT (step_id) DO UPDATE` breaker CASE, `make_interval(secs=>…)` — all **lifted verbatim**; only change is `sql` injected into a factory vs module-level import. All 14 `RuntimeStoresPort` methods + 5 `GoalContractStorePort` methods present; 6-port barrel exports all six ports | PASS |
| 4 | **Residency boundary correct** | `node residency-guard.mjs`; `grep` organ surface for real postgres/`db/client` imports | Guard **CLEAN over 32 files**, exit 0; `adapters/` excluded by design (`SKIP_DIR`) and justified — it is the consumer-side SQL plane, not an organ. **No slice-1–4 organ file imports postgres/`./db/client.js`** (every grep hit is a comment; the detector skips comments). The adapter is the only place SQL lives | PASS |
| 5 | **No regression** | all 12 slice 1–4 self-tests via admin `tsx`; `tsc --strict --noEmit` over engine `index.ts` and adapter | self-test ALL PROOFS HOLD; **governance-runtime 10/10**, po-autoloop **42/42**, reconciler **25/25**, sprint-engine **45/45**, **GS 39/39**, goal-intake 34/34, metric-probe 14/14, preflight 12/12, boundary-plan 15/15, completion-review 12/12, founder-summon 24/24 — all exit 0. Both cages still PINNED. `tsc --strict` engine `index.ts` → **exit 0 clean**; adapter → **exit 0 clean** (with `postgres` resolvable, ESM mode) | PASS |

## Builder's two honest caveats — confirmed
1. **Run is as the container superuser (`rumah`).** Confirmed the **trigger-enforced** behavior fires regardless of
   role: criterion 1 [3] issued a raw `UPDATE goal_contract SET state='DONE'` (bypassing the organ entirely) and the
   `goal_contract_state_machine_guard` BEFORE-UPDATE trigger **threw**, state stayed `CREATED`. BEFORE triggers fire
   for the table owner/superuser too — that is the point, and it held. *Note (not a defect):* the **RLS** policies
   (the non-superuser least-privilege boundary) were not exercised at runtime, because a superuser bypasses RLS; the
   RLS shape is instead pinned statically by the runtime-stores cage ("NO UPDATE/DELETE RLS policy on append-only
   stores" parsed == admin 0052). RLS is defense-in-depth, not this slice's load-bearing claim — organ faithfulness +
   the owner-proof trigger are, and both are proven live.
2. **`cumulativeCost=0` in the happy path** is correct: the summary reads the **observed** cost
   (`readCumulativeCost`), and the happy path appends none. The cost path itself is proven **separately** in the
   store-invariant parity [2], where `appendCost` 100→150 was verified **identically** on both adapters.

## How to reproduce
```sh
cd C:/Users/brian/RUMAH/rumah-admin && RUMAH_ENV=test npm run db:test:up
cd C:/Users/brian/RUMAH/delivery-os/templates/governance-engine
GOVERNANCE_TEST_DATABASE_URL=postgres://rumah:rumah@localhost:55432/rumah_admin_test \
  NODE_PATH=C:/Users/brian/RUMAH/rumah-admin/node_modules \
  ../../../rumah-admin/node_modules/.bin/tsx scripts/postgres-faithfulness-self-test.ts
# expect: 18/18 passed, exit 0  ·  summaries byte-identical mem⇄pg
cd C:/Users/brian/RUMAH/rumah-admin && RUMAH_ENV=test npm run db:test:down
```

## Bug reports
None. All five acceptance criteria met by running; no defects filed.

## Disposition
`verify_status: **verified**` — the organs are byte-identically faithful on Postgres vs in-memory, the template
applies/rolls-back forward-only clean and matches both cages (drift-0), the residency boundary is correct, and there
is no regression. The extraction preserves behavior on a real database.
