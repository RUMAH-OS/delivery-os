# governance-engine — `adapters/` (the CONSUMER plane — outside the residency boundary)

This directory is the **reference consumer adapter**, NOT engine code. It is the one place under
`templates/governance-engine/` that is **excluded from the residency guard** (`residency-guard.mjs` skips
`adapters/`), precisely because it does what the engine never may: it imports the `postgres` driver and issues the
raw SQL — the `pg_advisory_xact_lock`, the CAS `UPDATE`s, the `ON CONFLICT` upserts, the read-only probe
connection — that the organs only ever reach through an **injected port**.

A real consumer (rumah-admin, property-lead-os) **copies/adapts** `postgres/` into its own repo and wires it into
`createGovernanceRuntime`. It is shipped here as a working reference of the seam, sha-pinned alongside the engine.

## `postgres/` — implements all 6 ports + the migration plumbing

| File | Port(s) / role |
|---|---|
| `runtime-stores.ts` | `RuntimeStoresPort` — admin's `src/runtime-stores.ts` SQL **verbatim**, `sql` injected. |
| `goal-contract.ts` | `GoalContractStorePort` — admin's `src/goal-contract.ts` SQL **verbatim**, `sql` injected. The §4.3 legality stays in the DB trigger. |
| `probe-reader.ts` | `ProbeReaderPort` + `CredentialResolver` — `makeReadOnlySqlReader` / `sqlCredentialResolver` **verbatim** (L1/L2 of the 4-layer probe guarantee; L3/L4 stay in the package). |
| `plane.ts` | `ConfigReadinessPort` (`makeEnvConfigReadiness`) · `NotifierPort` (`makeWebhookNotifier`, draft-don't-send) · `FounderBindingPort` (`makeFounderBinding`, fail-closed). Generic reference plane impls. |
| `connection.ts` | `openPostgres(url)` (SESSION connection — never the :6543 txn pooler) · `applyTemplateMigrations` / `dropTemplateMigrations` (apply the de-admin'd `../../migrations/` template, substituting `{{app_role}}`). |
| `index.ts` | the barrel a consumer imports. |

## Why it lives inside the package directory but outside the boundary

The engine's central invariant is *no organ file imports a DB driver* (`residency-guard.mjs`). The adapter is the
sanctioned exception that makes that invariant tractable: by giving the driver one quarantined home (this dir,
scoped out of the guard's scan), the organ surface can stay provably clean while a runnable reference of the
Postgres plane still ships in the same sha-pinned tree. The faithfulness self-test
(`../scripts/postgres-faithfulness-self-test.ts`) proves the organs behave identically on this adapter and on the
in-memory one.
