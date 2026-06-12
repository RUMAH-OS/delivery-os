---
name: cutover-execution
version: 2.0.0
stability: stable
description: >
  Execute a production data cutover safely: drift sentinels bracketing the window, deploy-empty-first
  smoke, same-day rehearsal with the production tooling, one-transaction load, reconciliation battery with
  independent hand-derivation, phased rollback posture. Invoke for any go-live that moves real data between
  systems. (Migration/release phase pack.)
decision_class: migration
inputs:  [a verified ETV pipeline (legacy-migration-etv), ratified decisions, target credentials, the runbook]
outputs: [a living READINESS doc, then a final EXECUTED record with full reconciliation evidence (the two-doc rule)]
earned_from: "Consumer A's production cutover 2026-06-12: all reconciliation exact, zero drift, the legacy source preserved as fallback — and the rehearsal was real enough that the production run was boring. Negative earnings folded in: schema once applied into the live legacy project on an unverified environment assumption; five overlapping migration reports told one story (~40% overlap)."
mechanical_spine: "hard preconditions (ratified decisions in writing; rehearsal same-day); one-transaction load = automatic rollback; the two-doc rule caps the report family"
---
# Cutover Execution (migration/release pack)

## Overview
A cutover is safe when nothing about the production run is new: the tooling rehearsed, the counts predicted,
the rollback posture named per phase, and at least one number derived by hand.

## When to use (and NOT)
- Use when: any go-live moves real data between systems (the named cutover moment — Operating Loop standing beat).
- **NOT** for: code-only deploys (release checklist + platform pack) or building the pipeline (→ `legacy-migration-etv`).

## Process
1. **Preconditions are hard gates** — decisions ratified IN WRITING; **verify which environment you are in
   before any DDL** (schema was once applied into the live legacy project); schema at target version on
   production; **deploy-empty-first (N4)**: the production deployment smokes green on the EMPTY store first,
   so launch day is then only data.
2. **Drift sentinels BEFORE**: counts + latest-timestamps + value sentinels on the source. If unchanged since
   the last verified export, that export IS the final export.
3. **Assets step**: fetch binaries by manifest (hash + magic-byte + size checks; abort on any failure —
   missing evidence is a blocker, not a gap).
4. **Rehearse on a disposable DB the SAME DAY** with the exact tooling and data. The production run must be
   boring. Rehearsal acks are labeled rehearsal-only (N5 — they never satisfy production).
5. **Pre-load review**: `--emit-sql` header counts vs expectations. Abort condition: any surprise.
6. **LOAD: one transaction.** Any error = automatic full rollback to empty; the source stays read-only
   throughout and remains the fallback.
7. **Reconciliation battery**: counts, money sums, orphan checks, in-DB hash verification of every binary,
   provenance sweep, sequence values — and **at least one number INDEPENDENTLY hand-derived from raw source
   data**. Green checks you didn't cross-derive are belief, not knowledge.
8. **Drift sentinels AFTER** — prove nothing changed in the source during the window; on drift, assess the
   delta and re-run (the pipeline recomputes everything).
9. **Validate the consuming surfaces** (APIs/UI) against the loaded truth; record the EXECUTED doc; name the
   rollback posture per phase (during load: automatic · before go-live: truncate+reload or stand down ·
   after go-live: source fallback until the window closes · steady state: PITR/backups).
10. **Two-doc rule (T9)**: one living READINESS + one final EXECUTED record — never a per-milestone report
    family (five overlapping documents carried the assurance two would have).

## Red flags
- Executing without a same-day rehearsal ("it worked last week").
- A reconciliation that only re-asserts what the loader wrote (derive independently or it proves nothing).
- **Operator authorization treated as transferable** — the production load command needs the owner's explicit,
  current instruction; a relayed "go" is not authorization.
- **Closing the source/fallback in the same change as the cutover (N6)** — decommission is its own later decision.

## Verification (of this skill's own output)
- The EXECUTED record shows the full battery with verbatim numbers, including the hand-derived one.
- The rollback posture per phase is written BEFORE the load, not reconstructed after.

## Changelog
- 2.0.0 — v4 promotion of consumer A's earned skill + N4 (deploy-empty-first), N5 (rehearsal-only acks), N6 (decommission-is-separate), the environment-verification red flag, and the two-doc rule.
