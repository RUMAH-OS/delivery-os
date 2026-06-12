---
name: discovery-interview
version: 1.0.0
stability: stable
description: >
  Conduct the Founder Discovery Interview and generate PROJECT-BRIEF, PROJECT-MISSION,
  NORTH-STAR from the answers (never assumptions). Invoke at the start of a new or
  inherited project, before any roadmap/ADR/architecture/code.
decision_class: none
required_lenses: []        # elicitation, not a decision — single-agent conduct (NO panel)
inputs:  [the founder (live), any ratified ecosystem context]
outputs: [docs/PROJECT-BRIEF.md, docs/PROJECT-MISSION.md, docs/NORTH-STAR.md]
---
# Discovery Interview

Promotes `delivery-os/discovery/FOUNDER-INTERVIEW.md` + `DISCOVERY-WORKFLOW.md` into a callable skill. **This skill POINTS to that conduct; it does not restate it.**

## When to use
A new or inherited repo, before planning. This is the project's **first responsibility**.

## Procedure
1. Conduct the interview exactly per `delivery-os/discovery/FOUNDER-INTERVIEW.md` — 4 parts; ask, **reflect back** a 3–5 line summary after each, correct before moving on; capture **verbatim** the elevator line, purpose, north star.
2. **Generate from answers, never assumptions.** Unknowns ship as `TBD — to confirm`, listed explicitly.
3. Draft `PROJECT-BRIEF` (Part 1) · `PROJECT-MISSION` (Part 2) · `NORTH-STAR` (Part 3); get founder approval on each.
4. Run `ecosystem-alignment-review` (Part 4 / step 6) before the gate.
5. Gate on `delivery-os/discovery/PROJECT-DISCOVERY-CHECKLIST.md`.

## Success criteria
- All 4 parts conducted + reflected back. Verbatim captured. Every claim traces to an answer; unknowns are `TBD`. Three docs founder-approved. No roadmap/ADR/architecture begins until the gate clears.

## Honest failure
If the founder can't answer, mark `TBD — to confirm` and list it — never invent. A weak "who is it for?" / "what is success?" must be probed (see the interview's depth rules), not smoothed.

## Low-confidence hand-off
If confidence in the load-bearing fields is low, push them with the interview's own depth rules (probe weak
answers up to 3×, then an honest classified `TBD`). *(v4: the adversarial `grill-me` follow-up was retired —
zero artifacts ever; see `skills/_archive/README.md` for its resurrection condition.)*

## Changelog
- 1.0.1 — v4: grill-me hand-off replaced by the in-skill depth rules (X2).
- 1.0.0 — promoted from `discovery/FOUNDER-INTERVIEW.md` + `DISCOVERY-WORKFLOW.md`.
