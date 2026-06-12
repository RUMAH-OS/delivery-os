---
name: write-back-gate
version: 1.0.0
stability: stable
description: >
  Canonical reconciliation as done-ness: a slice that falsifies a binding decision/spec is not done until
  the amendment ships in the same PR; a proposal is not adopted until its registry/ledger obligations are
  committed or carried as dated IOUs. Invoke at every slice merge and proposal adoption — DoD row 7 is the
  enforcement surface; this skill is its procedure.
decision_class: governance
inputs:  [the diff, the binding decisions/specs/registry rows it touches or contradicts]
outputs: [dated amendments in the same PR (or dated IOUs in DECISIONS.md), or a blocked merge]
earned_from: "Consumer P: an architecture spec's sections 1–3,6,8,10 were fiction within a week of approval and stood unamended while the router named the spec canonical (a fresh agent would have planned against machinery that never ran — incident 5's in-repo twin); a panel's nine ordered registry amendments were verified unexecuted; the retro's OWN P0 obligations sat undischarged while the next review was drawn. The doc-rule demonstrably fails; only a gate holds."
mechanical_spine: "DoD row 7 (the merge refuses without the amendment/IOU); the skill graduated FROM a doc rule TO a gate per the record's own structural law (#76: anything that must fire becomes a hook)"
---
# Write-Back Gate

## Overview
Specs that survive their own falsification are the in-repo form of the stale-registry incident: the next
reader plans against fiction. Reconciliation is therefore part of DONE, not a follow-up.

## When to use (and NOT)
- Use when: merging any slice; adopting any proposal/panel verdict; closing any friction fix that changed behavior a doc describes.
- **NOT** for: routine doc updates with no falsified canon (normal write-back step in the loop).

## Process
1. **Diff against canon**: list every binding decision, spec section, contract, or registry row the change
   contradicts or supersedes.
2. **Amend in the same PR**: a dated superseding note in the canonical doc (never a silent rewrite of
   history), plus the `DECISIONS.md` row where a decision changed.
3. **Or carry a dated IOU**: when the amendment is genuinely larger than the slice, a dated, owned IOU row in
   `DECISIONS.md` — visible debt, not forgotten debt.
4. **Proposals discharge their obligations**: a panel/proposal's ordered amendments are part of its
   done-ness; adoption without them is blocked.
5. **Routers re-render**: derived sections refresh in the same change (render-kernel); the canonical pointer
   never names a superseded doc as current.

## Red flags
- "The spec is aspirational" — then mark it superseded with a date; an unmarked fiction is a trap.
- IOUs without dates or owners (that is how nine amendments went unexecuted).
- A merged slice whose VERIFY shows behavior the architecture doc says is impossible.

## Verification (of this skill's own output)
- `git show` of the merge contains the amendment/IOU alongside the implementation.
- The canonical doc's superseded sections carry dated markers a grep can find.

## Changelog
- 1.0.0 — promoted from consumer P's harvest (#76 §8.1) and graduated from doc-rule to DoD gate (B19/X4-meta).
