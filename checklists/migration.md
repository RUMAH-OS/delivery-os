# Migration checklist

See `processes/database-migrations.md` + `templates/data-migration-plan.md`.

## Schema migration
- [ ] Forward-only file, reviewed · [ ] **applies clean on a fresh DB** (CI) · [ ] tested **rollback** (down) · [ ] integrity in schema (constraints/FK/unique)
- [ ] **expand→contract** for breaking changes (add → backfill → switch → remove, across deploys) · [ ] code never assumes a not-yet-added column

## Data migration
- [ ] **Backup** taken (restore tested) · [ ] row counts recorded before · [ ] **dry run** on production-like data · [ ] idempotent/re-runnable · [ ] reconciliation passes after · [ ] rollback steps documented

## Ordering
- [ ] Schema expand → deploy code → backfill → switch → contract (separate steps)
