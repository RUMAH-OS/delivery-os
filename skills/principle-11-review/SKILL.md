---
name: principle-11-review
version: 1.0.0
stability: stable
description: >
  Run an independent multi-lens review of a CONSEQUENTIAL decision (architectural, migration,
  production-readiness, security-sensitive, or data-sensitive). Lenses work BLIND, disagreements
  are surfaced not smoothed, then consolidated. No single agent — orchestrator included — concludes
  alone. Invoke BEFORE issuing any recommendation on a consequential decision.
decision_class: architecture | migration | production-readiness | security | data
required_lenses: [lead-architect, reviewer-critic]   # minimum: ≥2 independent lenses + Reviewer/Critic; scale to stakes & active packs
inputs:  [the decision + its options, the decision-class, the relevant evidence/files]
outputs: [docs/DECISION-REVIEW-<date>-<topic>.md]
---
# Principle-11 Review

The callable form of Governance §11. This skill makes §11 **runtime-verifiable** rather than a principle a human must remember to invoke. It does not *expand when* review is required — it makes the *required* review easier to run.

## When to use
Any decision in the §11 classes (`core/GOVERNANCE.md §11`). If unsure whether a decision is consequential → run it. **Scale the panel to the stakes:** a small reversible call needs fewer lenses; money/data/cutover needs the full set. Always ≥2 independent lenses + the Reviewer/Critic.

## Procedure
1. Classify the decision (architecture | migration | production-readiness | security | data) ∩ the project's active packs → pick the required lenses.
2. Each lens reaches its finding **BLIND to the others** — no shared draft, no anchoring on a prior conclusion (the router/orchestrator **points, it never pre-concludes**).
3. **Surface convergence AND every disagreement** explicitly — a buried dissent is a process failure.
4. The author of the candidate recommendation does **not** adjudicate it; the Reviewer/Critic challenges it adversarially.
5. Consolidate into `DECISION-REVIEW-<date>-<topic>.md` (findings · dissents · consolidated recommendation). **The human merge gate decides** — the panel informs.

## Success criteria (runtime-verifiable)
- ≥2 independent lenses recorded + Reviewer/Critic · lenses were blind · every dissent surfaced · author ≠ consolidator · output written as a durable `DECISION-REVIEW` artifact · the recommendation is consolidated, never single-agent.

## Honest failure
If the lenses could not actually run independently, **say so** and mark the review non-independent. Do not stage a panel for appearance — §11 exists for independent viewpoints, not the look of rigor.

## Changelog
- 1.0.0 — extracted from `core/GOVERNANCE.md §11` + the reusable "independent decision-review panel" prompt; subsumes architecture-review and roadmap-review as decision-class parameterizations.
