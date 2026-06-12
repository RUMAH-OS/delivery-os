# Migration checklist

See `processes/database-migrations.md` + `templates/data-migration-plan.md`. For legacy-data moves use the
`legacy-migration-etv` + `cutover-execution` skills (migration pack).

## The two-doc rule (v4, T9)
A migration/cutover produces exactly **two** documents: a **living READINESS** (updated until go) and a final
**EXECUTED** record (the evidence). Never a per-milestone report family — five overlapping documents once told
one story with ~40% overlap and no added assurance (the source consumer's own ceremony-rent finding).

## Schema migration
- [ ] Forward-only file, reviewed · [ ] **applies clean on a fresh DB** (CI) · [ ] tested **rollback** (down) · [ ] integrity in schema (constraints/FK/unique)
- [ ] **expand→contract** for breaking changes (add → backfill → switch → remove, across deploys) · [ ] code never assumes a not-yet-added column

## Data migration
- [ ] **Backup** taken (restore tested) · [ ] row counts recorded before · [ ] **dry run** on production-like data · [ ] idempotent/re-runnable · [ ] reconciliation passes after · [ ] rollback steps documented

## Ordering
- [ ] Schema expand → deploy code → backfill → switch → contract (separate steps)
