# VERIFY — Platform Independence, M1 (delivery-os boots bare)

**Slice:** E-PH / M1 — `delivery-os` becomes a runnable OS that boots with **zero tenant programs**.
**Invariant under test:** I-PI (Platform Independence) — `PLATFORM-HOME-EXTRACTION.md §2`.
**Scope of this VERIFY:** the M1 subset of the bare-OS survival battery — `§2.2` steps **1–3** (bare boot,
bare PO+reconciler idle, bare goal lifecycle with stamped events). Steps 4–6 (register a tenant cell, delete
it, cross-tenant non-interference) are **M3+** and explicitly out of M1 scope.

## Author ≠ verifier (honest status)

This document is the **author's reproducible evidence capture** (git identity `rumah-os-builder`, the same
identity that authored the impl). It is **NOT** a self-certification of the binding gate. Per `verify-gate`
(DECISIONS D9), a slice is "verified" only once an **independent** verifier (`rumah-os-verifier`) re-runs this
battery on **neutral hardware** and the server-side `verify-coverage` CI check + CODEOWNERS review accept it.
That independent run is **pending** and is a condition of merge — the author does not merge.

The evidence below is fully reproducible from a clean checkout by the quickstart in `platform/README.md`, so an
independent verifier can build its **own** local Postgres fixture and re-derive every observable.

## Fixture

- Local throwaway Postgres 16 (Homebrew), `DATABASE_URL=postgres://os@127.0.0.1:55433/delivery_os_platform`.
- **No tenant schema** applied — only the OS's own migration set. This is the bare platform DB.
- Toolchain: Node 22, `tsx`/`vitest`. Deps pinned to rumah-admin's proven versions (hono/drizzle/postgres/zod).

## Observables (M1 — §2.2 steps 1–3)

### Step 1 — BARE BOOT + migrations apply clean

- The runnable process boots bare (real `tsx src/index.ts`), migrates, serves `/v1`, arms the heartbeat:

  ```
  [boot] migrations up to date (11 discovered, 0 applied)
  [boot] delivery-os-platform/M1 engine constructed — registered tenant packs: 0 (bare OS)
  [boot] heartbeat/reconciler loop started (node os-runtime-local)
  [boot] OS listening on :8791 — bare (zero tenants). Front door: POST /v1/goals
  ```
- `GET /v1/health` → `{"ok":true,"os":"delivery-os-platform/M1","registeredPacks":[],"tenantPackCount":0,"zeroTenants":true}`
- `GET /v1/capabilities` → `{"registeredPackIds":[],"enqueueKeys":[],"selectors":[],"empty":true}` (the
  capability registry returns an **empty tenant set** — §2.2 step 1).
- Migrations apply **clean on a fresh bare DB** (11 applied) and are **idempotent** (0 on re-run):

  ```
  apply  0000_platform_app_role.sql   apply 0001..0005 (engine)   apply 0006_platform_outbox.sql
  apply  0052_runtime_durable_stores.sql   apply 0053_goal_contract.sql
  apply  0054_prod_write_override_events.sql   apply 0055_goalcontract_event_stream.sql   (PR #50)
  ✓ OS migrations up to date (11 discovered, 11 applied)      # first run
  ✓ OS migrations up to date (11 discovered,  0 applied)      # idempotent re-run
  ```
- Tables created are **OS-owned only** — no tenant domain table (no `invoice`/`property`/`contract`):
  `goal_contract, goal_contract_event, workflow_run, workflow_step, outbox, engine_heartbeat,
  goal_delta_ledger, attempt_ledger, circuit_breaker, idempotency_store, dead_letter, portfolio_cost_ledger,
  prod_write_override_events, workflow_approval_audit`. The `rumah_app` least-privilege role is created by the
  OS's own `0000` bootstrap (not a tenant migration).

### Step 2 — BARE PO + RECONCILER idle

- A reconciler sweep over the **empty portfolio** is a legal idle no-op: `{ swept: 0, transitions: 0 }`.
- A full heartbeat `beat()` (stamp liveness → engine tick → reconciler sweep) runs idle: engine tick
  `advanced=false`, sweep `swept=0`, and `/v1/heartbeat` reports `armed=true` (dead-man switch armed).

### Step 3 — BARE GOAL LIFECYCLE with stamped events (zero tenant packs)

- A `GoalContract` is created and driven **CREATED → FEASIBILITY → ACTIVE → PLANNING → EXECUTING → REVIEWING →
  DONE** with **zero tenant packs registered** throughout.
  - The admission edges (CREATED→…→REVIEWING) go through the sole `transition()` door (goal-contract.ts).
  - The final **REVIEWING→DONE** is driven by the **reconciler** (`po-reconciler-c2.applyReconcilePlan`, the
    frozen **sole mutator**) in ENFORCE with an acceptance-met observed state → decision `TRANSITION_DONE`.
- **The PR-#50 dual-write:** exactly **one** stamped `goal_contract_event` per transition (6 events), `seq`
  monotonic 1..6, correct `from_state`/`to_state`, `actor = po-reconciler-c2`, `schema_id =
  goal_contract.transition` v1, partitioned `tenant_id = RUMAH` / `stream_id = default` (I11), payload
  `state_machine_version = 1` (I12).
- **Dual-write atomicity:** an illegal edge (CREATED→DONE) is rejected by the 0053 DB trigger, leaves the state
  unchanged, and writes **no** event (the tx rolls back).
- **Fail-closed front door:** `POST /v1/goals` on the bare OS → **422 no-match** (the deleted/absent-tenant
  degradation — fail-closed, never a crash).
- **Vendor→consume FLIP proven:** a capability registered at **runtime** via `os.registerCapabilityPacks([...])`
  (no tenant code, just a `CapabilityPack` = data) becomes selectable, and the same `POST /v1/goals` now routes
  to a real enqueued run (201). The OS boots knowing none; a consumer registers into it.

## Test result (author run)

```
✓ test/bare-os.test.ts (10 tests) — 10 passed
  step 1 — BARE BOOT (zero tenant packs) + migrations apply clean  (4)
  step 2 — BARE PO + RECONCILER idle on an empty portfolio         (2)
  step 3 — BARE GOAL LIFECYCLE with stamped events                 (2)
  step 3 (cont.) — fail-closed front door + the vendor→consume FLIP (2)
Test Files  1 passed (1)   Tests  10 passed (10)
```

`npx tsc -p tsconfig.json --noEmit` → clean (0 errors).

## Faithfulness notes

- `goal-contract.ts` and `po-reconciler-c2.ts` are **byte-identical** vendored copies of the live rumah-admin
  organs (`shasum` matched at vendor time) — including the PR-#50 event dual-write. No rewrite.
- The engine is the vendored `templates/workflow-engine` source, run (not just templated). Construction is the
  real `createCapabilityRuntime` platform-bootstrap contract, called with `packs: []`.
- The only OS-authored SQL is the platform's own **role bootstrap** (`0000`) and **outbox** (`0006`) — both are
  installer/platform-owned infra the OS must own to boot bare (in rumah-admin these came from tenant migrations,
  which the OS does not apply). The re-homed OS migrations `0052/0053/0054/0055` are unchanged.

## Not proven here (out of M1 scope — see PR "what M2/M3 still move")

Steps 4–6 of the battery (register `rumah-admin` as cell #1 via the registration API, delete it, confirm the OS
+ PLOS keep running) require the tenant-side consumer wiring (M3) and a second cell (M4). The dependency-direction
CI lint and the real (asymmetric-JWKS) auth are M2/M3. Real platform Supabase + a Vercel/Neo deploy target are
the M1 follow-up deployment step.
