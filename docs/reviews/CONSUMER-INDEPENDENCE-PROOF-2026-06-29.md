# Consumer-Independence Proof — Extraction Slice 6: THE TERMINAL PROOF

**Date:** 2026-06-29
**Slice:** Platform Extraction — Slice 6 (the terminal proof that closes the extraction)
**Status:** BUILT — ready for independent VERIFY
**Artifact under proof:** `examples/finance-os-demo/` (a brand-new, clean-room consumer)
**Platform under proof:** `templates/governance-engine/` (vendored into the consumer at `vendor/governance-engine/`)

---

## 0. The founder's exact definition of done

> "prove that rumah-admin is only a consumer by creating (or simulating) a brand-new consumer that uses Delivery
> OS without copying Runtime logic. Delivery OS must become the single source of reusable Runtime capabilities."

This document is the evidence packet. Three independently-runnable artifacts make the proof:

| Command (in `examples/finance-os-demo/`) | What it proves | Result |
|---|---|---|
| `npm run finance:proof` | a NEW finance domain runs to **DONE** and a stall to **HALTED + summon** through `createGovernanceRuntime` | **GREEN 10/10** |
| `npm run scan:zero-admin` | the consumer transitively imports **ZERO** `rumah-admin`/`property-lead-os` Runtime code | **CLEAN** |
| `npm run plos:bonus` | a 2nd new domain (PLOS `qualified-leads-count`) runs to **DONE** on the SAME platform (N≥2) | **GREEN** |
| `npm run typecheck` | the consumer + the vendored engine typecheck clean | **0 errors** |

---

## 1. The brand-new consumer — it imports ONLY the platform engine + its own domain

The consumer is `examples/finance-os-demo/`. Its OWN source is exactly **5 files** (the rest is the vendored,
do-not-edit platform under `vendor/governance-engine/`):

```
examples/finance-os-demo/
├── run-finance-os.ts            ← drives GOAL 1 (DONE) + GOAL 2 (HALTED+summon); asserts; exits non-zero on fail
├── run-plos-lead-bonus.ts       ← BONUS: a PLOS lead-domain goal → DONE on the same platform
├── src/
│   ├── finance-domain.ts        ← the NEW finance domain: MRR + invoices-collected probes, acceptance, budget
│   ├── finance-runtime.ts       ← composes createGovernanceRuntime(ports) + the finance goal/lifecycle builders
│   └── plos-lead-domain.ts      ← the NEW lead domain (bonus): qualified-leads-count probe + fixture
├── scripts/
│   └── scan-zero-admin-imports.mjs   ← THE load-bearing transitive import scan
├── vendor/governance-engine/    ← the VENDORED Delivery OS platform (sha-pinnable; postgres adapter removed)
├── package.json · tsconfig.json · README.md
```

### 1.1 Every import in the consumer's own source

Each of the 5 consumer files imports from exactly two places: the **vendored platform barrel**
(`vendor/governance-engine/index.js` + the platform's shipped in-memory adapter) and its **own domain**. No file
imports `rumah-admin`, `property-lead-os`, or `@plos`.

`src/finance-domain.ts` (the NEW finance domain — descriptors are DOMAIN data; the descriptor type is a PLATFORM type):

```ts
import {
  ProbeRegistry,
  type MetricProbe,
  type BudgetCap,
  type AcceptanceShape,
} from "../vendor/governance-engine/index.js";

export const MRR_PROBE: MetricProbe = {
  probe_id: "monthly-recurring-revenue", version: 1, metric_kind: "scalar", type: "sql",
  target: "SELECT coalesce(sum(amount_cents), 0)::numeric / 100 AS value FROM finance_subscription WHERE status = 'active'",
  expected_shape: "1 row, col value::numeric (euros)", credential_ref: "FINANCE_RO_URL",
  extract: (rows) => Number((rows[0] as { value?: unknown } | undefined)?.value ?? null),
};
export const INVOICES_COLLECTED_PROBE: MetricProbe = {
  probe_id: "invoices-collected-ratio", version: 1, metric_kind: "ratio", type: "sql",
  target: "SELECT (count(*) FILTER (WHERE status = 'paid'))::numeric / nullif(count(*), 0) AS value FROM finance_invoice",
  expected_shape: "1 row, col value::numeric in [0,1]", credential_ref: "FINANCE_RO_URL",
  extract: (rows) => Number((rows[0] as { value?: unknown } | undefined)?.value ?? null),
};
export function financeProbeRegistry(): ProbeRegistry {
  return new ProbeRegistry().register(MRR_PROBE).register(INVOICES_COLLECTED_PROBE);
}
export const FINANCE_BUDGET: BudgetCap = { max_turns: 120, max_cost_cents: 12_000 };
export const MRR_ACCEPTANCE: AcceptanceShape = { op: ">=", target: 50_000, direction: "increase" };
export const COLLECTION_ACCEPTANCE: AcceptanceShape = { op: ">=", target: 1.0, direction: "increase" };
```

These metrics — `monthly-recurring-revenue`, `invoices-collected-ratio` — are **genuinely new**: they are not
admin's property/invoice/lead probes. The SQL targets read a fictional `finance_subscription` / `finance_invoice`
schema the platform has never seen.

`src/finance-runtime.ts` (the composition — ONE platform call wires the entire Runtime):

```ts
import {
  createGovernanceRuntime, type GovernanceRuntime, type GoalSubmission, type LifecycleContext,
  type SprintExecutor, type ObservedTickInput, type PreflightGoal, type PreflightContext,
  type ReachabilityVerdict, type GoalState, type FounderBindingPort, type CreateGoalContractInput,
} from "../vendor/governance-engine/index.js";
import { createInMemoryGoalContractStore, createInMemoryRuntimeStores } from "../vendor/governance-engine/scripts/in-memory-store.js";
import { financeProbeRegistry, FINANCE_BUDGET, MRR_ACCEPTANCE, MRR_TARGET, COLLECTION_ACCEPTANCE } from "./finance-domain.js";

export function createFinanceRuntime(): GovernanceRuntime {
  return createGovernanceRuntime({
    goalContractStore: createInMemoryGoalContractStore(),   // the platform's own shipped in-memory adapter
    runtimeStores:     createInMemoryRuntimeStores(),        // the platform's own shipped in-memory adapter
    founderBinding:    financeFounderBinding,                // the consumer's FounderBindingPort (fixture)
    probeRegistry:     financeProbeRegistry(),               // the consumer's OWN finance probes
  });
}
```

`run-finance-os.ts` imports only `./src/finance-runtime.js` + a type from the vendored barrel. The PLOS bonus
files import only the vendored barrel + `./src/plos-lead-domain.js`. (Full source on disk.)

---

## 2. Per-port wiring — what the consumer supplies vs. what the platform provides

`createGovernanceRuntime` accepts the 6 ports; the consumer supplies thin adapters and **receives the entire
Runtime** (every organ + the controller). This is the inversion the extraction exists to prove:

| Port (the seam) | What the CONSUMER supplies | What the PLATFORM gives back |
|---|---|---|
| `GoalContractStorePort` | `createInMemoryGoalContractStore()` (platform-shipped) | the §4.3 GoalContract organ (portable TS validator) |
| `RuntimeStoresPort` | `createInMemoryRuntimeStores()` (platform-shipped) | the 6 C12 durable stores (append-only ledger, breaker, …) |
| `FounderBindingPort` | the finance founder identity (fixture; fail-closed when unset) | identity-bound C1 intake / approval |
| `probeRegistry` | the consumer's OWN finance probes (MRR, invoices-collected) | C9 pre-flight metric-source resolution (version-pinned) |
| `credentialResolver` / `configReadiness` / `notifier` | (defaulted/inert in this in-memory proof) | the C6 re-probe seam, the C9 readiness oracle, the summon channels |

From those ports alone, the runtime exposes: `contract`, `reconciler`, `supervisor`, `sprintEngine`,
`controller`, `runGoalLifecycle`, `submitGoal`, `approveFap`, `resolveFounderBinding`. The consumer re-implements
**none** of these.

---

## 3. The goal-to-DONE + stall-to-HALTED run output (real, captured)

`npm run finance:proof` — drives both goals through the real §4.3 lifecycle on the in-memory ports (zero Postgres):

```
[GOAL 1 — Grow MRR to >= €50,000]
  statePath   : CREATED → EXECUTING → REVIEWING → DONE
  finalState  : DONE
    tick 0: EXECUTING → REVIEWING  [GS CONTINUE dGoal=20000 confirmed=true]  plan=TRANSITION_DONE  executed=true
    tick 1: REVIEWING → DONE        [GS CONTINUE dGoal=10000 confirmed=true]  plan=TRANSITION_DONE  executed=true  C6=COMPLETE(reprobe=50000)
  summons     : 0

[GOAL 2 — Collect 100% of issued invoices (STALL)]
  statePath   : CREATED → EXECUTING → REVIEWING → HALTED
  finalState  : HALTED
    tick 0: EXECUTING → REVIEWING  [GS HALT_AND_SUMMON dGoal=0 confirmed=false]  plan=EXECUTE_HALT  executed=true  SUMMON[ENFORCE]→durable-last-resort
    tick 1: REVIEWING → HALTED      [GS HALT_AND_SUMMON dGoal=0 confirmed=false]  plan=EXECUTE_HALT  executed=true
  summons     : 1

PASS  PLATFORM: createGovernanceRuntime wired every Runtime organ from the injected ports alone
PASS  PLATFORM: the founder identity resolved from the consumer's injected FounderBindingPort
PASS  GOAL 1: the full finance lifecycle reached DONE (REAL §4.3 transitions, zero Postgres)
PASS  GOAL 1: C6 INDEPENDENTLY gated the DONE boundary (COMPLETE) — the loop did not self-certify
PASS  GOAL 1: a REAL transition executed via the reconciler (the SOLE mutator, §15)
PASS  GOAL 1: the durable runtime stores captured the finance goal-delta series
PASS  GOAL 2: the stalled finance goal reached HALTED (the GS tripped on effort-without-progress)
PASS  GOAL 2: the Goal Supervisor TRIPPED (HALT_AND_SUMMON) — liveness ≠ progress
PASS  GOAL 2: a founder SUMMON was delivered (never dropped) — the platform paged the founder
PASS  GOAL 2: the HALT was reached via the legal §4.3 path EXECUTING→REVIEWING→HALTED

RESULT: GREEN (10/10)
```

Both terminal states are **real**: the post-run durable contract reads `DONE` / `HALTED` respectively (the run
asserts `runtime.contract.readContract(goalId).state` for each). The DONE boundary is owned by C6's INDEPENDENT
re-probe (the loop cannot self-certify); the HALT is the Goal Supervisor's effort-without-progress trip, and the
founder summon is delivered through the platform's guaranteed-reachability chain (`delivered_via:
durable-last-resort`, never dropped).

---

## 4. The zero-admin-import scan result (the load-bearing artifact)

`npm run scan:zero-admin` — a transitive walk from every consumer entry file, resolving each import edge to a
concrete file, hard-failing on any `rumah-admin` / `property-lead-os` / `@plos` reference (in a resolved path OR
in any import specifier anywhere in the reachable graph) and on any bare/unresolved non-`node:` import:

```
reachable files by classification:
  consumer-domain    5
  platform-engine    17

consumer-domain files (the consumer's OWN code):
  run-finance-os.ts
  src\finance-runtime.ts
  src\finance-domain.ts
  run-plos-lead-bonus.ts
  src\plos-lead-domain.ts

platform-engine files reached (the vendored Delivery OS governance-engine): 17
node builtins used (terminal, allowed): node:crypto

PASS: ZERO references to rumah-admin / property-lead-os / @plos anywhere in the reachable graph.
PASS: the consumer + the vendored engine import NOTHING outside themselves (only node: builtins).

VERDICT: CLEAN — finance-os-demo transitively imports ONLY the vendored platform engine + its own
         finance domain. ZERO rumah-admin / property-lead-os Runtime imports.
```

Independently corroborated: a raw scan of the entire vendored tree
(`grep -rhoE 'from "[^.][^"]*"'`) finds **no** non-relative import other than the word `postgres` appearing in a
**comment** in `metric-probe.ts` (the postgres adapter was removed when vendoring; the engine itself has zero
runtime dependencies). The only `node:` builtin reached across the whole graph is `node:crypto`.

---

## 5. PLOS lead-domain bonus — status: DELIVERED (fixture)

`npm run plos:bonus` runs a **second** brand-new domain — a property-lead-os style `qualified-leads-count` goal —
to DONE on the **same** vendored platform:

```
PLOS LEAD-DOMAIN BONUS — a 2nd new domain (qualified-leads-count) runs to DONE on the SAME platform
  statePath  : CREATED → EXECUTING → REVIEWING → DONE
  finalState : DONE
  C6 verdict : COMPLETE
BONUS RESULT: GREEN — N≥2 distinct domains, one platform, zero admin code.
```

Per the slice note, the live `@plos/db` is **intentionally not wired** (that would itself be a cross-app coupling
and is out of scope for this proof); the lead snapshot is a fixture (`src/plos-lead-domain.ts`). The proof this
adds: the platform serves an unrelated *lead* domain exactly as it serves *finance*, with the same single
`createGovernanceRuntime` call and the same import-cleanliness (the scan above includes the bonus files).

---

## 6. Conclusion

A brand-new consumer — with its own finance domain, its own founder identity, its own probes, and **not one line
of copied Runtime logic** — obtains the entire governance Runtime by vendoring `templates/governance-engine/` and
calling `createGovernanceRuntime(ports)`. It runs a real goal to DONE (C6-gated) and a real stall to
HALTED+summon (GS-tripped), on the in-memory ports, with a transitive import graph that contains **zero**
`rumah-admin` / `property-lead-os` references.

**If `rumah-admin` were deleted, this consumer keeps the Project Owner, Goal Intake, Sprint Planning, Goal
Supervisor, reconciler, lifecycle, and founder summon** — every organ lives in the platform, not in admin.
Delivery OS is therefore the platform and the single source of reusable Runtime capabilities; **rumah-admin is
only a consumer.** The extraction's terminal definition of done is met.

---

### Reproduce

```sh
cd examples/finance-os-demo
npm install
npm run finance:proof    # exit 0, GREEN 10/10
npm run scan:zero-admin  # exit 0, CLEAN
npm run plos:bonus       # exit 0, GREEN
npm run typecheck        # 0 errors
```

### For the independent VERIFY

- The proof's value rests on the scan being faithful: confirm `scripts/scan-zero-admin-imports.mjs` follows edges
  transitively and that its comment-stripping does not mask a real import (it strips `/* */` and `//` before
  matching). Re-running with the strip disabled should surface only the `metric-probe.ts` comment occurrence.
- Confirm the terminal states are read from the durable store (not just the in-memory `LifecycleResult`): the run
  asserts `runtime.contract.readContract(goalId).state` for both goals.
- The vendored engine is a byte copy of `templates/governance-engine/` minus `adapters/postgres/` and the
  self-test scripts (only `scripts/in-memory-store.ts` retained). A `diff -r` against the source confirms no
  organ file was edited.
