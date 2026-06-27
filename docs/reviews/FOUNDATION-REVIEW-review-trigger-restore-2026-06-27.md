---
review: foundation
date: 2026-06-27
change: "Restore reliable auto Foundation/Founder/Learning trigger — land the review-trigger slice + close the framework-architecture marker hole (controlplane L2 marker + regression guard), ADR-003 L2"
author: software-engineer (implementing engineer agent — authored this change)
reviewer: reviewer-critic + lead-architect (blind, independent lenses — NOT the author; consolidated)
verdict: STABLE — build on it
lenses: "reviewer-critic (internal consistency / contradictions) + lead-architect (forward structural gaps), run blind + in parallel, then consolidated"
---

# Foundation Review — restore reliable auto review-trigger + framework-architecture marker

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2): this push edits the control plane
> (`templates/tools/learning-trigger.mjs`, `review-trigger.mjs`, `core/GOVERNANCE.md`, `docs/adr/ADR-003`) — L2
> by definition. Question: **are the foundations this change builds on still internally consistent + valid?**

## Foundation set reviewed
- `templates/tools/learning-trigger.mjs` (the 3-level classifier — the MARKERS data map + the L2 logic)
- `templates/tools/change-classify.mjs` (the composed risk classifier — read, deliberately UNCHANGED)
- `templates/tools/review-trigger.mjs` + `.claude/tools/review-trigger.mjs` (the fail-closed detector + embedded fallback)
- `.claude/hooks/verify-gate.mjs` (the pre-push wiring), `.claude/.verify-config.json` (`review_trigger: enforce`)
- `core/GOVERNANCE.md` §14, `docs/adr/ADR-003-learning-review.md` (the doctrine the code must match)

## VERDICT: STABLE — build on it
- **Consistency (reviewer-critic):** Coherent. The fix is purely **additive** — a new `controlplane` family in the
  data-driven `MARKERS` map plus one `anyPathHits` check alongside the existing integration/workflow checks; the
  L2-wins ordering, the L1/L0 paths, and the fail-toward-review invariant are untouched. The change-classify risk
  classifier was deliberately **not** widened (a `core/**`-is-class-C edit there would have changed auto-merge
  eligibility repo-wide — out of scope and a larger blast radius); the architectural-significance signal lives only
  in the learning/review trigger, which is the correct single home. GOVERNANCE §14 + ADR-003 were updated in the
  same push so doctrine and code agree (no one-source-of-truth drift). All four self-tests pass.
- **Forward gaps (lead-architect):** No structural gap introduced. Two pre-existing fragilities are surfaced, not
  smoothed: (1) **self-install lag** — `.claude/tools/learning-trigger.mjs` is absent, so the detector's `loadLevel`
  falls through to the canonical `templates/tools/` copy; this works and is the intended defensive fall-through, but
  the day an installed copy reappears stale it would silently shadow the fix. The new `controlplane` marker now makes
  any edit to that installed copy itself L2 (it was class A → L0 before), which is the right direction. (2) The §12
  honest limit is unchanged — the gate proves an artifact exists + is fresh + author-distinct, not that it is truthful.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should | The trigger was consumer-app-shaped and blind to the framework's own control plane (the regression). | FIXED — `controlplane` marker (`core/**`·`proposals/**`·gate/classifier/trigger tooling) + named regression guard in two self-tests. |
| F2 | Nice | Self-install lag: installed `.claude/tools/learning-trigger.mjs` absent; relies on fall-through. | Noted (pre-existing); now itself L2 if it returns stale. Re-sync is the standing CHANGELOG-v4 "Honest notes" item. |
| F3 | Nice | Gate cannot prove a review is non-vacuous (§12 honest limit). | Disclosed in VERIFY OBS-1 + ADR-003; freshness + attestation raise the cost; remains human/governance. |

## Conclusion
The foundations are **stable** to build on. The fix is additive, the doctrine matches the code, the exemptions
(bug-fix/UI/trivial stay below L2) are preserved and guarded, and the one residual is the known self-install lag,
surfaced not hidden. No redesign required.
</content>
</invoke>
