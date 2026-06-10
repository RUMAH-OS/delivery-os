# Process: Database Migrations

Data outlives code. Every migration is safe and reversible — or it has an explicit, approved, backed-up exception.

## Rules
- **Forward-only files**, reviewed, **CI-applied** on a fresh branch DB ("applies-clean" check).
- **Reversible** — a tested rollback path (down migration), or an approved exception with a backup.
- **Backup before** any production migration; record **row counts before/after**.
- **Expand → contract** for breaking changes: add new → backfill → switch reads/writes → remove old (across separate deploys), so code that tolerates both is live during the change.
- **Integrity in the schema** (constraints, FKs, unique) — not application hope. Transactions for multi-step changes.

## Data migration (legacy → new)
- Write a **data-migration plan** (`templates/data-migration-plan.md`): mapping, validation queries, dry run, rollback, backup.
- **Dry run** on production-like data; validate counts + spot-check; only then run for real.
- Never a one-way door without a restore point.

## Migration-vs-deploy ordering
Schema **expand** first → deploy code → backfill → switch → **contract** later. Never deploy code that assumes a column that isn't there yet.

## DoD rows (data slices)
- [ ] Forward-only + tested rollback · [ ] Applies clean on fresh DB (CI) · [ ] Pre-change backup + row-count validation · [ ] Integrity enforced in schema.
