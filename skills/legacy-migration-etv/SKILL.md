---
name: legacy-migration-etv
version: 2.0.0
stability: stable
description: >
  Extract -> Transform-plan -> Validate -> refusal-gated Load for migrating a legacy store into a new
  schema without losing or silently rewriting history. Invoke when real data must move between systems of
  record. The loader may ONLY orchestrate a plan that validates clean. (Migration phase pack — installed
  on demand, not always-on.)
decision_class: migration
inputs:  [read-only source access (DAY-ONE - secure a programmatic export path, never hand-transcribe), the target schema's real constraints, the owner's fidelity principles]
outputs: [pure pipeline modules (extract/transform-plan/validate/load), a dry-run MIGRATION report, a surfaced decision list for ratification]
earned_from: "Consumer A, 2026-06: 23 contracts / 18 invoices / 22 signature evidences migrated with ALL reconciliation exact and zero money deltas across five figures; 3 full pipeline runs; the predicted idempotency collision blocked the load exactly as profiled and was resolved by a ratified rule. Negative earning: ~150KB of source data was hand-transcribed TWICE because programmatic access wasn't secured day one."
mechanical_spine: "the Load stage REFUSES on any failed validation check and on unacknowledged decision-severity issues (--ack flag via decision-ratification); one-transaction load = automatic full rollback"
---
# Legacy Migration ETV (migration pack)

## Overview
History moves between systems of record without being lost or silently rewritten when every step before the
write is pure, reviewable code, and the only writer refuses anything the plan didn't validate clean.

## When to use (and NOT)
- Use when: real data must move between systems of record (rebuild, replatform, acquisition).
- **NOT** for: schema-only migrations (processes/database-migrations.md) or the go-live itself (→ `cutover-execution`).

## Process
1. **Day one: programmatic source access** — a connection string or one-shot exporter, never hand-transcription
   (the transcription cost compounds; it was paid twice in the record).
2. **Extract** (pure): raw rows → typed entities. Tolerate missing optionals; COUNT unknown namespaces, never drop them silently.
3. **Transform-plan** (pure): entities → planned destination rows + an ISSUE LIST with severities
   `blocker | decision | warning | info`. Non-negotiables proven valuable: money as integer cents (IEEE-safe
   half-up) · a provenance marker (e.g. `origin='legacy_import'`) on every row · conservative identity dedup
   (under-merge is recoverable; over-merge co-mingles history) · derived-vs-stored mismatches surfaced never
   absorbed · **NO event/outbox emission from historical imports**.
4. **Validate** (pure): checks mirroring the TARGET schema's actual constraints (counts, in-plan FK
   resolution, every UNIQUE, every CHECK recomputed, evidence invariants). Failed check = load-blocker.
5. **Load — the only writer**: refuses on any failed check; refuses on unacknowledged `decision` issues
   (`--ack` only after ratification — see the `decision-ratification` skill); ONE transaction so any error =
   automatic full rollback; reuse source UUIDs where they are UUIDs (traceability + idempotent re-run failure
   on PK); binary assets fetched by a separate manifest step with hash + size guards; `--emit-sql` so what you
   review is what runs.
6. **Decision surfacing is the product**: ambiguous identities, money/identity drift, in-flight workflows,
   no-home data each become a pre-framed founder decision — never a silent default.
7. Rehearse + reconcile via the `cutover-execution` skill before any production run.

## Red flags
- A loader that "fixes" data inline (every fix belongs in transform, visible in the plan).
- Constraints designed for the future rejecting real history — fit the constraint to the truth, ratify the rule.
- Hand-transcribing source data because access is awkward — fix access first.

## Verification (of this skill's own output)
Independent verifier (`verification` skill) must prove: counts; every adversarial corruption refused;
transactional abort leaves zero rows; in-DB hash checks on binary payloads.

## Changelog
- 2.0.0 — v4 promotion of consumer A's earned skill, generalized; nouns stripped; ratification + cutover seams wired to the base skills.
