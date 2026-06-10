# Data Migration Plan — <name>

> Never a one-way door. Backup + dry run + validation + rollback, before the real run.

## Source → target mapping
| Source field | Target field | Transform | Notes |
|---|---|---|---|

## Pre-flight
- [ ] **Backup** taken (restore tested) · location: <…>
- [ ] Row counts recorded (source): <…>
- [ ] Dry run on production-like data → expected counts/spot-checks pass

## Run
- [ ] Forward-only migration applied · [ ] Idempotent / re-runnable
- [ ] Row counts (target) match expected; reconciliation query passes

## Validation
- <queries that prove correctness — counts, sums, spot-checks>

## Rollback
- <exact steps to restore: down migration + backup restore> · trigger: <…>

## Sign-off
- [ ] Validated · [ ] Backup retained · approver/date: <…>
