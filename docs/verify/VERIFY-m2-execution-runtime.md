# VERIFY — M2 Execution Runtime Extraction (platform engine host)

- **Slice:** M2 (ADR-005) — author the platform artifacts that host the Execution Engine runtime on an
  Execution Node. **Design+build of the relocation recipe; no production cutover here** (that is M3/M4).
- **Author:** builder. **Note:** this is a builder self-verification of *static artifacts*; an independent
  VERIFY (author≠verifier) must run at the node deployment (M4), where deps exist and the host actually runs.

## What was built
- `templates/execution-node/engine-host/run-engine-host.ts` — the platform engine host: loads a 0600 env
  file, connects Drizzle/postgres to the **managed** store, `createEngine({db, tables})`, registers
  configured domain packs (`ENGINE_PACKS`, no consumer imports), runs a **continuous idempotent tick loop**.
- `templates/execution-node/provision-engine-runtime.sh` — applies the vendored engine migrations to the
  managed store (tracked, idempotent), renders the launchd service; refuses to embed the store URL in the
  world-readable plist (0600 env file).
- `templates/execution-node/launchd/com.deliveryos.engine.plist.template` — the continuous-tick daemon
  service (KeepAlive).
- `templates/execution-node/engine-host/README.md` — the host contract + the compute-on-node /
  durable-state-off-node rationale + cutover safety.

## Checks performed (PASS)
| Check | Result |
|---|---|
| `bash -n provision-engine-runtime.sh` | PASS (syntax clean) |
| Clean-room / no-backflow lint (templates/ scanned) | PASS — 0 new violations (names no project/host/path) |
| Host imports resolve to real engine exports (`createEngine` in `index.ts`; `workflowRun/workflowStep/outbox` in `schema.ts`) | PASS |
| Secret handling (store URL via 0600 env file, never the plist; never an arg) | PASS by construction |
| Replaceability invariant (ADR-005): store is `ENGINE_DATABASE_URL` managed/off-node, guarded against empty/non-postgres; documented "never node-local, never a consumer DB" | PASS by construction |
| Domain-free (no consumer module imported; packs by config) | PASS |
| Migrations applied idempotently via a `_engine_migrations` ledger | PASS by construction |

## Honest limits (what is NOT verified here — needs the node deployment / founder grants)
- **No TypeScript typecheck of the host** — delivery-os has no `drizzle-orm`/`postgres` deps (it ships
  vendored source and runs no app). Typecheck happens at the node deployment that installs deps (M4).
- **No live run** — applying migrations + ticking needs the **managed platform store** (a founder
  credential) and the node (founder grants). Not exercised here.
- **Cutover not performed** — the consumer still hosts the live tick; M3 re-points and removes it only after
  the node host is verified advancing runs (idempotent double-drive is safe in the interim).

## Verdict
M2 platform artifacts are **built and statically verified**; the runtime relocation is now a parameterized,
founder-authorizable deployment. Remaining to reach a live platform engine: a managed durable store
(credential) + the node grants + an independent at-deploy VERIFY (M4).
