---
name: principle-11-review
version: 2.0.0
stability: stable
description: >
  Run an independent multi-lens (blind-design-panel) review of a CONSEQUENTIAL decision — architectural,
  migration, production-readiness (incl. go-live at a named cutover), security-sensitive, or data-sensitive.
  Lenses work BLIND, sized by decision class, with a refusal rule and a one-screen verdict. Invoke BEFORE
  issuing any recommendation on a consequential decision, or via /panel <class>.
decision_class: architecture | migration | production-readiness | security | data
required_lenses: [lead-architect, reviewer-critic]   # minimum: ≥2 independent lenses + Reviewer/Critic; cap by class (§11 economics)
inputs:  [the decision + its options VERBATIM, the decision class, the evidence files, docs/gates.md (mandatory pre-read), docs/DECISIONS.md (duplicate-ask check)]
outputs: [docs/DECISION-REVIEW-<date>-<topic>.md — one-screen verdict first + signature sheet + dissents + any registry-amendment obligations]
earned_from: "~13 real panel runs across two consumers, 2026-06 (the as-practiced procedure had shadow-forked far past the 1.0.0 file: lens rosters, vote/dissent grammar, signature sheets all evolved in the field while the skill froze — the named exhibit for bump-or-declare). Economics earned by incident 7 (~75 lens-runs : 8 founder replies) and the falsification record (13 lens-runs reversed by one founder morning). Panels were at their BEST refusing work — pre-committed kills, struck APIs, gates re-affirmed."
mechanical_spine: "/panel <class> command; the DECISION-REVIEW artifact is the §13 mechanism-eligible shell; gates.md pre-read enforced by the refusal rule; DoD/§11 two-lens floor is inherited and non-swappable"
---
# Principle-11 Review (v2.0 — the blind-design-panel, as practiced)

The callable form of Governance §11 with the v4 panel economics. It does not *expand when* review is
required — it makes the *required* review honest, sized, and cheap to consume.

## When to use (and NOT)
Any §11-class decision (`core/GOVERNANCE.md §11`). If unsure whether a decision is consequential → run it,
small. **Production-readiness is a decision class of THIS skill** (the standalone readiness skill is folded
in — X3): a declared cutover moment (Operating Loop standing beat) triggers a readiness-class panel over
`templates/release-readiness.md` + the active pack checklists.
**NOT** for: behavioral/daily-experience questions — panels lock **invariants + pre-registered reversals
only**; the friction log settles behavior (13 blind lens-runs once locked a placement that one real founder
morning reversed).

## Procedure
1. **Classify and size**: decision class ∩ active packs → lenses. **Cap by class**: irreversible / cross-repo /
   money / data / cutover → 5–6 max (same-model saturation arrives there; 14/14 unanimity is repetition, not
   coverage); reversible-in-one-change → 2–3 or none. **Cross-model second opinion**: an option on the
   irreversible class only.
2. **Pre-reads, mandatory**: `docs/gates.md` — **refusal rule**: inputs below their own pre-registered gates ⇒
   the panel REFUSES and emits a design-doc-only note. `docs/DECISIONS.md` — a duplicate ask is returned with
   the prior row, not re-paneled.
3. **Each lens works BLIND** — no shared draft, no anchoring; the orchestrator points, never pre-concludes.
4. **Vote/dissent grammar (as practiced)**: each lens records vote · confidence · its single strongest
   objection. **Surface every disagreement; never smooth** — a buried dissent is a process failure.
5. **Bounded loop**: at most **3 challenge cycles** (Reviewer/Critic adversarial pass included), then
   consolidate — endless re-paneling is incident 7 in slow motion.
6. **Consolidate**: `DECISION-REVIEW-<date>-<topic>.md` — **one-screen verdict FIRST** (verdict · what it
   locks · the pre-registered reversal · the signature table), analysis after. **Ratification grammar**: the
   verdict line is checkbox-signable (see `decision-ratification`); the signed outcome lands as a
   `DECISIONS.md` row.
7. **Obligations are part of done-ness**: any registry/spec amendments the verdict orders are listed and
   discharged per the write-back gate (a panel's nine ordered amendments once went entirely unexecuted).
8. **The human merge gate decides.** The panel informs; it never replaces stakeholder approval.

## Red flags
- A panel commissioned while a prior panel's signatures are pending.
- Lens count sold as rigor (independence, not volume, is the point).
- A behavioral prediction in the verdict (lock the invariant + the reversal; let operation decide).
- A "panel" whose lenses could not actually run independently — say so; mark it non-independent (§11 exists
  for independent viewpoints, not the look of rigor).

## Verification (of this skill's own output)
- ≥2 independent lens findings + Reviewer/Critic recorded · every dissent visible · author ≠ consolidator ·
  the one-screen verdict exists and is signable · gates.md pre-read cited (or the refusal issued).

## Changelog
- 2.0.0 — v4: as-practiced procedure merged in (roster-by-class, vote/dissent grammar, gate-ledger pre-read,
  one-screen verdict, refusal rule, bounded 3-cycle loop, cross-model option on irreversibles, ratification
  grammar); production-readiness folded in as a decision class triggered by the named-cutover rule (B12/X3);
  panel economics per §11 (B10/B11). Alias: **blind-design-panel** (directory name kept — three repos route
  to `principle-11-review` by literal string; same T10 logic as core/).
- 1.0.0 — extracted from `core/GOVERNANCE.md §11` + the reusable panel prompt.
