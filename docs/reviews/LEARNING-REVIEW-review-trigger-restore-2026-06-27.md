---
event: "architecture-review"
date: "2026-06-27"
change: "Restore reliable auto Foundation/Founder/Learning trigger — close the framework-architecture marker hole"
triaged_by: "software-engineer (reconstructed from disk state + git + executed self-tests, not memory)"
milestone: "governance / review-trigger restoration"
---

# Learning Review — the trigger was blind to its own control plane

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Experience → routed capability.
> This is the L2 artifact for landing the review-trigger slice + fixing the founder-reported regression.

## 1. Reconstruct from artifacts (commits · VERIFY · ADR · self-tests)
- 2026-06-26: the review-trigger slice was built — it added integration/workflow/class-C L2 markers and made L2
  binding (three reviews or block). Verified by `docs/verify/VERIFY-review-trigger.md` (independent QA, VERIFIED).
- 2026-06-27: the founder reported "Foundation/Founder/Learning Review are no longer consistently triggered on
  significant architectural work." Reproduced against the pure `level({changedFiles})` the gate calls:
  `core/GOVERNANCE.md`→L1, `templates/tools/change-classify.mjs`→L1, `proposals/*`→L1, and the INSTALLED gate
  logic `.claude/tools/learning-trigger.mjs`→**L0** (change-classify class A, "auto-safe"). The trigger's markers
  were keyed entirely to consumer-app surfaces and matched none of the framework's own architecture.
- Fix: a `controlplane` L2 marker family + a named regression guard in both `learning-trigger.mjs` and
  `review-trigger.mjs` self-tests. Re-probe after fix: all six framework surfaces → L2; exemptions hold
  (`src/lib/util.ts`→L0, `Dashboard.tsx`→L1, a consumer app's own `src/core/`→L1, NOT swept in). All self-tests PASS.

## 2. Were any framework-level lessons discovered?
Yes — one structural lesson: **a self-hosted gate must include its OWN control plane in its trigger surface.** A
governance trigger authored to watch the product is blind to changes to the governance itself; the most consequential
edits (the constitution, the risk classifier, the trigger's own logic, the installed gate) were precisely the ones it
ignored — and an installed gate file even classified "auto-safe". The framework dogfoods its gate, so this was a live
hole, not a hypothetical.

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| Trigger surface must include the framework's own control plane | Delivery OS | classifier marker (`controlplane`) + lint/guard (self-test) | `templates/tools/learning-trigger.mjs` + `review-trigger.mjs` + ADR-003 addendum + GOVERNANCE §14 |
| The regression must be un-droppable | Delivery OS | guard (self-test assertions) | named `REGRESSION GUARD (2026-06-27)` blocks in two self-tests |
| Doctrine must name the new marker | Delivery OS | doctrine | `core/GOVERNANCE.md` §14, `docs/adr/ADR-003` |

## 4. Did any EXISTING capability fail to catch this?
Yes — the review-trigger capability itself (2026-06-26). It was designed to fire on architectural change but defined
"architectural" only over consumer-app paths, so it would not have fired on a change to its own classifier. It is
self-evident in retrospect that the gate that enforces reviews should treat *edits to itself* as review-worthy; it did
not. The new `controlplane` marker + guard is exactly the strengthened capability this review earns — and the guard is
how it stays earned.

## 5. Blast-radius fork
- **Project-local lessons** → implemented in this series: the `controlplane` marker, the regression guard, the doctrine
  reconciliation (§14 + ADR-003), the embedded-fallback extension.
- **OS-base / cross-system lessons** → the principle "a self-enforcing system must watch its own enforcement surface"
  generalizes to every consumer that installs the gate; captured here + in the ADR addendum. No separate
  `docs/feedback/OS-FEEDBACK` write needed — this IS the framework-base change, design-recorded in ADR-003.
</content>
