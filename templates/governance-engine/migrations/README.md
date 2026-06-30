# governance-engine — migration TEMPLATE (de-admin'd; copy-in, not auto-applied)

The complete, applyable DDL a new consumer needs to stand up the governance runtime on its own Postgres. This is
a **template**, not a migration the package runs for you: a consumer copies these files into its own migrator with
its **own applied numbers** (admin's are `0052`/`0053`; PLOS will pick its next free pair), substitutes
`{{app_role}}`, and owns them from then on.

These same up files are ALSO the reference DDL the two cages pin against
(`golden-master.ts` parses `0001_goal_contract.sql`; `runtime-stores-cage.ts` parses `0002_runtime_durable_stores.sql`),
so the de-admin'd template and the cage's pinned edge/invariant set are guaranteed to be the same artifact — they
cannot drift.

## Files

| File | What it is |
|---|---|
| `0001_goal_contract.sql` | `goal_contract` table + the §4.3 legal-edge state-machine trigger (`goal_contract_state_machine_guard`) + RLS. The cage's pinned reference for the state machine. |
| `0002_runtime_durable_stores.sql` | the 6 C12 durable stores + the shared `c12_append_only_guard` / `c12_idempotency_guard` functions + per-table append-only / write-once triggers + RLS. The cage's pinned reference for the C12 invariants. |
| `0001_goal_contract.down.sql` | paired DOWN (drops the trigger, function, table). Clean-room rollback only. |
| `0002_runtime_durable_stores.down.sql` | paired DOWN (drops the 6 tables + the 2 guard functions). Clean-room rollback only. |

Apply order is `0001` then `0002` (the up files are independent — neither FKs the other — but this is the canonical
order); roll back in reverse.

## De-admin'ing — the one substitution

Every RLS policy targets `{{app_role}}` — the consumer's own non-superuser runtime role (admin substitutes
`rumah_app`; PLOS substitutes its Supabase app role). Substitute it at copy-in (a literal find/replace, or your
migrator's templating). Nothing else is admin-specific — the table shapes, the CHECK constraints, the trigger
**function bodies**, and the legal-edge set are byte-for-byte the canonical admin DDL.

```sh
# example: stamp the template for a consumer whose runtime role is `app_user`
sed 's/{{app_role}}/app_user/g' 0001_goal_contract.sql > <your-migrations>/00NN_goal_contract.sql
sed 's/{{app_role}}/app_user/g' 0002_runtime_durable_stores.sql > <your-migrations>/00NN_runtime_durable_stores.sql
```

## Prerequisites the consumer owns (NOT in these files)

1. **The app role must already exist.** `CREATE POLICY ... TO {{app_role}}` fails if the role is absent. Create it
   (and its least-privilege grants) in your own role/bootstrap migration before applying these. The role must be
   **non-superuser** — a superuser bypasses RLS *and* (via `session_replication_role` / `DISABLE TRIGGER`) could
   bypass the guard triggers; the whole defense-in-depth case rests on the app path running as a non-superuser.
2. **`gen_random_uuid()`** is core in Postgres 13+ (no `pgcrypto` extension needed). On older Postgres, `CREATE
   EXTENSION IF NOT EXISTS pgcrypto;` first.
3. The **read-only probe role** (the MetricProbe L1 boundary) is a separate consumer concern — see the reference
   `adapters/postgres/probe-reader.ts`; it is not part of these store migrations.

## What enforces what (so a reviewer can see the boundary)

- The **state-machine legality** (§4.3) is the `goal_contract_state_machine_trg` BEFORE-UPDATE trigger — owner-proof,
  fires for every role including a raw SQL `UPDATE`. The TypeScript validator (`state-machine.ts`) mirrors it; the
  golden-master cage pins the two to the SAME 34-edge set.
- The **append-only** invariant (4 stores) is structural (the port has no mutation method) AND enforced by
  `c12_append_only_guard` + the absence of any UPDATE/DELETE RLS policy on those tables.
- The **idempotency write-once** rule is `c12_idempotency_guard`; the **durable breaker** is the `circuit_breaker`
  CAS. The runtime-stores cage pins the in-memory adapter to honor all of these.

The reference **Postgres adapter** that issues the SQL behind the ports (the `pg_advisory_xact_lock`, the CAS
`UPDATE`s, the `ON CONFLICT` upserts) lives in `../adapters/postgres/` — outside the residency-guarded organ
surface, because it is the consumer-side plane, not the engine.
