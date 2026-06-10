---
name: migration-assessment
version: 1.0.0
stability: stable
description: >
  Read-only, capability-by-capability audit of an existing/inherited/in-prod system, ending
  in a keep/modernize/partial/rebuild recommendation via an independent §11 panel. Invoke when
  reassessing a legacy system before re-architecting. Capability-by-capability, NOT page-by-page.
decision_class: migration
required_lenses: [lead-architect, software-engineer, qa-test, reviewer-critic]
# + pack-conditional: database-data (always for data systems) · security-compliance (money/PII/e-sign) · api-integration (integrations)
inputs:  [a READ-ONLY copy of the system (e.g. current-system/), the ratified target arch/ECRs, the project invariants]
outputs: [docs/MIGRATION-ASSESSMENT.md, docs/DECISION-REVIEW-<date>-<topic>.md]
---
# Migration Assessment

The repeatable form of the play proven on Rumah Admin (see its `docs/MIGRATION-ASSESSMENT.md` + `DECISION-REVIEW-*` as the worked example). **Read-only — never modify the system under audit.**

## The 7 audits → a Capability Register
1. Current functionality → a **capability register**: each capability gets value-tier · health · ecosystem-ownership fit · **disposition** (1 preserve&modernize · 2 migrate-as-is · 3 redesign · 4 retire).
2. Technical architecture · 3. Data model · 4. Integrations · 5. Operational workflows · 6. Migration risk · 7. Rebuild-vs-modernization analysis.

## Procedure
1. Extract/inspect read-only; map the real architecture, data model, endpoints, integrations (cite `file:line`; unknowns = `TBD — verify`).
2. Build the capability register (capability-by-capability; preserving valuable workflows ≫ preserving screens).
3. Run `principle-11-review` (decision_class: migration) — independent lenses **blind**, surface disagreements, classify findings; the recommendation (keep/modernize/partial/rebuild) is consolidated, never single-agent.
4. Filter every option through the project's invariants. Decouple operational bug findings from the strategic recommendation if they don't change it.

## Success criteria
- Every capability dispositioned. Recommendation ∈ {keep, modernize, partial, rebuild} with named dissents surfaced. Every finding cites `file:line` or `TBD — verify` (no invention). Each invariant explicitly addressed. Data-migration discipline (backup+restore-test · row-count **and value** reconciliation · dry-run · tested rollback · expand→contract) named for any data move.

## Honest failure
Production-impact claims unverifiable from code are marked **Hypothesis requiring runtime verification**, not asserted as live incidents.

## Changelog
- 1.0.0 — packaged from the Rumah Admin assessment + `processes/database-migrations.md` + `checklists/migration.md`.
