---
event: "architecture-review (cross-system OS assessment #84 + consolidated inheritance recommendation #85)"
date: "2026-06-12"
triaged_by: "v4.0 consolidation (founder-commissioned)"
---

# OS Feedback Triage — the #84 + #85 cross-system pair (carries the v4.0 translation ledger)

> Source pair: `property-lead-os/docs/reviews/cross-system-os-assessment.md` (#84, five blind lenses across
> PLOS · rumah-admin · delivery-os v3.8 · ecosystem-architecture · the agent-skills reference) and
> `property-lead-os/docs/reviews/consolidated-inheritance-recommendation.md` (#85, the reconciliation against
> rumah-admin's final state `43fcd53` — 126 lessons, all destined; contradiction rulings C1–C6; additions N1–N17).
> **#85 §A.3 is the translation ledger for the v4.0 cut.** This triage routes the *meta*-lessons the pair itself
> produced; the per-lesson routing IS the ledger and is not restated here (answers-or-points).

## 1. Were any framework-level lessons discovered this cycle?

Yes — lessons about the OS's learning system itself:
- **The inheritance loop was broken on disk** (the founder's objective #7 unmet by both consumers): zero feedback
  artifacts after v3.8, zero release tags, one consumer's harvest stranded in its overlay, the other's as prose.
  A project scaffolded that afternoon inherited none of the month's learning.
- **§14's trigger never fired in the field** because it keys on release tags that trunk-based continuous projects
  never create → the review-artifact detector + N-merges backstop (B15; dial signed F7 = hard-block).
- **Overlays minting version labels breaks rollback itself** (`v4.0-skills-first` was a router string with no tag
  behind it — nothing to roll back from or to) → version-namespace rule, F1.
- **A packaging conversion is unproven until it fires on real work** (N1): the skills-first conversion was its
  repo's final commit; "~3 hours faster" is a projection, not a measurement. The content is earned; the packaging
  is the experiment, tested at the named adoption moments.
- **A learning-review skill can codify the very bypass it should prevent** (C1: "implement in the same series"
  applied to OS-level lessons) → the blast-radius fork is written INTO the promoted skill (F8).
- **Format drift exists even without a fork** (C6: three frontmatter dialects inside one repo) → fail-closed
  `validate-skills` lint, exemptions in the validator (B37).
- **The union rule is the anti-loss mechanism**: convergent twins (verification, contracts, learning-review,
  ratification grammar) merge at technique level with `earned_from` per technique — taking either side alone
  silently discards half the doctrine while appearing to satisfy the no-discard rule.
- **Three mutually-corrective models**: our OS contributes enforcement, the sibling consumer contributes earned
  executable content + provenance, the reference contributes body anatomy + format CI (#84 §C verdicts).

## 2. Are there any OS Candidates?

The entire #85 §A.3 table (126 rows: 31 KERNEL + 38 BASE + 12 TEMPLATE + 19 SKILL + 14 PROJECT + 12 archive-with-pointer).
Every row is destined; an unmapped row is a defect that blocks the v4.0 merge.

## 3. Routing — for each lesson, where does it belong?

| Lesson | Layer | Why | Destination |
|---|---|---|---|
| The full classification (K1–K31, B1–B38, T1–T12, S1–S19, X1–X12) | Delivery OS | per-row adjudication in #85 §A.3 (the ledger) | the v4.0 file-level update list (#85 §B.1) — executed on branch `v4.0-consolidation`; row→file mapping in `CHANGELOG-v4.md` |
| M1–M14 project rows | Project | project nouns / pre-registration freeze | stay in their repos' project memory; never enter the clean-room framework |
| X5–X7 archive dispositions | Project | superseded project docs | execute project-side (citation-sweep), out of base scope |
| Version identity, adoption moments, ratification form, decision dialect, wiki, detector dial, retro default | Founder | genuine founder calls | **SIGNED:** F1 (base owns the namespace; real v4.0 cut; adoption = PLOS at learning-review gate fire, Admin at June invoicing completion) · F2 (one consolidated ratification over the packet; per-promotion evidence in the changelog; the independent verification of this branch is that check) · F3 (ledger-fronts-both, Admin's status grammar) · F6 (wiki retired, archive-with-pointer + case study) · F7 (hard-block) · F8 (lightweight learning-review default WITH the C1 fork). F4/F5 remain open project-side obligations (events-v1 contract; durability execution) — tracked in the PLOS #76 P0 ledger, not dischargeable from base. |

## 4. Promotions proposed (each runs a scaled Principle-11 panel before it lands)

One consolidated ratification over the whole v4.0 packet (F2, amending §14's per-promotion letter for batches;
precedent recorded in GOVERNANCE §14). The packet = `CHANGELOG-v4.md` (per-promotion earning evidence +
the row→file translation ledger) + this triage + the two retroactive consumer triages. Conditions:
`check-no-backflow.mjs` green · `validate-skills.mjs` green · an unmapped #85 row rejects the release ·
the verifier of the packet is not its author.
