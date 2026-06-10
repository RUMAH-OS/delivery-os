# Project Discovery Checklist (the gate to planning)

> Discovery is **complete** only when every box is ✅. Until then, **no roadmap, ADR, architecture, or implementation** begins.

## Interview
- [ ] Founder Discovery Interview conducted (`FOUNDER-INTERVIEW.md`) — all four parts.
- [ ] Each part **reflected back** to the founder and corrected.
- [ ] **No fabrication:** every claim in the docs traces to a founder answer; unknowns are `TBD — to confirm`, listed explicitly.
- [ ] Verbatim captured: the elevator line, the purpose, the north star.

## Foundational documents (generated + founder-approved)
- [ ] `PROJECT-BRIEF.md` — what / who / problem / why / **measurable success** / constraints / risks. **Approved.**
- [ ] `PROJECT-MISSION.md` — purpose / core responsibilities / **non-goals** / boundaries / definition of success. **Approved.**
- [ ] `NORTH-STAR.md` — long-term vision / platform role / ecosystem alignment / 3–5yr destination / **invariant**. **Approved.**

## Quality bar (don't pass weak answers)
- [ ] "Who is it for?" is a **specific role/segment**, not "businesses/users."
- [ ] Success is **measurable** (a number or an observable event), not "people like it."
- [ ] **Non-goals** are stated (scope is bounded, not open-ended).
- [ ] Boundaries name what it **owns vs consumes**.
- [ ] Top risks/unknowns are captured (they become de-risk targets in the roadmap).

## Ecosystem alignment (if other projects exist)
- [ ] Entities **owned vs consumed** mapped; **no entity has two owners** (cross-checked vs the source-of-truth registry).
- [ ] Dependencies (in/out) recorded.
- [ ] **No conflict** with an existing source-of-truth/ECR — or a conflict was raised as an **ECR**, not silently diverged.
- [ ] Provisional **pack choice confirmed or adjusted** in light of the mission.
- [ ] Project **registered/updated** in the Ecosystem layer.

## Proceed
- [ ] Discovery digest reflected into `project-context.md` (or it points to these three docs).
- [ ] **Gate cleared → begin roadmap, ADRs, and architecture** (`GETTING-STARTED.md §2`).

> If any box is unchecked, the project is **not ready to plan**. Finish discovery first — strategic clarity is cheaper now than a mis-aimed roadmap later.
