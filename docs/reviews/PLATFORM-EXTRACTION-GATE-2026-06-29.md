# Platform Extraction Gate — Synthesis & Decision Package (2026-06-29)

Consolidates four reviews into one founder-gate package. Sources (read these for detail):
- `PLATFORM-EXTRACTION-AUDIT-2026-06-29.md` — 27 capabilities, file-cited.
- `PLATFORM-EXTRACTION-BLUEPRINT-2026-06-29.md` — the port design + extraction order.
- `PLATFORM-EXTRACTION-CHALLENGE-2026-06-29.md` — the adversarial refutation.
- `EXECUTION-INFRASTRUCTURE-BLUEPRINT-2026-06-29.md` — the Neo / execution-provider plan.

## 1. The Delete Test — the one question, answered

**If `rumah-admin` disappeared tomorrow, could Delivery OS function as a reusable OS for a brand-new consumer?**

**NO as an autonomous-goal OS. YES as a workflow/delivery platform.** Objective evidence: `property-lead-os` runs the entire *stateless* platform (C11 engine, bus, builder orchestration, capability registry, verification, founder review/approval, config registry, readiness gates, observability, deploy/rollback) with **zero `rumah-admin` code** — that survives the delete. But the *stateful* goal-governance OS (PO loop, reconciler, lifecycle controller, sprint engine, supervisor, execution lifecycle, durable stores, metric probe, pre-flight, Slack surface) exists **only in `rumah-admin/src/`** and would be deleted with it.

## 2. What is TRUE (survived adversarial challenge)
- **The diagnosis is correct and not by design-flaw:** the stateful OS is mis-located in the first consumer because the extraction was *unstarted work*, not a coupling baked in. The platform owns the stateless half outright, proven on a second consumer.
- **The dependency invariant holds:** zero platform→consumer imports; zero consumer→platform-internals reach-ins (each consumer imports its own vendored engine). One cosmetic blemish (a JSON `$schema` sibling path).
- **Zero business-domain leakage:** the organs import no invoicing/property/settlement code — genuinely generic logic.

## 3. What the challenge CORRECTED (the honest sharpening)
1. **The coupling is bigger than "two ports."** The §4.3 lifecycle state machine and the C12 invariants exist **only as Postgres PL/pgSQL triggers (0052/0053) — there is no TypeScript mirror.** The C11 engine does it right: `state-machine.ts` + a trigger + a golden-master cage pinning them equal. Extracting "just the ports" would ship a `governance-engine` carrying the *signatures but none of the enforcement* — illegal transitions would silently succeed for any consumer with an imperfect adapter, imperfect migration, or a non-Postgres DB. **This is the single most dangerous finding.**
2. **There are no real metric probes.** Every probe today is a `SELECT 1` fixture. A real probe must be built for the platform claim to be meaningful (the PLOS proof needs `qualified-leads-count`).
3. **The portability envelope is Postgres/Supabase-plane, not "any DB."** Advisory locks, RLS role, `ON CONFLICT`, the trigger language — the honest claim is "any Postgres/Supabase consumer," not "any database." Three SQL files, not two (`metric-probe.ts` also imports `postgres`).
4. **The existing vendoring has live drift.** `property-lead-os`'s vendored engine is byte-divergent (CRLF), content-drifted on 2–4 files, pins split 6 commits apart — `engine-check` would **fail by its own rule right now**. The "proven model" has rot that must be fixed before we lean harder on it.
5. **The Neo blueprint over-claimed specifics:** in-flight LLM work is *not* durable (only the step is — a reclaim re-runs from scratch); the 60s executor timeout is unusable for real Claude runs; the launchd daemon is net-new bespoke code; the 5s tick is gold-plating; the "8,640 min/month" drain figure is inflated (a sub-minute read-only watchdog). The *direction* (self-host, kill the cron substrate) survives; the specifics need correction.

## 4. The corrected extraction scope (what "done" requires)
The blueprint's 6 ports (`RuntimeStoresPort`, `GoalContractStorePort`, `ProbeReaderPort`, `ConfigReadinessPort`, `NotifierPort`, `FounderBindingPort`) **plus the challenge's must-adds:**
- A **TypeScript legal-edge validator** mirroring the 0053 trigger + a **golden-master cage** pinning TS == DB (so enforcement is portable, not consumer-DB-dependent) — the governance analogue of the engine's `state-machine.ts` + cage.
- A **de-admin'd migration template** (0052/0053 stripped of admin specifics, applied numbers owned by each consumer).
- **One real MetricProbe** (replace the `SELECT 1` fixtures).
- The **governing invariant** enforced by a `legacy-guard`-style detector: no file under `governance-engine/` imports `./db/client.js`, the `postgres` driver, or `execFileSync`s a relative tool.
- **Validation = the PLOS-domain proof:** one `property-lead-os` lead-domain goal (`qualified-leads-count`) end-to-end through the vendored engine, zero admin code present. *That* is the moment the platform claim becomes true (not asserted).
- **Regression guard:** the 5-pass verification proved the *triggers*, not a port-injected TS impl — so each organ's existing self-test must re-run unchanged on the port, AND the golden-master cage must prove the TS validator matches the trigger.

## 5. Execution infrastructure (the GitHub-minutes forcing function)
- **GO, incrementally**, to self-hosted execution. The cron substrate, not CI, drained the meter (the dead-man `*/5` cron was the dominant cost). GitHub-hosted is both metered *and* capped — uniquely bad for a continuous-supervision workload.
- **Neo = Execution Node 1:** an ephemeral self-hosted Actions runner (PR checks) + a worker daemon (supervision tiers). Building on Windows + verifying on the Neo makes **author≠verifier physical** (neutral hardware).
- **The platform deliverable: `ExecutionProviderPort`** — the PO emits a provider-agnostic job; a constraint-first selector places it; results return on the existing durable-bus completer. Adding any node = registering an adapter, zero PO change. This makes the Runtime execution-provider-independent — a platform capability.
- **Hard precondition:** an off-Neo dead-man's-switch (failure-domain independence). **Corrections from challenge:** raise the executor timeout + prove a long run survives reclaim; scope the daemon as a real build item; drop the 5s tick; re-derive the minutes math honestly.

## 6. Repository ownership model (headline)
- **`delivery-os` (platform):** the C11 engine, the (new) `governance-engine` package + its TS validator/cage, builder orchestration, capability registry, verification, founder review/approval, config registry schema, readiness gates, observability, deploy/rollback tooling, the `ExecutionProviderPort`.
- **Consumers (`rumah-admin`, `property-lead-os`, future):** the Postgres/store adapter implementing the ports, the applied migrations, the domain MetricProbe descriptors, the Slack secrets, the scheduler tier instances, the domain itself.
- **Invariant that keeps it true:** no organ imports a concrete DB; enforced operationally by the legacy-guard detector + the green `engine-check`/`governance-check`.

## 7. Definition of Done for THIS gate
1. The corrected extraction scope (§4) is the agreed plan of record.
2. The RED `engine-check` drift is fixed (re-sync, re-pin, extend the parity test, vendor the `$schema`).
3. The `ExecutionProviderPort` + Neo-as-Node-1 (§5, corrected) is the agreed execution plan, with the off-Neo watchdog as a hard precondition.
4. Founder approval recorded. Only then may implementation sprints resume.

## Recommendation
Approve the **corrected** extraction scope (§4) and the execution direction (§5) as the plans of record; treat the `engine-check` drift fix as immediate pre-work. The founder's architectural instinct was right; the fix is well-defined and tractable, but it is a *real* extraction (TS-mirror + cage + real probe + migration template), not a trivial re-typing. Proceeding now — before more organs accrue in admin — is the cheapest this will ever be.
