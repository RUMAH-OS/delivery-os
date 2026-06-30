# M1 — The platform-owned execution home (Execution Runtime Extraction, ADR-005)

> First milestone of the Execution Runtime Extraction (ADR-005, the third Platform Extraction). **DESIGN /
> SPEC + structural seam — no relocation built here** (that is M2). Defines *where* the Execution Engine +
> Heartbeat + scheduler run as a **Delivery OS platform deployment hosted on an Execution Node**, so no
> consumer hosts platform execution.

## M1 finding (evidence) — the extraction is smaller than it looks
| Concern | Where it is today | Class | Action |
|---|---|---|---|
| Engine **source** (engine.ts, state-machine, goals-route, workflow-route, callback-completer, capability-selector, approvals-route, agent-runner, verifiers, migrations) | **already platform-owned** — `delivery-os/templates/workflow-engine/`, vendored sha-pinned into consumers | **platform capability** | ✅ already extracted (PR-era) |
| Engine **runtime host** (`heartbeat-api.ts`, `engine-instance.ts`, the `*/5` tick driver, `infra/scheduler-tiers.json` ownership, the scheduler workflows) | **rumah-admin** (consumer) — Vercel deploy + `.github/workflows/{heartbeat-driver,dead-man-switch,goal-supervisor,scheduler-tiers}.yml` | **platform runtime, mislocated in a consumer** | **EXTRACT → platform deployment on the Execution Node (M2)** |
| **Admin-domain** workflow definitions (`engine-admin/invoice-*`, `contract-sync-*`, `owner-invoice-*`) + the executor wiring | rumah-admin | **consumer domain** | **stays in the consumer** — registered with the platform engine as definitions; consumer submits goals |
| The data the workflows operate on (Admin Postgres) | rumah-admin | **consumer SoR** | stays (ECR-0004) |

**So the runtime extraction = relocate the *host* (instance + `*/5` tick + scheduler registry), not the
engine code (already platform) and not the Admin workflows (legitimately consumer-domain).**

## The platform-owned execution home (target)
A **Delivery OS execution runtime**, deployed and run on an **Execution Node** (Neo = Node 1):
1. **Engine instance** — instantiates the vendored `templates/workflow-engine` against a platform-owned
   durable store; owns the run/step state machine, leases, recovery, the completer.
2. **The tick** — the `*/5` engine-step driver runs **on the node** (a node service: launchd, per
   `templates/execution-node/provision-heartbeat.sh`) — NOT a consumer's Vercel/GHA cron. This is the
   liveness driver `scheduler-tiers.json` already calls "engine-tick / C13".
3. **The scheduler tier registry** — `scheduler-tiers.json` (the sanctioned-scheduler SoT) becomes a
   **platform** artifact; tiers (C13 tick · C2-LOOP reconciler · C7 supervisor · C8 dead-man's-switch) are
   platform-owned, node-hosted (C8 may stay GHA by its deliberate different-failure-domain design).
4. **The goal-API surface** (`/v1/goals`, `/v1/workflow/runs/:id`, `/v1/approvals`, the callback completer)
   — served by the platform runtime on the node. This is the same surface the **Control Surface (ADR-004)**
   consumes and that **Sprint 5.3 goal-intake C1** must target.

## The structural seam (how the pieces connect — no behavior change in M1)
```
delivery-os (platform)
├── templates/workflow-engine/        # engine SOURCE (already platform; vendored) — UNCHANGED
├── templates/execution-node/         # node provisioning (PR #26): runner, heartbeat, launchd, contract
│     └── (M2) provision-engine-runtime.sh   # NEW (M2): stand the engine instance + */5 tick on the node
├── capabilities/scheduler-tiers/     # (M2) scheduler tier registry promoted from the consumer → platform
└── capabilities/EXECUTION-RUNTIME-EXTRACTION-M1.md   # this spec

Execution Node 1 (Neo)
└── runs the Delivery OS execution runtime  (engine instance + */5 tick + scheduler + goal-API)

consumers (rumah-admin, …)
├── keep domain workflow DEFINITIONS (invoice/contract) — register them with the platform engine
├── keep their SoR data
└── SUBMIT goals + OBSERVE runs over the goal-API  (never host the engine; no node runner on a consumer)
```

## What M1 delivers (this PR)
- This spec + the ownership table + the structural seam (above).
- The decision that the **scheduler tier registry is platform-owned** and the **tick is node-hosted** (the
  cadence/relocation itself is M2; M1 only fixes *where it will live*).
- No code relocation, no consumer change yet (M1 is design; M2 relocates).

## Handoff to M2 (relocate)
1. Add `templates/execution-node/provision-engine-runtime.sh` (instance + `*/5` tick as a node service).
2. Promote `scheduler-tiers.json` (+ `.mjs` validator) from rumah-admin → `delivery-os/capabilities/scheduler-tiers/` (platform SoT).
3. Stand the engine runtime + tick on Neo; run alongside the consumer's current tick (idempotent — the tick
   is liveness-only, double-driving is safe per `scheduler-tiers.json`), then cut the consumer's tick over.
4. M3 re-points consumers to the node goal-API; M4 provisions Neo's runner+heartbeat against it +
   `verify-node.sh --require runner,heartbeat`.

## Verification criteria (M1)
- The spec names the platform execution home and the seam; no consumer hosts platform execution in the
  target; the runner target is the platform runtime, never a consumer.
- Engine **source** stays the single vendored `templates/workflow-engine` (no fork).
- Admin-domain workflows are classified as consumer-domain (stay), runtime-host as platform (extract).

## Rollback
Design-only; rollback = supersede this spec. M2+ relocations are each reversible (the tick is idempotent;
the consumer's current cron stays live until the node tick is verified — never a no-driver window).
