# Slice <id> — <title>

- **Phase:** <n> · **Size:** S | M | L · **Depends on:** <ids / —>

## Objective (end-to-end, demonstrable)
<the one outcome this slice delivers, exercisable by QA — e.g. "capture → store → display">

## Scope
- In: <…> · Out: <…> *(the Reviewer/Critic rejects anything beyond this)*

## Deliverables
- <code / endpoint / page / migration / agent + eval>

## Acceptance criteria (QA-owned; independent of the builder's tests)
1. <observable, testable> 2. <…> 3. <determinism / grounding / security where relevant>

## Definition of Done (this slice)
- [ ] Build gate green · [ ] commit(s) w/ hash · [ ] **ready-for-QA** (not "done")
- [ ] Independent QA PASS · [ ] Reviewer/Critic APPROVE (conformant · simple · in-scope)
- [ ] Domain review (design / SEO / security / **evals**) where applicable
- [ ] Migration reversible + applies-clean (if data) · [ ] runtime-verified
- [ ] Stakeholder acceptance · [ ] `project-log` + `STATUS` updated · [ ] human merge

## Notes / risks / de-risk
<deps, external creds, deterministic-spine-first ordering>
