# VERIFY — governance-engine §4.3 state machine (Extraction Slice 1)

```yaml
slice: "governance-engine-state-machine — portable §4.3 validator + GoalContractStorePort + golden-master cage (Extraction Slice 1)"
author: Builder
verifier: qa-test (independent — author≠verifier, Governance §3/§12)
verified_at: 2026-06-29T19:20:03Z
independence_basis: recorded-distinct-invocation
machine_probe: "tsx templates/governance-engine/golden-master.ts"
verify_status: verified
```

## Verdict

**PASS — `verify_status: verified`.**

The load-bearing claim holds: the TypeScript validator (`state-machine.ts`) is a **provably-equal mirror**
of the Postgres §4.3 trigger. The golden-master cage **genuinely parses** the trigger DDL (not a hard-coded
edge list) and pins the TS legal-edge set against it in both directions (34 edges). Critically, the cage is
**not a rubber stamp**: I independently injected four distinct TS-vs-trigger divergences into throwaway copies
and the cage **failed (exit 1) on every one**, naming the specific drifted edge. Portable enforcement holds
with zero Postgres, residency is clean, and `tsc --strict` is clean.

## Does the cage FAIL when a TS-vs-trigger divergence is injected? — YES (the critical finding)

Four independent drift injections into throwaway copies (real implementation never modified), each verified for real:

| # | Injection (in COPY only) | Cage result | Specific drift it named |
|---|---|---|---|
| A | Removed legal edge `HALTED→REVIEWING` from the **DDL** (TS untouched) | **FAIL, exit 1** | `edges=33`, `ts=34 trigger=33`, `FAIL trigger has TS edge: HALTED->REVIEWING` |
| B | Added catastrophic edge `EXECUTING→DONE` to the **DDL** (TS untouched) | **FAIL, exit 1** | `edges=35`, `ts=34 trigger=35`, `FAIL TS has trigger edge: EXECUTING->DONE` |
| C | Removed `REVIEWING→DONE` from the **TS** `FORWARD_GOAL_EDGES` table (DDL untouched) | **FAIL, exit 1** | `ts=33 trigger=34`, `FAIL allow REVIEWING -> DONE` |
| D | Removed `FEASIBILITY→HALTED` from **both** DDL+TS (self-consistent at 33), ran against admin's REAL 0053 | **FAIL, exit 1** | provenance `[7]`: `admin=34 shipped=33`, `FAIL ZERO drift between shipped DDL and admin 0053 — drift=1` |

The cage is real. A missing edge, an extra (catastrophic) edge, a TS-table edit, and a vendored-DDL-vs-canonical
divergence are each caught with a specific, non-zero failure. The baseline COPY (no perturbation) exits 0, so the
failures are caused by the injected drift, not a broken harness.

## Execution evidence — acceptance criteria 1–5

| # | Criterion | Command (verbatim) | Result | Evidence |
|---|---|---|---|---|
| 1 | Cage proves TS == trigger (parses DDL, 34 edges both directions) | `tsx templates/governance-engine/golden-master.ts` | **PASS, exit 0** | `[1]` parses `migrations/0001_goal_contract.sql` → 11 states / terminal DONE,FAILED,CLOSED / 7 resumable / all 4 branch families / `trigger expands to 34 concrete change-edges`. `[2]` THE PIN: `same edge count ts=34 trigger=34`, all 34 `TS has trigger edge` + all 34 `trigger has TS edge`. `PINNED … (exit 0)`. The parser reads the SQL text (regex over the function body), not a literal edge array — confirmed by source inspection (`parseTrigger`, golden-master.ts L78–124). |
| 2 | Cage CATCHES drift (not a rubber stamp) + admin cross-check drift=0 | drift injections A–D above; `ADMIN_GOAL_CONTRACT_SQL=…/0053_goal_contract.sql tsx golden-master.ts` | **PASS** | Four injected divergences → four exit-1 failures naming the drift (table above). Independent cross-check against admin's REAL `rumah-admin/migrations/0053_goal_contract.sql`: `[7]` `admin 0053 expands to 34 edges`, `admin edge count == shipped`, `ZERO drift between shipped DDL and admin 0053 — drift=0 edges`. |
| 3 | Faithful mirror of admin's transition logic | source diff of `0001_goal_contract.sql` guard body vs `rumah-admin/migrations/0053_goal_contract.sql` guard body; cage `[4]`/`[5]`/`[6]` | **PASS** | Guard function bodies are byte-identical (the only de-admin'ing is the RLS role `{{app_role}}`, outside the parsed function). `[4]` refuses the full 76-edge illegal complement; `[5]` explicitly refuses all catastrophic edges incl. `EXECUTING→DONE`, `FAILED→EXECUTING`, `DONE→PLANNING`, `CREATED→DONE`, skip-edges. `[6]` SUSPEND/resume prev_state semantics match: resume legal only when target == captured prev_state, illegal when prev_state differs/absent, DONE not a resumable target. `computeNextPrevState` (state-machine.ts L90–98) is identical to admin `transition()` bookkeeping (goal-contract.ts L168–175). |
| 4 | Portable enforcement with NO DB | `tsx templates/governance-engine/scripts/self-test.ts` | **PASS, exit 0** | Full lifecycle CREATED→…→DONE, REVIEWING→HALTED→CLOSED, and ACTIVE→SUSPENDED→resume(ACTIVE) all run on the in-memory store (zero Postgres). `[5]` gap-closing proof: organ refuses illegal `CREATED→DONE` via TS validator with **no trigger present** and leaves state at CREATED, while the **raw unwrapped store accepts** the same illegal edge (`WOULD accept … the TS organ is what closes the gap`). `ALL PROOFS HOLD (exit 0)`. |
| 5 | Port faithful + residency + tsc strict | `node residency-guard.mjs`; `node residency-guard.mjs --self-test`; `tsc -p <strict>` | **PASS** | 5 port methods (`createContract`/`readContract`/`persistContract`/`transition`/`resume`) + types (`CreateGoalContractInput`/`GoalContractRow`/`BudgetCap`/`DataClass`/`GoalState`) match admin `src/goal-contract.ts` signatures verbatim. Residency: `CLEAN — no residency violations` (7 files, exit 0); `--self-test` 5/5 (detects db/client, postgres/pg, execFileSync-of-relative-tool; ignores comment mentions). `ports.ts`/`state-machine.ts` import no SQL/postgres. `tsc --strict` over the whole package: **exit 0**. |

## Notes / observations (non-blocking)

- **`tsc --strict` is clean (exit 0)** over the entire package using the established engine-consumer config
  (`module: ESNext, moduleResolution: Bundler`, mirroring `examples/engine-demo-app/tsconfig.json`). The
  package ships no `package.json` (by design, like `templates/workflow-engine/`); run via tsx + the consumer's
  tsconfig.
- Under the **stricter** `noUncheckedIndexedAccess` flag, only the dev-tooling cage `golden-master.ts` emits 10
  errors (regex match-group indexing typed `string | undefined`). This is **not a defect**: the canonical
  consumer config (`engine-demo-app/tsconfig.json`) explicitly **excludes** `golden-master.ts` + `scripts/**`
  from the typecheck for exactly this reason, and the **shipped library surface** (`state-machine.ts`,
  `ports.ts`, `goal-contract.ts`, `index.ts`) plus `scripts/` are clean even under `noUncheckedIndexedAccess`
  (verified, exit 0). No bug filed.

## Reproduction

```bash
cd C:/Users/brian/RUMAH/delivery-os
TSX=C:/Users/brian/RUMAH/rumah-admin/node_modules/.bin/tsx

# 1 — the cage (primary probe), with admin provenance cross-check
$TSX templates/governance-engine/golden-master.ts                      # exit 0, "PINNED", drift=0 vs admin 0053

# 2 — drift catches it (run in a throwaway copy; never edit the real files):
cp -r templates/governance-engine /tmp/ge-drift
sed -i "s/NEW.state IN ('PLANNING','REVIEWING','CLOSED')/NEW.state IN ('PLANNING','CLOSED')/" /tmp/ge-drift/migrations/0001_goal_contract.sql
ADMIN_GOAL_CONTRACT_SQL=/dev/null $TSX /tmp/ge-drift/golden-master.ts   # exit 1, names HALTED->REVIEWING

# 4 — portable, no DB
$TSX templates/governance-engine/scripts/self-test.ts                  # exit 0, "ALL PROOFS HOLD"

# 5 — residency + strict
node templates/governance-engine/residency-guard.mjs                   # exit 0, CLEAN
node templates/governance-engine/residency-guard.mjs --self-test       # exit 0, 5/5
# tsc --strict via engine-consumer tsconfig (module ESNext / moduleResolution Bundler) over the package → exit 0
```
