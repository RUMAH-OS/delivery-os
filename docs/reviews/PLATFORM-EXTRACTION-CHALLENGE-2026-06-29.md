# Platform Extraction & Execution-Infra — Adversarial Challenge

**Date:** 2026-06-29
**Type:** READ-ONLY adversarial review. Default posture: REFUTE. No code changed; this document is the only artifact.
**Targets under attack:**
- `docs/reviews/PLATFORM-EXTRACTION-AUDIT-2026-06-29.md` (the "two SQL sinks / 12-of-14 generic" thesis)
- `docs/reviews/ARCHITECTURE-VALIDATION-platform-vs-consumer-2026-06-29.md` (the `GoalStorePort` shortest-path)
- `docs/reviews/EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md` (Neo as Execution Node 1)

**Method:** the three target docs were NOT taken at their word. The real code was re-read in all three repos
(`C:\Users\brian\RUMAH\{delivery-os, rumah-admin, property-lead-os}`): both raw-SQL store files, migrations
0052/0053 (the DDL + triggers), `metric-probe.ts`, all 11 organ modules, `agent-runner.ts`, the engine
`state-machine.ts`, the vendored-engine pin manifests + a byte-hash drift comparison across the three engine
copies, the GHA workflows, and the deploy pipeline. Each major claim is rated SURVIVES / WEAKENED / REFUTED
with file-cited evidence and, where it falls, a corrected claim + a work-item.

**Headline:** The architectural **diagnosis** is sound and survives — the stateful goal-governance OS is
mis-located in the first consumer and the platform owns none of it. But the **optimism about the cost and
safety of fixing it** does not survive. The audit measures coupling by "which `.ts` files import `sql`" and so
counts two. The real coupling is that **the entire enforcement substrate of the OS — the §4.3 state machine,
the C12 store invariants, idempotency, the breaker, the cost ceiling — is implemented in Postgres DDL,
PL/pgSQL triggers, advisory locks and RLS that the ports do not carry and that the platform ships nowhere.**
"Re-type two ports" understates the work by the part that actually makes it an operating system.

---

## Verdict summary

| # | Claim under attack | Verdict |
|---|---|---|
| 1 | "Just two SQL sinks; 12/14 organs generic, ZERO domain leakage." | **WEAKENED** (business-domain half survives; portability framing refuted) |
| 2 | "A new consumer (Finance OS) could run these organs unchanged." | **REFUTED** (non-Postgres) / **WEAKENED** (Postgres) |
| 3 | "The stateless platform is byte-identical, drift-free, vendored into both consumers." | **REFUTED** |
| 4 | "Neo as Execution Node 1; the durable bus makes every node replaceable." | **WEAKENED** (honest doc; several load-bearing claims overstated) |
| 5 | "Extraction is re-typing, not redesign — no regression risk." | **WEAKENED** (hides a real regression surface) |

**What genuinely survives** (stated up front, in fairness): the forbidden-dependency invariant (no
platform→consumer code import; both consumers import their own vendored engine, never `delivery-os` source);
the stateless spine *as code* being platform-owned (engine, orchestration, registry, verify-gate,
founder-review, config/health/deploy tools); **zero admin business-domain leakage** in the organs (no organ
imports invoicing/contract/settlement/owner-invoice/delivery/property/occupancy); the lease/SKIP-LOCKED
reclaim + executor-timeout primitives existing and being real; and the token-attributed Vercel deploy that
lets a self-hosted runner deploy without a founder click. The diagnosis is right. The estimate is wrong.

---

## Claim 1 — "The coupling is just two SQL sinks; 12/14 organs are already generic with zero domain leakage."

**Verdict: WEAKENED.** The narrow factual sub-claims split: *business-domain* non-leakage SURVIVES; *"only two
SQL files"* is REFUTED (it is three); *"generic / portable"* is REFUTED for most organs once you look below
the `.ts` line.

**1a. Business-domain non-leakage — SURVIVES.** Confirmed across all 11 organ modules: none import
invoicing / owner-invoice / contract / settlement / delivery / property / occupancy. The pure decision rules
(reconcile choice graph, GS trip rule, C6 adjudication, C9 reachability, boundary plan) carry no admin product
knowledge. Four organs are genuinely clean and portable as-is: `reachability-evaluator.ts` (zero imports),
`boundary-plan-c2mind.ts` (type-only), `founder-summon-c1.ts` (type-only; returns the audit row as data, does
no I/O), and the GS trip rule itself in `goal-supervisor-c7.ts`. Credit where due.

**1b. "Only two files hold raw SQL" — REFUTED: it is three.** `rumah-admin/src/metric-probe.ts:31` does
`import postgres from "postgres"` and runs raw SQL via `tx.unsafe("SET TRANSACTION READ ONLY")` + `tx.unsafe(target)`
inside `sql.begin` (`:139-142`), and depends on a Postgres-specific error code (25006 on write-in-RO-txn) for
its L2 safety guarantee (`:26-28`). It is a transitive dependency of `completion-review-c6.ts`,
`goal-progress.ts`, and `preflight-gate-c9.ts`. The audit's own count (`metric-probe.ts:31` "imports the
postgres driver") names it but then excludes it from the "two sinks" headline. Three files, not two — and the
third carries the GS's entire independent-observation safety case.

**1c. The load-bearing enforcement is in the migrations, not the organs — the framing the audit waves away.**
This is the core refutation. The organs' own headers say it repeatedly:
- **The §4.3 goal-lifecycle state machine is a PL/pgSQL `BEFORE UPDATE` trigger**, `goal_contract_state_machine_guard`
  (`migrations/0053_goal_contract.sql:86-132`), "owner-proof," fires for every role. `goal-contract.ts:9-14`
  states plainly: "the §4.3 state-machine legality is enforced IN THE DATABASE … NOT here." `transition()`
  (`:164-188`) is a CAS `UPDATE … WHERE state = current.state` that "does not re-implement the state machine, it
  asks the DB to move and surfaces the rejection." `po-reconciler-c2.ts:26-28,132-133,363` confirms its
  `AUTONOMOUS_EDGES` graph is only a *choice restriction*; the legality is the trigger.
- **The C12 store invariants are PL/pgSQL too:** append-only immutability across four ledgers
  (`c12_append_only_guard`, `0052:52-58`), write-once idempotency (`c12_idempotency_guard`, `0052:64-79`).
- **Breaker advance logic is in the SQL statement**, not portable TS: the threshold→open / cooldown CASE lives
  in the `ON CONFLICT … DO UPDATE` (`runtime-stores.ts:129-138`).
- **Exact cost cumulative depends on `pg_advisory_xact_lock(hashtext(${goalId}))`** (`runtime-stores.ts:218`) —
  a Postgres-only primitive.
- **Every RLS policy hard-codes admin's role**, `CREATE POLICY … TO rumah_app` (0052/0053, ~10 policies).

So a `GoalContractStorePort` that captures the function *signatures* carries **none** of the legality, the
immutability, the write-once rule, the breaker math, or the cost-serialization. They are not in the organs to
lift.

**1d. The decisive asymmetry vs the celebrated PASS engine.** The audit holds up the C11 engine as the proof
that injection works. But the engine does its state machine in **portable TypeScript** —
`templates/workflow-engine/state-machine.ts` (`RUN_STATES`, `LEGAL_RUN_EDGES`) — *and* has the DB trigger
(migration 0034) as a backstop, *and* a golden-master CI cage that pins both to the **same** legal-edge
whitelist (`state-machine.ts:1-4,26-28`). The governance layer has the DB trigger **only**, no TS mirror, and
ships nowhere in the platform. The engine is the right pattern; the governance layer is the incomplete one. The
audit treats them as the same "inject a port" move — they are not.

**1e. Platform-level (non-business) couplings the "zero leakage" headline omits.** `preflight-gate-c9.ts:356-377`
default `makeIConfigReadiness` does `execFileSync(process.execPath, [oracle …])` where
`oracle = resolve(root, "infra/i-config.mjs")` and `root = resolve(here, "..")` — it **bakes in rumah-admin's
on-disk layout** and shells out to it; a consumer without that exact `infra/` tree gets fail-closed
`capability-not-ready`. Plus `RUNTIME_FOUNDER_ID` (`goal-intake-c1.ts:117`), `C1_SLACK_WEBHOOK` /
`C1_NONSAAS_FALLBACK` (`founder-summon-c1.ts:243,252`), `GS_FAP_WEBHOOK` (`goal-supervisor-c7.ts:467,537`). Each
organ's *default factory* binds straight to admin's DB: `realStores` (`sprint-engine-c10.ts:142-145`),
`runtimeStoresAdapter` (`goal-supervisor-c7.ts:577-582`), `dbReadContract` (`goal-intake-c1.ts:601`),
`goal-contract.transition` (reconciler), `defaultProbeRegistry`.

**Corrected claim:** *The organ TypeScript is free of admin's product domain, but the OS's load-bearing
invariants live in Postgres DDL/PL-pgSQL/advisory-locks/RLS (migrations 0052/0053) that the proposed ports do
NOT carry and the platform ships nowhere. The extraction is "lift the organs + author and de-admin a migration
template + add a TS legal-edge validator mirroring 0053 + a golden-master cage that asserts TS⇄DB agree (the
engine's bar) + add a ProbeReaderPort (the third SQL file)." That is materially more than re-typing two
function-signature ports.*

**Work-items:** (W1) scope `templates/governance-engine/migrations/` as a first-class deliverable, not a
trailing copy-in: the 5 tables + 3 trigger functions + the 11-state machine, with the RLS role parameterized
off a `{{app_role}}` rather than literal `rumah_app`. (W2) add a TS `goal-state-machine.ts` legal-edge validator
mirroring 0053 and a golden-master cage asserting TS and DB whitelists are identical. (W3) add `metric-probe.ts`
+ a `ProbeReaderPort` to the extraction scope explicitly.

---

## Claim 2 — "Could a brand-new consumer (Finance OS) really run these organs unchanged?"

**Verdict: REFUTED for a non-Postgres consumer; WEAKENED for a Postgres/Supabase consumer.**

The concrete counter-example. To stand up the goal-governance OS, Finance OS must — *beyond* the organ `.ts`
the audit says it "gets for free" —

1. **Port and de-admin migrations 0052 + 0053:** 5 durable tables, the `c12_append_only_guard`,
   `c12_idempotency_guard`, and the 11-state `goal_contract_state_machine_guard` PL/pgSQL trigger, and rename
   `rumah_app` across ~10 RLS policies. None of this exists in `delivery-os` today (whole-`templates` grep for
   `goal_contract|goal_delta_ledger|state_machine_guard|GoalContractStorePort|createGovernanceRuntime` = **zero
   hits**). This is admin's migration files, copied and edited — *not* "unchanged organs."
2. **Provision a least-privilege read-only DB role** and rely on `SET TRANSACTION READ ONLY` + the 25006
   write-block (Postgres semantics) for the MetricProbe L1/L2 guarantees (`metric-probe.ts:26-28,133-149`).
3. **Replicate `pg_advisory_xact_lock`** for the exact cost cumulative, or accept a concurrency-correctness
   regression (`runtime-stores.ts:218`).
4. **Reproduce the `infra/i-config.mjs` + `config-secret-registry.json` tree** at the exact relative path
   `preflight-gate-c9.ts` execs, or inject a `ConfigReadinessPort` (`:356-377`).
5. **Supply** `RUNTIME_FOUNDER_ID`, `C1_SLACK_WEBHOOK`/`C1_NONSAAS_FALLBACK`, `GS_FAP_WEBHOOK`.
6. **Register at least one REAL MetricProbe.** There are **zero** registered probes anywhere in admin's `src/` —
   `defaultProbeRegistry` is constructed empty (`metric-probe.ts:92`) and every `.register()` call is in a CLI
   self-test or QA temp file with a **fixture** target (`SELECT 1.0::numeric AS value`, `SELECT 0.88 AS value`).
   Names like `invoice-delivery-coverage` are admin-flavored labels on `SELECT 1` fixtures. The GS's
   "independent eyes" safety case has never run against real data, in admin or anywhere.
7. **Build the tiered scheduler from scratch** — the generic schema+validator were never promoted to
   `templates/`; the only source is `rumah-admin/infra/scheduler-tiers.*` (`"service": "rumah-admin"`,
   `/v1/heartbeat`, `CRON_SECRET`, `GS_FAP_WEBHOOK`) — i.e. fork a *consumer*.
8. **Build the Slack `/goal` control surface** — never built in either repo.

"Run unchanged" is therefore false even on Postgres (it is a database build, not a code-vendor), and is a
**redesign** off Postgres: PL/pgSQL triggers, advisory locks, RLS and `SET TRANSACTION READ ONLY` have no
portable form.

**The PLOS "existence proof" proves less than advertised.** `property-lead-os/apps/web/lib/engine/runtime.ts`
runs on `@plos/db` + **Supabase**-JWT — i.e. **Postgres → Postgres** (`runtime.ts:5-15`). It proves same-plane
reuse of the *stateless* engine. It proves nothing about a non-Postgres consumer and nothing about the
*governance* layer (PLOS has none of it). The honest portability envelope is **"Postgres/Supabase-plane
consumers,"** not "an operating system for any consumer."

**Work-item:** (W4) state the platform's portability envelope explicitly as Postgres/Supabase-plane, and either
(a) accept Postgres as a declared platform substrate (then the migration template + advisory-lock + RLS are
*platform* artifacts, owned and versioned in `delivery-os`, not "consumer-owned migration numbers"), or (b)
abstract the store invariants above the DB — a far larger redesign. Do not let the doc imply (b)'s portability
at (a)'s cost.

---

## Claim 3 — "The stateless platform is byte-identical, drift-free, vendored into both consumers."

**Verdict: REFUTED.** The vendoring *mechanism* is real and the forbidden-dependency invariant holds, but
"byte-identical / drift-free / proven" is false on every axis, and the drift *gate* is currently red.

- **PLOS is 100% byte-divergent from canonical** — the whole vendored engine is stored CRLF while
  `templates/workflow-engine` is LF, so all 27 files mismatch on `Get-FileHash`. "PLOS runs the byte-identical
  vendored engine" is false on its face.
- **Real content drift (after CRLF normalization), three-way:** canonical is ahead of both consumers on
  `approvals-route.ts` (adds the G5 approvals-inbox `GET /approvals`; 187 vs 171 lines) and `workflow-route.ts`
  (adds G4 verify-verdict surfacing; 132 vs 113). **Admin** additionally lags canonical on `engine.ts` (733 vs
  751) and `handlers.ts` (run-input threading + await-callback), **which PLOS already has.** So PLOS is ahead of
  Admin on the engine core while both trail canonical on the two route files — genuine divergence, not clean
  vendoring.
- **The pins are split and stale.** `osVersion`: PLOS `v5.0-131-gb7c7d0c` vs Admin `v5.0-125-geb20a6c` (Admin 6
  commits behind). Both `INHERITED-engine.json` manifests record `approvals-route.ts`=`d499bbb2…` and
  `workflow-route.ts`=`0cc543d9…`, but the **canonical** files now hash `3e0622b2…` / `e6fdb35c…`. The
  manifest's own rule — "engine-check fails if the installed copy drifts from these hashes OR these hashes
  drift from canonical" — means **`os-inherit engine-check` would FAIL in both repos right now.** The advertised
  drift gate is not green; it is unrun.
- **The parity test does not cover the engine.** `property-lead-os/tests/seam-copy-parity.test.ts` (and the
  admin twin) asserts only **one file**, `admin-plos-seam-v1.mjs`, against a hard-coded hash, normalizes CRLF
  (so not even raw byte-identity), and `return`s early — skipping the compare-to-canonical assertion — whenever
  the `../../delivery-os` sibling checkout is absent (i.e. in single-repo CI). The engine drift above is
  entirely outside its scope.
- **The `$schema` sibling-path coupling is real:** both consumers' `infra/config-registry.json` point
  `"$schema": "../delivery-os/templates/tools/config-registry.schema.json"` — resolves only when delivery-os is
  checked out next door. (The secret registries are self-relative `./` and safe — that pattern is known-good and
  should be copied.)

Fairness: the drift is small and forward (canonical leads; CRLF is functionally cosmetic), and the
no-platform→consumer-import invariant genuinely holds. But the *claim* graded here is "byte-identical, drift-free,
proven," and that is refuted; more materially, the **gate that is supposed to prevent drift is failing by its
own definition and nobody is running it.** Shipping a "proven vendoring" story on a red gate is the governance
gap to fix before founder approval.

**Work-items:** (W5) re-sync + re-pin both consumers from canonical, run `engine-check` to green, and align the
two `osVersion` pins (Admin is 6 behind). (W6) extend the parity test to cover the engine modules (not just the
one seam file) and make it fail-closed rather than self-disabling without the sibling checkout. (W7) vendor
`config-registry.json`'s schema locally and switch `$schema` to `./` like the secret registry already does.

---

## Claim 4 — "Neo as Execution Node 1; the durable bus makes every node replaceable."

**Verdict: WEAKENED.** The blueprint is unusually honest (§13/§17 name the SPOF, the rot, the code-exec risk),
and the *direction* (continuous supervision wants an owned worker, not metered cron) is right. But several
load-bearing technical claims are overstated, and the operational surface is larger than the framing admits.

- **"NO node holds un-replayable state (in-flight LLM work, un-checkpointed progress)" — WEAKENED.** The
  bus-level claim is true and built: `agent-runner.ts` has real lease columns (`runner_id`,
  `runner_lease_expires_at`), `FOR UPDATE SKIP LOCKED LIMIT 1` claim (`:81-84`), expiry/auto-reclaim
  (`leaseMs` default 30s). But **in-flight executor work is lost and re-run from the step boundary, not
  preserved.** The executor is opaque (`(task)=>Promise<outcome>`, `:47-48`); the `checkpoint` column stores
  only the retry counter `runnerAttempt` (`:294`), never partial LLM output. A long Claude run killed at 90%
  restarts at 0%. For an *autonomy worker doing expensive long runs* — the exact intended workload — that is a
  real cost/latency hazard, not a solved one. "Every node replaceable" is true for the *step*, not for the
  *work in flight*.
- **The shipped executor timeout is unusable for the workload.** `executorTimeoutMs` default **60s**
  (`agent-runner.ts:175,207-220`). A real headless-Claude coding run exceeds this; the daemon would time out and
  retry-loop real work at the default. The blueprint assumes the worker "just runs" the agent-runner; it does
  not, at the shipped settings.
- **"The launchd worker daemon" — net-new bespoke code, not a config step.** No launchd plist, no `worker.ts`,
  no production `while(true)` drain exists in any repo. `createAgentRunner(...).start()` is called **only in
  `scripts/*-proof.ts` harnesses**; production drives the engine through the **stateless HTTP `tick()` loop**
  (`heartbeat-api.ts:95-116`), with no resident process. The daemon is a new standing thing to build, supervise,
  patch, and recover — precisely the long-tail rot §13/§17 warn about, but under-counted as if the primitives
  add up to a daemon. They do not.
- **"Ticks every 5s … because there's no per-invocation meter" — gold-plating.** Nothing in the design needs
  sub-minute ticking: a heartbeat drains a *loop* of transitions per beat (`heartbeat-api.ts:102-113`); the
  worker loop's `pollMs` (250ms) governs only idle backoff. 5s buys pickup latency, justified by preference, not
  structure.
- **"The drain is ~8,640 billed min/month" — directionally right, magnitude inflated.** `dead-man-switch.yml:41`
  is genuinely `*/5`, but it is a sub-minute, zero-dependency, read-only checkout+`GET /v1/health/platform`
  watchdog (`:60-76`) — whole-minute rounding produces the headline; the job is seconds. And the real engine
  driver (heartbeat) is **not on GHA cron at all yet** — its schedule is commented out (`heartbeat-driver.yml:42`),
  as is the supervisor's (`goal-supervisor.yml:32`). The budget argument holds (cron × rounding burns the
  meter), but the decision should rest on re-derived numbers, not the inflated one.
- **Self-hosted-runner code-exec risk is created by the blueprint, not pre-existing.** Today there are **zero**
  self-hosted runners (`runs-on: ubuntu-latest` everywhere) and **no** `pull_request_target` in either consumer
  repo (the only one is a safe label-gated base-context template, `templates/workflows/promote-to-prod.yml:36`).
  The blueprint's own rule "never `pull_request_target` on a self-hosted runner" (`:532`) is sound but is a
  *future discipline to impose*, and the exposure is introduced the moment the runner lands.
- **SPOF (Neo + a solo founder, no on-call) — SURVIVES as a real, acknowledged risk.** The mitigations
  (off-Neo dead-man-switch, one-line `runs-on` rollback, durable-bus state, backed-up Supabase) are real and
  good. But they are weakened by the three items above: a bespoke daemon to keep alive, in-flight work that
  re-runs on every crash, and a default timeout that must be re-tuned. "Mitigated, not removed" is the right
  verdict — but the residual is larger than the blueprint's cost table shows.

**Work-items:** (W8) before authorizing Neo, raise the executor timeout to a real headless-Claude budget and
prove a long run survives a kill+reclaim with no double side-effect (the idempotency store is the only thing
between re-execution and a duplicate send — verify it). (W9) scope the launchd worker daemon as a *build* item
with its own VERIFY, not a setup step; either add executor-level checkpointing or document, with eyes open, that
in-flight work is re-run from scratch. (W10) drop the 5s tick to the heartbeat cadence unless a measured need
exists. (W11) re-derive the minutes arithmetic from real job durations so the GO rests on true numbers. (W12)
keep the off-Neo watchdog as a hard precondition (already in the plan) — do not relax it.

---

## Claim 5 — "Extraction is re-typing, not redesign" (regression risk hidden by the optimistic framing).

**Verdict: WEAKENED.** "Re-typing" is true for the function *signatures* and false for the *safety case*, and
the gap is exactly where the 5-pass verification's value lives.

What the 5 passes actually verified was the **DB enforcement**: the 0053 state-machine trigger, the 0052
append-only / write-once / breaker guards, and the Postgres concurrency primitives (CAS, `ON CONFLICT`,
`pg_advisory_xact_lock`). They did **not** verify a port-injected TypeScript implementation of those rules,
because no such implementation exists — the legality is not in the organs. So inverting the organs onto
`GoalContractStorePort` / `RuntimeStoresPort` and re-verifying against a TS mock store would **not re-exercise
the thing that was proven.** A `governance-engine` whose `transition()` simply delegates to "whatever the
injected adapter's DB does" regresses to: *legality is only as good as each consumer's migration.* If a
consumer's adapter or migration is imperfect, illegal edges — `EXECUTING → DONE` skipping `REVIEWING`,
resurrecting a terminal `FAILED`, a founder-resume to a non-captured state — **silently succeed**, because
nothing in TypeScript refuses them (`goal-contract.ts:164-188` is a CAS, not a validator). The engine avoids
exactly this by carrying `state-machine.ts` *and* the trigger *and* a cage that pins them equal; the governance
extraction, done as the audit frames it, would ship the weaker of the two halves.

**Corrected claim:** *Extraction is re-typing for the signatures but a safety-case rebuild for the invariants:
to avoid regressing what the 5 passes proved, you must port the migrations, de-admin the role, add the missing
TS legal-edge validator, and add a golden-master cage asserting TS⇄DB agree — then re-run the 5-pass
verification against that doubled guard, not against a mock.* (Folds into W1/W2.)

---

## The single most dangerous hidden coupling

**The §4.3 goal-lifecycle state machine — and the entire C12 store invariant set — exist ONLY as admin's
Postgres PL/pgSQL triggers (migrations 0052/0053), with NO TypeScript mirror and NO presence in the platform.**
Unlike the C11 engine, which carries its state machine in portable `state-machine.ts` *plus* a trigger backstop
*plus* a golden-master cage that pins the two equal, the governance state machine is database-only. The audit's
"define two store ports and lift the organs" produces a `governance-engine` that carries the function signatures
but none of the enforcement: any consumer that injects a different adapter, or copies the migration imperfectly,
or runs off Postgres, gets a goal lifecycle with **no legality enforcement at all** and illegal transitions that
succeed in silence. This is the coupling the "12-of-14-generic, just two sinks" headline waves away, and it is
load-bearing because the state machine *is* the operating system's correctness boundary.

---

## Must-add work-items before the founder approves

**Extraction (re-scope the estimate — it is not "two ports"):**
- **W1.** Make `templates/governance-engine/migrations/` a first-class deliverable: 5 tables + 3 trigger
  functions + the 11-state machine, RLS role parameterized off `{{app_role}}` (not literal `rumah_app`).
- **W2.** Add a TS `goal-state-machine.ts` legal-edge validator mirroring 0053 + a golden-master cage asserting
  the TS and DB whitelists are identical (match the engine's bar). Re-run the 5-pass verification against the
  doubled guard, not a mock (closes Claim 5).
- **W3.** Add `metric-probe.ts` + a `ProbeReaderPort` to the extraction scope (the third SQL file), and register
  at least one **real** MetricProbe end-to-end — today there are zero; the GS safety case is unproven on real
  data.
- **W4.** Declare the portability envelope as **Postgres/Supabase-plane**; own the migration template + advisory
  locks + RLS as *platform* artifacts, or commit to the larger above-the-DB redesign — do not imply portability
  the code does not have.

**Vendoring drift (the "proven platform" gate is currently red):**
- **W5.** Re-sync + re-pin both consumers from canonical; run `engine-check` to green; align the split
  `osVersion` pins (Admin is 6 commits behind PLOS; PLOS is all-CRLF).
- **W6.** Extend the parity test to cover engine modules and make it fail-closed without the sibling checkout.
- **W7.** Vendor `config-registry.json`'s schema locally; switch `$schema` from `../delivery-os/…` to `./`.

**Execution infra (before authorizing Neo):**
- **W8.** Raise the 60s executor timeout to a real headless-Claude budget; prove a long run survives kill+reclaim
  with no duplicate side-effect (verify the idempotency store actually prevents the double-send).
- **W9.** Scope the launchd worker daemon as a build item with its own VERIFY; add executor checkpointing or
  document that in-flight work is re-run from scratch.
- **W10.** Drop the 5s tick to the heartbeat cadence unless a measured need exists. **W11.** Re-derive the
  minutes arithmetic from real durations. **W12.** Keep the off-Neo watchdog as a hard precondition.

---

*Challenge performed read-only on 2026-06-29. All paths/line ranges as found on disk that date. Repos:
`C:\Users\brian\RUMAH\{delivery-os, rumah-admin, property-lead-os}`.*
