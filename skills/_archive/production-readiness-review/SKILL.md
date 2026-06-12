---
name: production-readiness-review
version: 1.0.0
stability: stable
description: >
  Pre-release / pre-cutover go/no-go. N independent lenses vote ready / ready-with-conditions /
  not-ready against the release-readiness criteria; the release is gated on the conditions.
  Invoke before any release, deploy promotion, or DNS/cutover.
decision_class: production-readiness
required_lenses: [qa-test, reviewer-critic, security-compliance]   # + api-integration / database-data by pack
inputs:  [docs/release-readiness.md, the slice/release, the deployment runbook, the rollback plan]
outputs: [a go/no-go verdict + conditions, release-readiness.md filled, optional DECISION-REVIEW]
---
# Production-Readiness Review

A `principle-11-review` specialized to the **release** gate — the "multi-reviewer readiness audit" made callable.

## When to use
Before a release, a deploy promotion, or an irreversible cutover (DNS, data migration, first real outward transaction).

## Procedure
1. Each lens independently votes **ready / ready-with-conditions / not-ready** against `templates/release-readiness.md` + the active pack checklists (`checklists/release-cutover.md`, `security-review.md`, `migration.md`, `api-change.md`).
2. Verify the irreversible-action discipline (Governance §6): outward actions human-gated; **restoreable state captured + rollback defined** before any irreversible change; honest-failure on sensitive paths.
3. Surface every condition; **gate the release on the conditions** — not on a majority feeling.
4. Consolidate; the human merge gate makes the call.
5. **OS-feedback triage (Governance §14).** Before tagging the release, answer the three triage questions — *were any framework-level lessons discovered this cycle? any OS Candidates? route each to project / ecosystem / Delivery OS?* — into `docs/feedback/OS-FEEDBACK-<tag>.md` (`templates/OS-FEEDBACK.md.template`). The release tag is **mechanically blocked** without it; *"No framework lessons discovered." is a valid answer.* Do not assume a lesson becomes a skill — route it to the right artifact (hook/template/doctrine/skill/agent/lint/process/none).

## Success criteria
- Every required lens voted independently · conditions itemized and owned · rollback tested · backup taken (restore tested) for data changes · no false "ready" on an unmet condition.

## Honest failure
A red-team finding or an unmet condition blocks "ready," with the specific evidence. Never declare success on a false positive.

## Changelog
- 1.0.0 — new (thin); seeded from `templates/release-readiness.md` + `checklists/release-cutover.md` + the readiness-audit prompt.
