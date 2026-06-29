# Platform Extraction Blueprint — the goal-governance Runtime → `templates/governance-engine/`

**Date:** 2026-06-29
**Type:** EXECUTABLE PLAN (not an audit). READ-ONLY against code; this document is the only artifact. No code changed.
**Builds on (does not redo):**
- `docs/reviews/PLATFORM-EXTRACTION-AUDIT-2026-06-29.md` — the per-capability verdict (PASS 12 · PARTIAL 4 · FAIL 11), the TWO raw-SQL sinks as the entire blocker, 12/14 organs already generic/seam-injected, zero admin-domain table leakage.
- `docs/reviews/ARCHITECTURE-VALIDATION-platform-vs-consumer-2026-06-29.md` — the `GoalStorePort` thesis.

**The thing being built:** lift the 14 goal-governance organs out of the first consumer (`rumah-admin/src/*-c*.ts`) into a vendored, DB-agnostic platform package `delivery-os/templates/governance-engine/`, exactly as the C11 Result-Bus was lifted into `templates/workflow-engine/`. Consumers then `engine:install` it byte-identical and supply a thin Postgres adapter — the proven model (`property-lead-os/.claude/os/engine/`, `apps/web/lib/engine/runtime.ts`).

**The model being mirrored (proven twice — engine + infra):** the engine declares ports (`EngineContext`, `DbLike`, `HumanPrincipalPort`, `AgentExecutor`) and takes impls as parameters; `createCapabilityRuntime({ context, humanPrincipal, auth, packs })` is the single bootstrap call (`templates/workflow-engine/capability-pack.ts:172`); PLOS composes the identical call with `@plos/db` + Supabase-JWT and zero admin code (`property-lead-os/apps/web/lib/engine/runtime.ts:18-60`). **This blueprint reproduces that shape one-for-one for governance.**

**The whole distance, stated once:** until the organs stop importing `./db/client.js`, the platform's central claim is aspirational. The moment they import a port instead, it is true. Everything below is the ordered, validated way to cross that distance without breaking admin for a single tick.

---

## 1. The interfaces — a re-typing, not a redesign

Each port below is lifted **verbatim** from signatures that already exist on disk. No method is invented; the bodies that exist today become the Postgres adapter's bodies. The Postgres-specifics (`pg_advisory_xact_lock`, `make_interval`, `ON CONFLICT`, the 0053 state-machine trigger) live **behind** the port — the adapter owns them; the organ only calls a method.

### 1.1 `RuntimeStoresPort` — from `rumah-admin/src/runtime-stores.ts` (the 6 C12 durable stores)

Lifted from the 14 exported functions (~23 SQL statements) over the 6 governance tables. The port is the **exact** current signature set; types (`ProgressSampleInput`, `AttemptInput`, `BreakerRow`, `BreakerState`, `DeadLetterInput`, `CostInput`) move into the package's `ports.ts` unchanged.

```ts
export interface RuntimeStoresPort {
  // 1) goal_delta_ledger  (the GS dGoal/dEffort series; idempotent on (goal_id, cycle))
  appendProgressSample(s: ProgressSampleInput): Promise<boolean>;
  readProgressSeries(goalId: string): Promise<Array<{
    cycle: number; value: number | null; predicted: number | null; fixRef: string | null; ts: Date;
  }>>;

  // 2) attempt_ledger  (immutable; unique on (step_id, attempt))
  recordAttempt(a: AttemptInput): Promise<void>;
  countAttempts(goalId: string): Promise<number>;

  // 3) circuit_breaker  (DURABLE — survives restart)
  getBreaker(stepId: string): Promise<BreakerRow | null>;
  recordFailure(stepId: string, opts?: {
    goalId?: string | null; runId?: string | null; threshold?: number; cooldownMs?: number;
  }): Promise<BreakerRow>;
  coolBreaker(stepId: string): Promise<BreakerRow | null>;
  closeBreaker(stepId: string): Promise<BreakerRow | null>;

  // 4) idempotency_store  (write-ahead-intent; PK race ⇒ exactly-one reserved)
  reserveIntent(key: string, opts?: {
    ttlSeconds?: number; scope?: string | null; runId?: string | null;
  }): Promise<{ reserved: boolean }>;
  consumeIntent(key: string): Promise<{ consumed: boolean }>;
  isConsumed(key: string): Promise<boolean>;

  // 5) dead_letter  (append-only poison-step terminal record; before the boundary FAP)
  recordDeadLetter(d: DeadLetterInput): Promise<string>;

  // 6) portfolio_cost_ledger  (runtime spend; per-goal serialized cumulative)
  appendCost(c: CostInput): Promise<{ cumulativeCostCents: number }>;
  readCumulativeCost(goalId: string): Promise<number>;
}
```

**What stays behind the port (the adapter owns, the organ never sees):**
- `pg_advisory_xact_lock(hashtext(goalId))` inside `sql.begin(...)` for `appendCost` (`runtime-stores.ts:216-227`) — the per-goal serialization is a Postgres detail; `appendCost` is the contract.
- `ON CONFLICT … DO NOTHING` / `DO UPDATE`, `make_interval`, the CAS-on-observed-state `UPDATE … WHERE breaker_state='open'` — all storage mechanics.
- The store **invariants** (append-only, write-once-consume, durable breaker) enforced by RLS + guard triggers in migration 0052 — DB-side, and they travel as the migration **template** (§2), not as organ code.
- The SESSION-pooler (5432, not :6543) connection rule (`runtime-stores.ts:9`) — an adapter-construction concern.

### 1.2 `GoalContractStorePort` — from `rumah-admin/src/goal-contract.ts` (the durable PO contract)

Lifted from the 5 exported functions (6 statements) over `goal_contract`. Types (`GoalState`, `DataClass`, `BudgetCap`, `CreateGoalContractInput`, `GoalContractRow`) move into `ports.ts` unchanged.

```ts
export interface GoalContractStorePort {
  createContract(input: CreateGoalContractInput): Promise<GoalContractRow>;
  readContract(goalId: string): Promise<GoalContractRow | null>;
  persistContract(input: CreateGoalContractInput & { goalId: string }): Promise<GoalContractRow>;
  // LEGAL state move only. The §4.3 legality is enforced by the 0053 trigger (goal_contract_state_machine_trg),
  // NOT by this method — an illegal edge throws from the DB. transition() does CAS on the observed `from` state.
  transition(goalId: string, to: GoalState): Promise<GoalContractRow>;
  resume(goalId: string): Promise<GoalContractRow>;
}
```

**The load-bearing legal-edge fact (kept honest):** the state machine's legality is **not** in the organ and must not move into it. It lives in the DB trigger (0053). So `transition()` is a method that *asks the DB to move the state* and surfaces the trigger's rejection. The port preserves this exactly: the organ calls `store.transition(goalId, "EXECUTING")`; the adapter issues the CAS `UPDATE`; the trigger is the owner-proof enforcer for every role, even a raw SQL UPDATE. **The state machine stays where it is provably un-bypassable — in Postgres — and travels as a migration template.** The port is the only thing that crosses the repo boundary.

### 1.3 `ProbeReaderPort` (+ `CredentialResolver`) — from `rumah-admin/src/metric-probe.ts`

The seam **already exists** (`ProbeReader`, `CredentialResolver`, `:96-104`). The only coupling is the top-level `import postgres from "postgres"` (`:31`) used by the *default* reader `makeReadOnlySqlReader` (`:133`). Extraction = move the substrate (descriptor type, `ProbeRegistry`, `invokeProbe`, the L2/L3 read-only guards `assertReadOnlyTarget`) into the package **without** the `postgres` import; the `postgres`-backed `makeReadOnlySqlReader` + `sqlCredentialResolver` ship as the consumer adapter.

```ts
// MOVES TO PACKAGE (no driver import): MetricProbe<T>, ProbeRegistry, invokeProbe,
//   assertReadOnlyTarget (L3 allow-list), ProbeResult, the ProbeReader/CredentialResolver port types.
export interface ProbeReader {                       // unchanged — already the seam (L4: no write method)
  read(target: string): Promise<ReadonlyArray<Record<string, unknown>>>;
  close(): Promise<void>;
}
export type CredentialResolver = (credentialRef: string) => Promise<ProbeReader>;

// STAYS CONSUMER-SIDE (the postgres-backed adapter): makeReadOnlySqlReader(url), sqlCredentialResolver(map).
```

The four-layer least-privilege guarantee is preserved across the split: L1 (read-only DB role) + L2 (`SET TRANSACTION READ ONLY`) live in the consumer adapter's connection; L3 (`assertReadOnlyTarget`) + L4 (no write method on the port) live in the package. Probe **descriptors** (the actual SQL strings) stay consumer-side — admin probes admin tables, PLOS probes lead tables.

### 1.4 `ConfigReadinessPort` — from `rumah-admin/src/preflight-gate-c9.ts`

The seam already exists as `ctx.configReadiness` (`:234`); only the **default** couples — `makeIConfigReadiness()` (`:356`) `execFileSync`-shells `infra/i-config.mjs` at a hard-coded `src/ → ..` relative path (`:363-368`). Extraction = make the injected port the only path the package knows; the `execFileSync`-to-`i-config.mjs` default ships as the consumer adapter.

```ts
// The port the C9 preflight gate depends on (already its ctx seam):
export type ConfigReadinessFn = (env: string, keys: string[]) => Promise<KeyReadiness[]>;
// STAYS CONSUMER-SIDE: makeIConfigReadiness() — the execFileSync shell-out to infra/i-config.mjs (plane wiring).
```

### 1.5 Notifier + founder-binding seams (already env-only, no SQL)

Not store ports, but lifted to typed ports so the package holds no raw `process.env` read:
- `NotifierPort` — from `founder-summon-c1.ts`'s channel chain (`C1_SLACK_WEBHOOK`/`C1_NONSAAS_FALLBACK`, `:243,252`) and `goal-supervisor-c7.ts`'s `GS_FAP_WEBHOOK` (`:467`). The package gets the 3-tier reach *logic*; the webhook URLs are injected config.
- `FounderBindingPort` — replaces `goal-intake-c1.ts`'s raw `RUNTIME_FOUNDER_ID` env read (`:117`) with an injected resolver (config-registry key, not `process.env`).

### Port-to-organ map (which organ binds which port)

| Port | Defined from | Organs that consume it (default to invert) |
|---|---|---|
| `RuntimeStoresPort` | `runtime-stores.ts` | `po-autoloop-c2` (`:107`), `sprint-engine-c10` (`realStores`, `:38-49`), `goal-supervisor-c7` (`runtimeStoresAdapter`, `:577`), `goal-progress`, `completion-review-c6` (transitively) |
| `GoalContractStorePort` | `goal-contract.ts` | `po-reconciler-c2` (`transition`/`readContract`), `goal-intake-c1`, `sprint-engine-c10`, `completion-review-c6`, `boundary-plan-c2mind` (types) |
| `ProbeReaderPort` + `ProbeRegistry` | `metric-probe.ts` | `goal-supervisor-c7` (the I-Probe re-read), `preflight-gate-c9` (MEASURABLE check) |
| `ConfigReadinessPort` | `preflight-gate-c9.ts` | `preflight-gate-c9` (CAPABILITY READINESS check) |
| `NotifierPort` | `founder-summon-c1.ts`, `goal-supervisor-c7.ts` | `founder-summon-c1`, `goal-supervisor-c7`, `goal-intake-c1` |
| `FounderBindingPort` | `goal-intake-c1.ts` | `goal-intake-c1` |

---

## 2. The package — `delivery-os/templates/governance-engine/`

Mirrors `templates/workflow-engine/` (vendored byte-identical, sha-pinned, `Do NOT hand-edit`).

```
delivery-os/templates/governance-engine/
  index.ts            barrel: createGovernanceRuntime + all port types + organ exports (mirrors workflow-engine/index.ts)
  ports.ts            RuntimeStoresPort · GoalContractStorePort · ProbeReader/CredentialResolver · ConfigReadinessFn
                      · NotifierPort · FounderBindingPort  + all the lifted data types (LOAD-BEARING; build first)
  goal-contract.ts        organ logic; NO sql import — depends on GoalContractStorePort
  runtime-stores.ts       (REMOVED as an organ — its body becomes the consumer adapter; the TYPES live in ports.ts)
  po-reconciler-c2.ts     SOLE mutator of the state machine — calls store.transition/readContract
  po-autoloop-c2.ts       the hub (runGoalLifecycle); imports 7 organs + RuntimeStoresPort
  goal-supervisor-c7.ts   liveness≠progress trip rule; ProbeReader + RuntimeStoresPort + NotifierPort
  sprint-engine-c10.ts    runSprint
  preflight-gate-c9.ts    C9 hour-0 gate; ProbeRegistry + ConfigReadinessFn (injected, no execFileSync default)
  reachability-evaluator.ts  §36.3 deterministic fail-closed rule (zero deps — trivial)
  completion-review-c6.ts goal-acceptance adjudication; reuses acceptanceMet from reconciler
  boundary-plan-c2mind.ts next-sprint plan (type-only — trivial)
  founder-summon-c1.ts    3-tier reach chain; NotifierPort (injected webhooks, no hard-coded secret)
  goal-intake-c1.ts       GoalContract construction + FAP approve; GoalContractStorePort + FounderBindingPort
  metric-probe.ts         ProbeRegistry framework + invokeProbe + L3 guard ONLY (no `import postgres`)
  goal-progress.ts        dGoal/dEffort series math over RuntimeStoresPort
  migrations/             TEMPLATE DDL: goal_contract (+0053 trigger) + the 6 C12 stores (+0052 RLS/triggers)
```

### `createGovernanceRuntime(ports)` — the single bootstrap (analogue of `createCapabilityRuntime`)

```ts
export interface GovernanceRuntimeContext {
  store: RuntimeStoresPort;          // the 6 C12 stores (consumer's postgres adapter)
  contract: GoalContractStorePort;   // the durable PO contract (consumer's postgres adapter)
  probes: ProbeRegistry;             // descriptors registered by the consumer (domain SQL)
  credentials: CredentialResolver;   // ref → least-privilege ProbeReader (consumer)
  configReadiness: ConfigReadinessFn;// the I-Config oracle (consumer adapter)
  notifier: NotifierPort;            // Slack/non-SaaS/durable webhooks (consumer config)
  founder: FounderBindingPort;       // founder identity resolver (consumer config)
}
export interface GovernanceRuntime {
  intake: ReturnType<typeof makeIntake>;        // submitGoal / approveFap
  runGoalLifecycle: (goalId: string) => Promise<...>;  // the PO autoloop tick
  superviseGoal: (goalId: string) => Promise<...>;     // the GS C7 tick
  runSprint: ...; preflight: ...; completionReview: ...;
}
export function createGovernanceRuntime(rc: GovernanceRuntimeContext): GovernanceRuntime { /* wires organs onto ports */ }
```

### What moves in vs. what stays consumer-side

| Lands in `governance-engine/` (PLATFORM) | Stays in the consumer (ADAPTER / DOMAIN / PLANE) |
|---|---|
| The 14 organ logic modules (DB-agnostic, port-injected) | The **Postgres adapter** implementing `RuntimeStoresPort` + `GoalContractStorePort` (admin's current `runtime-stores.ts` + `goal-contract.ts` bodies, wrapped) |
| `ports.ts` (all 6 ports + lifted types) | The **migrations** (applied numbers 0052/0053; the package ships the DDL as a copy-in template) |
| `ProbeRegistry` + `invokeProbe` + L3/L4 read guards | The **probe descriptors** (the domain SQL strings) + `makeReadOnlySqlReader`/`sqlCredentialResolver` (the `postgres`-backed adapter) |
| `createGovernanceRuntime` factory + `index.ts` barrel | The **`i-config.mjs` shell-out** (`makeIConfigReadiness`) — plane wiring |
| `migrations/` **template** DDL | **Slack secrets / webhook URLs**, `CRON_SECRET`, `PROD_BASE_URL`, `RUNTIME_FOUNDER_ID` value |
| The reachability deterministic rule | The **scheduler tier instances** + the 3 cron/GHA driver workflows (cadence/plane) |

---

## 3. Extraction ORDER (dependency order — the audit's minimum first)

The audit's minimum to make the claim TRUE = **the two store ports + invert + lift + admin re-vendors**. Migrations, Slack, scheduler can trail. Exact sequence:

1. **Ports first — `ports.ts` (the two store ports).** Define `RuntimeStoresPort` (from `runtime-stores.ts`) and `GoalContractStorePort` (from `goal-contract.ts`) as pure interfaces + their lifted types. *Signatures only, zero behavior change.* This is the load-bearing step (ARCH-VALIDATION §4.1: "do this first").
2. **Build the consumer adapter in admin.** Re-home admin's current `runtime-stores.ts` / `goal-contract.ts` bodies as `postgresRuntimeStores` / `postgresGoalContractStore` implementing the ports — still importing `./db/client.js`, still issuing the same SQL (incl. `pg_advisory_xact_lock`, the 0053 trigger path). *Byte-identical behavior; admin keeps running.*
3. **Invert the leaf + low organs onto the ports** (no DB defaults to fight): `reachability-evaluator` (zero deps), `boundary-plan-c2mind` (type-only), then `po-reconciler-c2`, `completion-review-c6`, `goal-progress`, `sprint-engine-c10`, `goal-supervisor-c7`, `po-autoloop-c2`, `goal-intake-c1`, `founder-summon-c1` — each swaps its default (`realStores` / `runtimeStoresAdapter` / `dbReadContract`) for the injected port.
4. **Add `ProbeReaderPort` + `ConfigReadinessPort`** so `metric-probe.ts` drops `import postgres` and `preflight-gate-c9.ts` drops the `execFileSync` default. (Medium effort — these are the only two beyond the store ports.)
5. **The factory — `createGovernanceRuntime(ports)`** + `index.ts` barrel. Wire all organs through one bootstrap call.
6. **Re-vendor into admin** via the `engine:install`-style sha-pinned copy of `governance-engine/` into `rumah-admin/.claude/os/governance/`; admin supplies the adapter + descriptors + cron wiring — exactly as it already does for the C11 bus (`os-inherit.mjs sync`).
7. **Templatize the migrations** (`migrations/` — goal_contract + 6 stores + RLS/triggers) as a copy-in template.
8. **The PLOS proof** (§4 validation) — the real platform claim.
9. **Trailing consolidations (off critical path, cheap):** promote `scheduler-tiers` schema+validator from `rumah-admin/infra/` to `templates/tools/`; ship the Slack `/goal` pack on the existing `goals-route` seam; collapse the dual config registry onto `i-config.mjs`.

**Critical path = steps 1-6 + 8.** Steps 7 and 9 trail (a new consumer can hand-write DDL from the template and drive goals over HTTP).

---

## 4. Migration strategy

### Backward compatibility — admin never breaks
The adapter (step 2) implements the port **over the existing `./db/client.js`**, issuing the identical SQL against the identical tables. The organs change *what they import* (a port type) not *what runs* (the same statements). At every step admin composes `createGovernanceRuntime({ store: postgresRuntimeStores, contract: postgresGoalContractStore, … })` and gets byte-identical runtime behavior. No migration is applied, no table changes, no cron changes during extraction.

### Rollout — shadow → adopt-by-pin (the existing model)
- **Shadow:** vendor `governance-engine/` into admin alongside the live organs; run the new factory's organs in shadow against the same goals; diff outputs against the in-place organs (the reconcile decisions, GS trips, C6 verdicts must be identical). The 0052/0053 invariants make this safe — the stores are append-only / CAS, a shadow read mutates nothing.
- **Adopt-by-pin:** flip admin's live path to the vendored package at a named moment (a sha-pin bump), the same anti-third-fork discipline already used for the engine. No consumer re-forks; admin consumes its own vendored copy.

### Validation — two gates, in order
1. **Logic-unchanged gate (admin):** re-run the **existing organ self-tests** against the port-injected organs with the Postgres adapter. The verified organ logic must be *unchanged* — same reconcile/trip/adjudication outputs. This proves the re-typing introduced no behavior drift.
2. **The real platform proof (PLOS — "second consumer, different domain"):** wire **ONE property-lead-os lead-domain goal** end-to-end through the vendored `governance-engine`:
   - a lead-domain **MetricProbe descriptor** (e.g. `qualified-leads-count` over PLOS's lead tables) registered in PLOS's `ProbeRegistry`;
   - PLOS's **`@plos/db`** behind a `RuntimeStoresPort` + `GoalContractStorePort` adapter (PLOS's own Supabase, its own migration numbers from the template);
   - PLOS's `i-config` behind `ConfigReadinessFn`; PLOS's webhook behind `NotifierPort`.
   - **Pass condition:** a goal runs intake → preflight → sprint → reconcile → supervise → complete/boundary in PLOS with **zero `rumah-admin` code present** (governance-organ grep across PLOS = no matches, as it is today). That is the claim made true — the engine's own existence proof, reproduced for governance.

### Rollback
Because admin keeps its original `runtime-stores.ts` / `goal-contract.ts` bodies (re-homed as the adapter, not deleted), rollback is a **sha-pin revert**: drop back to the in-admin organs (pre-step-3 imports). No data migration to undo — the stores/tables are untouched throughout. If a port proves leaky (a behavior the SQL did that the interface can't express), revert the pin, fix the port shape, re-attempt — admin runs the whole time.

---

## 5. Definition of Done — per coupled capability

An organ is **EXTRACTED** when all five hold (the same bar the C11 engine met):
1. It lives in `delivery-os/templates/governance-engine/` and imports **no** `./db/client.js`, **no** `postgres`, **no** `execFileSync` to a relative path.
2. It runs on an **injected port** (constructor/param), with no DB/plane default baked in.
3. **Admin re-vendors** it (sha-pinned copy) and supplies the Postgres adapter — admin's live path uses the vendored organ, not a local copy.
4. The **existing self-test passes** with the port-injected organ (logic-unchanged gate).
5. A **non-admin adapter exercises it** — the PLOS lead-domain wiring drives it (or, for organs not on the single-goal happy path, a non-admin in-memory/stub adapter satisfies the port).

**Per-capability DoD headline:**

| Capability / organ | DONE when… |
|---|---|
| Durable Runtime Stores (C12) | `RuntimeStoresPort` defined; admin's body is the adapter; all 14 store methods covered; consumers issue the SQL, organs never do |
| GoalContract (C2-STATE) | `GoalContractStorePort` defined; `transition` enforces legality **via the 0053 trigger in the consumer DB**, never in organ code; CAS preserved |
| Reconciler / PO loop / Lifecycle | `po-reconciler-c2` + `po-autoloop-c2` run on the two store ports; reconcile decisions byte-identical in the logic gate |
| Goal Supervisor (C7) | runs on `RuntimeStoresPort` + `ProbeReader` + `NotifierPort`; the liveness≠progress trip + I-Probe re-read drive off injected probes |
| Sprint Engine (C10) / Boundary plan | `runSprint` + `boundary-plan` consume ports only; no transitive `runtime-stores` default |
| Preflight gate (C9) / Reachability | `preflight-gate-c9` runs on `ProbeRegistry` + `ConfigReadinessFn`; no `execFileSync` default; reachability rule is pure |
| MetricProbe substrate | `metric-probe.ts` carries no `import postgres`; the `postgres` reader is the consumer adapter; descriptors are consumer-supplied |
| Goal Intake (governance) | `goal-intake-c1` constructs contracts via `GoalContractStorePort`; founder identity via `FounderBindingPort`, not raw env |
| Completion Review (C6) | runs in the package; reuses reconciler `acceptanceMet`; verdicts byte-identical in the logic gate |
| Founder Summon (C1) | 3-tier reach chain runs on `NotifierPort`; zero hard-coded webhook/secret in the package |
| Cost Governance (runtime spend) | `appendCost`/`readCumulativeCost` behind `RuntimeStoresPort`; `pg_advisory_xact_lock` lives in the adapter only |
| Migrations | shipped as `governance-engine/migrations/` template; consumer owns its applied numbers + RLS/triggers |

---

## 6. The final Repository Ownership Model

| Governance artifact / folder | Owner: delivery-os (the engine) | Owner: consumer (adapter / migrations / domain) |
|---|---|---|
| `templates/governance-engine/ports.ts` (the 6 ports + types) | ✓ source of truth | vendored copy only |
| The 14 organ logic modules (reconciler, autoloop, supervisor, sprint, preflight, reachability, completion-review, boundary, founder-summon, goal-intake, goal-progress, goal-contract-organ) | ✓ source of truth | vendored copy (sha-pinned, do-not-edit) |
| `createGovernanceRuntime` factory + `index.ts` barrel | ✓ | — |
| `ProbeRegistry` + `invokeProbe` + L3/L4 read guards | ✓ | — |
| `governance-engine/migrations/` DDL **template** (goal_contract+0053, 6 stores+0052 RLS/triggers) | ✓ template | ✓ applied migration numbers in its own DB |
| Postgres adapter: `RuntimeStoresPort` + `GoalContractStorePort` impl (the raw SQL, `pg_advisory_xact_lock`, the 0053 trigger path) | — | ✓ (admin's current bodies, re-homed) |
| `makeReadOnlySqlReader` / `sqlCredentialResolver` (the `postgres`-backed `ProbeReader`) | — | ✓ |
| MetricProbe **descriptors** (the domain SQL strings) | — | ✓ (admin probes admin tables; PLOS probes lead tables) |
| `ConfigReadinessFn` impl (`i-config.mjs` shell-out) | — | ✓ plane wiring |
| `NotifierPort` impl + webhook secrets; `FounderBindingPort` value | — | ✓ |
| Scheduler tier **schema + validator** | ✓ (must move — currently trapped in `rumah-admin/infra/`) | — |
| Scheduler tier **registry instance** + cron/GHA driver workflows | — | ✓ cadence/plane/secret |
| Slack `/goal` adapter | ✓ DOS pack (on the `goals-route` seam) | ✓ secret/channel |

**The one-line invariant that keeps it true going forward:**

> **No file under `templates/governance-engine/` may import `./db/client.js`, the `postgres` driver, or `execFileSync` a relative-path tool — every durable read/write, probe read, and config read crosses an injected port. A push that adds such an import fails the gate.**

This is the governance analogue of the engine's already-proven rule (the engine never imports a DB client; it takes `EngineContext.db`). Enforce it with a `legacy-guard`-style detector over the package directory (the `SANCTIONED_STORE_WRITERS` mechanism already exists, `legacy-guard-execution.mjs:94`) so the boundary is operationally enforced, not remembered (Governance §12 / North-Star invariant).

---

*Blueprint authored read-only on 2026-06-29. All signatures lifted verbatim from `rumah-admin/src/{runtime-stores,goal-contract,metric-probe,preflight-gate-c9}.ts` and the C11 model `delivery-os/templates/workflow-engine/{index,capability-pack}.ts` as found on disk that date. No code changed.*
