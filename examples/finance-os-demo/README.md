# finance-os-demo — EXTRACTION SLICE 6: THE TERMINAL PROOF

A **brand-new, clean-room "Finance OS" consumer** that runs a finance goal to **DONE** and a stalled goal to
**HALTED + founder summon** through the **vendored Delivery OS `governance-engine`** — importing **ZERO**
`rumah-admin` / `property-lead-os` Runtime logic.

This is the founder's mandatory definition of done for the whole platform extraction:

> "prove that rumah-admin is only a consumer by creating (or simulating) a brand-new consumer that uses Delivery
> OS without copying Runtime logic. Delivery OS must become the single source of reusable Runtime capabilities."

## What this consumer holds vs. what it gets from the platform

| The consumer supplies (thin) | The platform provides (the whole Runtime) |
|---|---|
| `vendor/governance-engine/` — the SHA-pinned platform (do-not-edit) | Project Owner / Goal Intake (C1) |
| `src/finance-domain.ts` — its OWN finance probes (MRR, invoices-collected-ratio) | Pre-flight feasibility gate (C9) |
| in-memory store adapters (the platform's own shipped adapters) | Goal Supervisor (C7) — liveness ≠ progress |
| `FounderBindingPort` — the finance founder identity (fixture) | Reconciler — the SOLE state mutator (§15) |
| the goal acceptance + H1 budget | Sprint Engine (C10) + lifecycle controller (C2) |
|  | Completion Review (C6) — the fail-closed DONE gate |
|  | Founder Summon (C1) — guaranteed-reachability FAP delivery |

The consumer writes **no Runtime logic**. It calls **one** platform function, `createGovernanceRuntime(ports)`.

## Run

```sh
npm install                 # tsx + typescript + @types/node (dev only; the engine has ZERO runtime deps)
npm run finance:proof       # GOAL 1 → DONE, GOAL 2 → HALTED + summon   (exit 0 = green)
npm run plos:bonus          # BONUS: a PLOS lead-domain goal → DONE on the SAME platform (N≥2 domains)
npm run scan:zero-admin     # the load-bearing import scan: ZERO rumah-admin/plos imports (exit 0 = clean)
npm run typecheck           # tsc --noEmit over the consumer + the vendored engine
```

## The zero-admin-import proof

`scripts/scan-zero-admin-imports.mjs` starts at the consumer's entry files, follows **every** import edge
transitively, resolves each to a concrete file, and **hard-fails** if any reachable file — or any import
specifier anywhere in the graph — references `rumah-admin`, `property-lead-os`, or `@plos`. Result: the consumer
transitively imports only `vendor/governance-engine/**` + its own finance/lead domain + `node:crypto`.

## Why this proves the platform claim

If `rumah-admin` were deleted, this consumer keeps the Project Owner, Goal Intake, Sprint Planning, Goal
Supervisor, reconciler, lifecycle, and summon — every Runtime organ lives in the vendored platform, not in admin.
**Delivery OS is the platform; rumah-admin is only a consumer.**
