# Process: Database Migrations

Data outlives code. Every migration is safe and reversible — or it has an explicit, approved, backed-up exception.

## Rules
- **Forward-only files**, reviewed, **CI-applied** on a fresh branch DB ("applies-clean" check). *(Field record: the schema applied cleanly 8+ times on fresh DBs including production, twice under pressure — this pair of defaults held everywhere.)*
- **Reversible** — a tested rollback path (down migration), or an approved exception with a backup.
- **Backup before** any production migration; record **row counts before/after**.
- **Expand → contract** for breaking changes: add new → backfill → switch reads/writes → remove old (across separate deploys), so code that tolerates both is live during the change.
- **Integrity in the schema** (constraints, FKs, unique) — not application hope. Transactions for multi-step changes.
- **ONE DDL TRUTH (v4, B26):** exactly one artifact is the source of schema truth; the others are generated
  from it. The empirical proof: one project ended with **three** schema truths — the ORM model, hand-written
  migrations ("the hand-written migration is the source of truth," the model file admitted), and a
  hand-migrated live DB with a known drift trap. Pick the generator direction on day one; hand-migrating a
  live DB is a standing defect, automate it.
- **v4 scaffold defaults (held 8+ times incl. production; zero money deltas across a five-figure migration):**
  RLS/policies in the SAME migration as any new table · role passwords set OUT-OF-BAND (`ALTER ROLE`), never
  in a migration · money as **integer cents** (IEEE-safe rounding) · **provenance markers** on imported rows
  (e.g. `origin='legacy_import'`) · the **outbox pattern** for event emission — and **NO event/outbox emission
  from historical imports** · `.env` ships with a NEVER-COMMIT header and is gitignored from day one.

## Data migration (legacy → new)
- Write a **data-migration plan** (`templates/data-migration-plan.md`): mapping, validation queries, dry run, rollback, backup.
- **Dry run** on production-like data; validate counts + spot-check; only then run for real.
- Never a one-way door without a restore point.

## Migration-vs-deploy ordering
Schema **expand** first → deploy code → backfill → switch → **contract** later. Never deploy code that assumes a column that isn't there yet.

## DoD rows (data slices)
- [ ] Forward-only + tested rollback · [ ] Applies clean on fresh DB (CI) · [ ] Pre-change backup + row-count validation · [ ] Integrity enforced in schema.
