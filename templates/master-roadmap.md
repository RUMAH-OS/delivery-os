# Master Roadmap — <PROJECT>

> Phases → independently-deliverable **vertical slices**. Sequenced by dependency **and de-risking value**. A thin slice reaches the **real target environment** in Phase 1–2. Target architecture may be defined day 1, but **activate capabilities on bottleneck** — don't build ahead of need.

## Phases
| Phase | Objective | Exit gate |
|---|---|---|
| 0 | Audit/discovery (if inheriting) | evidence-based repair-vs-rebuild |
| 1 | Foundations + **thin slice to production** (deploy + CI + one real transaction) | it runs in target env |
| 2 | Core domain (deterministic spine first) | spine proven |
| … | … | … |
| N | Release / cutover | readiness gates clear |

## Slice backlog
| Slice | Phase | Objective (end-to-end) | Deps | Size | Status |
|---|---|---|---|---|---|
| S01 | 1 | <…> | — | S | ⬜ |

## Critical path
<the dependency chain that determines earliest release>

## Capability activation (manual-first)
<which capabilities/agents switch on at which bottleneck; collect the signal before building the learner>

## External dependencies (request day one)
<credentials / accounts / DNS / consoles / approvals> — owner + status.
