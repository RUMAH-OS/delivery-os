---
kind: learning
as_of: 2026-06-10
stability: current
---

# Documented ≠ Enforced

The most load-bearing lesson so far (origin: the Slice-1.0 failure, see [[2026-06-10-author-verifier-not-operationalized]]). A control that depends on a person *remembering* to run it is a hope, not a control. A principle is real only when a mechanism — not memory — fires it.

**Proven on the framework itself (Step 3, 2026-06-10):** the verify-gate, standing up in `delivery-os/.claude/`, caught a *real* change to `templates/hooks/verify-gate.mjs` with no independent VERIFY artifact and blocked both the Stop and the commit — without anyone choosing to invoke it. Evidence: `docs/verify/VERIFY-step3-dogfood.md`.

**How to apply:** before claiming any control exists, run it against a real violation and capture the block. If it only fires when invoked by hand, it is documentation, not enforcement.
