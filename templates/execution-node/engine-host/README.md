# Platform Engine Host (M2 — Execution Runtime Extraction, ADR-005)

The thin runnable that hosts the **platform Execution Engine** on an **Execution Node**. The engine itself
is the vendored, domain-free library at `../../workflow-engine`; this host supplies the `EngineContext`
impls and drives the tick. It is **platform** code (shipped here, run on a node) — no consumer hosts it.

## The two-part boundary (why this is correct under ADR-005)
- **Compute → the node.** `run-engine-host.ts` runs a **continuous tick loop** (drain-while-advancing,
  back off when idle). The always-on Execution Node removes the serverless `*/5` cron-granularity limit —
  liveness is continuous, not every-5-minutes.
- **Durable state → a MANAGED store, off-node.** `ENGINE_DATABASE_URL` points at a managed platform Postgres
  (a dedicated platform store), **never node-local and never a consumer DB.** A node can be replaced without
  losing run/step state — the ADR-005 replaceability invariant. The node is disposable; the runs are not.

## Domain-free
This host runs the durable run/step/tick only. Workflow **definitions + handlers + verifiers + agents** are
domain code, registered into the engine registry at startup by the configured `ENGINE_PACKS` (a comma-list
of importable pack modules). The host imports **no consumer module** — consumers contribute their workflow
packs by configuration and submit goals over the goal-API. Empty `ENGINE_PACKS` = a bare durable drainer.

## Run / provision
- Dev:  `ENGINE_DATABASE_URL=postgres://… ENGINE_PACKS=… tsx run-engine-host.ts`
- Node: `ENGINE_DATABASE_URL=… bash ../provision-engine-runtime.sh --packs … --load`
  (applies the vendored migrations to the managed store, installs the launchd service that runs this host).

## Dependencies (provided by the node deployment, not by delivery-os)
`drizzle-orm/postgres-js`, `postgres`, `tsx`. delivery-os ships this as **vendored source** (it has no
runtime deps and runs no app — clean-room); the node deployment installs these and typechecks/runs the host.

## Relation to the scheduler tiers
The continuous tick supersedes the **engine-tick (C13)** cron tier on the node. The safety tiers
(dead-man's-switch C8, etc.) remain as independent-failure-domain GHA crons. The sanctioned-tier registry
(`scheduler-tiers`) becomes platform-owned as the cutover (M2/M3) proceeds; the node adds a new plane —
**`node`** (always-on platform compute) — alongside ECR-0005's serverless/Hetzner planes.

## Cutover safety (M2 → M3)
The tick is idempotent and liveness-only. During cutover the node host can run **alongside** a consumer's
existing tick (double-driving is safe — never a window where nothing drives the engine); the consumer's tick
is removed only after the node host is verified advancing runs (M3).
