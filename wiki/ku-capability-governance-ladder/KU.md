---
kuId: ku-capability-governance-ladder
title: The capability governance ladder — exists → reachable → validated → observable → trusted → enabled
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "Any autonomous capability advances through a fixed enablement ladder — exists → reachable → validated → observable → trusted → enabled — and may climb only ONE rung at a time, only on evidence. Enablement is the LAST rung, gated on operational trust + observability; a capability that merely exists is on rung 1, not eligible for autonomous use. This ladder ('may it be ENABLED for autonomy?') is distinct from the completeness ladder Build→Proved→Reachable→Continuable→Founder-verifiable→Used ('is it DONE?'): a capability can be complete yet not enabled, and must not be enabled until it is trusted and observable."
triggers:
  - "what is the capability governance ladder"
  - "what rung is this capability on"
  - "can this capability advance / be enabled"
  - "is this trusted enough to enable"
  - "exists vs reachable vs validated vs trusted"
  - "completeness ladder vs enablement ladder"
  - "what's the standard enablement sequence"
  - "is enablement the last step"
  - "can we skip a rung"
topics:
  - capability-governance-ladder
  - enablement-rung-sequence
  - one-rung-at-a-time-on-evidence
  - enablement-vs-completeness-ladder
  - trusted-and-observable-before-enabled
evidence-strength: runtime-evidenced
cited-quote: "exists → reachable → validated → observable → trusted → enabled"
source-provenance:
  earned-from: "Founder directive 2026-06-17 (capability governance): the standard enablement ladder for any autonomous capability"
  source-file: "../delivery-os/capabilities/CAPABILITY-GOVERNANCE-LADDER.md"
  anchor: "Founder directive 2026-06-17 (the six-rung ladder + 'enablement is the LAST rung, gated on operational trust + observability'); recorded in delivery-os canon CAPABILITY-GOVERNANCE-LADDER.md"
  signal-pattern: null
  ratification-note: "Canon source CAPABILITY-GOVERNANCE-LADDER.md is Status: ratified-pending (DRAFT until ratified; founder holds the merge gate) — so this KU is held at runtime-evidenced, NOT founder-ratified. Promote to founder-ratified when the founder ratifies CAPABILITY-GOVERNANCE-LADDER."
related:
  - ku-enable-capabilities-on-trust-not-existence
  - ku-implemented-is-not-operationally-proven
tags: [governance, enablement-ladder, autonomy, capability-gate, completeness, founder-os]
---

# The capability governance ladder — exists → reachable → validated → observable → trusted → enabled

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** Every autonomous capability climbs a fixed, ordered ladder of enablement rungs:

> exists → reachable → validated → observable → trusted → enabled

A capability advances **one rung at a time, only on evidence**. **Enablement is the LAST rung**, gated on
operational trust **and** observability — so a capability that merely *exists* sits on rung 1 and is not
eligible for autonomous use no matter how finished the code looks.

**The rungs (domain-neutral).**
1. **exists** — the capability is built; code + tests exist. (Shape only.)
2. **reachable** — something can actually invoke it through a real surface (a seam/CLI/agent can call it; it is
   not dead code behind a door).
3. **validated** — it passes its validation ladder: independent verification (author≠verifier), the right gates
   green, correct on its claims.
4. **observable** — its runs are recorded and re-findable: outcome, events, errors are surfaced. (You can SEE
   it work, and see it fail.)
5. **trusted** — it has accrued operational trust: run on real data, safeguards *enforced* (verified approver,
   audit, idempotency, reversibility), no outstanding critical risk.
6. **enabled** — and ONLY now is it turned on for autonomous use, as a deliberate gated act.

**Why (the non-obvious reason).** Without an explicit ladder, teams collapse all six rungs into "it's built"
and jump from rung 1 to rung 6 — enabling on existence, the exact error `ku-enable-capabilities-on-trust-
not-existence` names. The ladder's value is that it makes the *missing* rung visible: a capability is usually
*validated* but not *observable*, or *observable* but not yet *trusted* (never run on real data, safeguards
declared-not-enforced). Naming the rung it is actually on turns "should we enable it?" into "which rung is it
on, and what evidence advances it?" — a falsifiable question instead of a vibe. Skipping a rung is how
build-convergence masquerades as readiness.

**Distinct from the completeness ladder (do not conflate).** The completeness ladder —
**Build → Proved → Reachable → Continuable → Founder-verifiable → Used** — answers *"is it DONE?"* (is this a
finished, usable workflow). This governance ladder answers a different question: *"may it be ENABLED for
autonomy?"* The two are orthogonal: a capability can be **complete** (a founder can use it end-to-end by hand)
yet **not enabled** for the platform to run autonomously — because completeness does not by itself establish the
operational trust + observability that enablement requires. Use the completeness ladder to decide *done*; use
this ladder to decide *turn it on for autonomous execution*.

**How to apply (reusable).**
1. **Place every capability on a rung, explicitly.** Track which rung each autonomous capability is on; "built"
   is rung 1, not rung 6.
2. **Advance one rung at a time, on named evidence.** To move up, cite the evidence for the next rung (a real
   reachable surface; an independent verify; an observability record; a real-data run with enforced
   safeguards). No evidence → no advance.
3. **Treat enablement as a separate, last decision.** Never enable as a side-effect of validating or shipping.
   Enable only after *observable* + *trusted*, as a deliberate gated act.
4. **Run both ladders for autonomous capabilities.** Completeness decides DONE; this ladder decides ENABLED.
   A capability needs the right answer on each — and they can legitimately differ.

**The test.** Ask: *"which rung is this capability actually on, what evidence would advance it one rung, and
is enablement (rung 6) being claimed before observable+trusted (rungs 4–5) are evidenced?"* Any jump that
skips a rung, or any enable justified by "it exists," violates the ladder.

**Runtime evidence anchor (the load-bearing instance).** In the 2026-06-17 controlled-execution review the
platform's invoke path *existed* and the consumption loop was *validated* and *observable* (describe-only,
honest traces) — but it had not reached *trusted* (presence-only approver, sideEffect-honesty declared not
enforced, never run on a real intent). The correct verdict was to hold at the current rung and NOT jump to
*enabled* (live execution). The ladder is exactly what makes that a principled, repeatable call rather than a
one-off judgement.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the founder's 2026-06-17
capability-governance directive (the six-rung ladder), recorded in delivery-os canon
`../capabilities/CAPABILITY-GOVERNANCE-LADDER.md`, which STAYS as the home of the pattern. The completeness
ladder it is distinguished from lives in `../capabilities/V6-LANDED-DEFINITION.md` (the COMPLETENESS
PRINCIPLE) and `completeness-principle-workflow-validation` memory. Sibling: `ku-enable-capabilities-on-trust-
not-existence` (the headline principle this ladder operationalizes). This KU is the retrievable distilled form;
the canon docs are preserved, not replaced.
