---
name: ecosystem-alignment-review
version: 1.0.0
stability: stable
description: >
  Cross-check a project's owned/consumed entities against the ecosystem source-of-truth registry —
  no entity has two owners; dependencies recorded; conflicts raised as an ECR (never silently diverged).
  Invoke at discovery step 6, and thereafter whenever the session-start sibling probe reports a peer
  delta/UNKNOWN that touches ownership — NOT on a self-judged "on change" (v4 trigger amendment: a
  consent-based on-change trigger structurally cannot fire when the change is what you don't know;
  that is how the costliest cross-repo incident happened with this skill installed).
decision_class: architecture
required_lenses: [lead-architect, database-data]   # + the ecosystem owner (human)
inputs:  [the project's entity ownership claims, the ecosystem source-of-truth + glossary + responsibilities registries]
outputs: [an alignment note; an ECR if a cross-project decision is needed]
---
# Ecosystem-Alignment Review

Promotes step 6 of `discovery/DISCOVERY-WORKFLOW.md` (Part 4 of the interview) into a callable skill. **The ecosystem registries OWN the cross-project facts; this skill POINTS and cross-checks — it never restates or duplicates them.**

## When to use
Discovery step 6, and thereafter **ride the sibling probe**: when the SessionStart probe (or a
`cross-system-reality-audit`) surfaces a peer delta touching entities/ownership, this review runs. The old
"any time a boundary changes" trigger is retired — it asked the agent to notice the unknown (the recorded
failure mode; see the incident ledger, incident 5).

## Procedure
1. List what the project **owns** (writer-of-record) vs **consumes**.
2. Cross-check against `../ecosystem-architecture/06-source-of-truth-registry.md` + `10-shared-business-entities.md` (canonical names) + `11-project-responsibilities.md`. **No entity may have two owners.**
3. Record dependencies (in/out) — point to `05-integration-map.md` / `09-project-dependency-map.md`.
4. **Any conflict with a ratified source-of-truth or ECR → raise an ECR** (a cross-project decision; run `principle-11-review`). Do **not** silently diverge.
5. Confirm or adjust the provisional domain-pack choice in light of the mission.
6. Register/update the project in the ecosystem `02`/`03` registry (the registry OWNS; the project's `CLAUDE.md §7` POINTS to it).

## Success criteria
- Owned-vs-consumed mapped · no two-owner conflict · dependencies recorded · conflicts raised as ECRs (not diverged) · canonical glossary names used · project registered in the ecosystem layer.

## Honest failure
A naming collision (e.g. a local "company" that is really the ecosystem "Property Owner", not the demand-side "Organisation") is surfaced as an **implementation finding that implements the ECR**, not a quiet local redefinition.

## Changelog
- 1.1.0 — v4 (S5): trigger re-based onto the sibling probe — "on change" cannot fire on the unknown; body kept.
- 1.0.0 — promoted from `discovery/DISCOVERY-WORKFLOW.md` step 6 + the ecosystem registries.
