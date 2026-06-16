---
kuId: ku-implemented-is-not-operationally-proven
title: Implemented is not operationally proven — a capability counts only when used in production on real data, observed
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A slice-PASS, a test-DB verification, or a ship-to-dev is NOT operational proof; a capability is proven only when a real founder/user workflow has RUN it in production on real data and the run is OBSERVABLE — so 'built/verified/shipped' must never be reported as 'done', and a frontier must not be opened on a substrate whose use has never been witnessed in prod."
triggers:
  - "is this capability actually proven"
  - "is this done because it's built"
  - "slice passed so is it complete"
  - "shipped to dev — is it operationally proven"
  - "can we open the next frontier on this"
  - "did this run in production on real data"
  - "implemented but not used"
  - "built vs operationally used"
  - "is this convergence build-convergence or operational"
topics:
  - implemented-is-not-operationally-proven
  - operational-proof-on-real-data
  - build-status-vs-operational-status
  - prod-observability-of-use
  - frontier-readiness
  - dev-ship-is-not-use
evidence-strength: runtime-evidenced
cited-quote: "production on real data, ownership functions, founder workflows are real"
source-provenance:
  earned-from: "Operational Readiness Assessment 2026-06-16 (PLOS↔Admin command-seam frontier challenge)"
  source-file: "../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md"
  anchor: "Header standard (lines 3-6); VERDICT (lines 8-15); §1 PROVEN vs assumed (lines 17-22); §3 implemented-but-not-op-proven list (lines 38-56); §5 the actual next frontier (lines 64-68)"
  signal-pattern: null
related:
  - ku-verify-seam-by-one-real-round-trip
  - ku-record-only-state-the-action-achieved
  - ku-author-not-equal-verifier
  - ku-fail-closed-gates
  - ku-injection-is-not-adoption
tags: [operational-readiness, operational-proof, build-vs-used, prod-data, observability, frontier-gate, completeness]
---

# Implemented is not operationally proven — proven means used in production on real data, observed

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A slice that PASSES, a capability VERIFIED against a test database, or code SHIPPED to a
dev/staging environment is **not** operational proof. The standard is exact — a capability is not complete
because it EXISTS; the source demands proof it is USED in

> production on real data, ownership functions, founder workflows are real

A capability is proven only when a real founder/user workflow has actually **run it in production on real
data**, and that run is **observable** (recorded, re-findable). Until then it is *implemented*, not *proven* —
and "built / verified / shipped-to-dev" must never be reported as "done."

**Why (the non-obvious reason).** Build status and operational status *feel* identical from the inside: the
code exists, the test was green, the slice gate passed, so it reads as finished. But every one of those
signals lives on synthetic or pre-production ground — a test DB, a dev deploy, a gate that asserts the code
is shaped right. None of them witnesses the capability surviving contact with production reality: real data
volume, real config (secrets actually set), real side-effects reaching the outside world, a real human
completing the workflow. The classic detonation is a capability that "sends" — the gate passes, the code
path runs, yet the delivery-provider credential is unset in prod so the send call silently no-ops and *nothing
reaches a user*.
The danger compounds when a team concludes "the next frontier is X" from BUILD-convergence rather than
OPERATIONAL-convergence: they stack a new frontier on a substrate that has **never run in production**, so
the unproven base is now load-bearing and the first real use detonates two layers deep instead of one.

**How to apply (domain-stripped, reusable).**
1. **Separate Built from Operationally-Used, per capability.** Maintain an honest two-column view: *Built*
   (code + test + gate) vs *Operationally used in PROD on real data* (a real workflow ran it, observably).
   "Shipped to dev" lands in the Built column, never the Used column. A gate is not real use.
2. **Require an observable production run on real data before "proven."** The proof is a witnessed run: real
   secrets set, real records touched, a real side-effect reaching the outside world, captured in a log/audit
   you can re-find. If nothing records the run, you cannot prove use — production-usage observability is a
   precondition, not a nicety.
3. **Gate frontier-opening on operational status, not build status.** Before declaring done, relying on a
   capability, or opening the next frontier on top of it, ask whether the substrate it depends on has itself
   run in production. Do not stack a frontier on an unproven base.
4. **State "implemented but not operationally proven" honestly.** Keep a standing, explicit list of what is
   built-and-dev-verified but never run in prod. Naming it prevents build-convergence from masquerading as
   operational readiness.

**The test for any "this is done / this is the next frontier" claim.** Ask: *"has a real workflow RUN this
in production on real data, and can I re-find the record of that run?"* If the only evidence is a passing
slice, a test-DB verification, or a dev deploy, it is implemented — not operationally proven. Concluding
done/frontier-ready from build status is the exact error this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** In the 2026-06-16 Operational Readiness Assessment,
two systems both concluded "the command seam is the next frontier" from BUILD status, not OPERATIONAL status —
the exact error the standard warns against. The honest split: the production cutover (real owners/properties/
tenants/contracts/invoices/payments, reconciliation exact) and the read/truth seam answering correctly on
real data WERE operationally proven; but email delivery (secret unset → send no-ops, the founder's #1 pain
unproven end-to-end), scheduled reminders (no scheduler — every cron a "later" comment), native signature
capture (zero post-cutover), the cross-system read seam (consumer wired to `localhost`, loop idle/stale
~594m — never run prod→prod), and all of that session's dev-shipped work were implemented-but-NOT-operationally-
proven. The real next frontier was OPERATIONAL VALIDATION ("make it real"), not a new write-path frontier on
an unvalidated read substrate.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the Founder-OS-level
Operational Readiness Assessment, which STAYS as the detailed source:
`../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md` — the header standard
("OPERATIONAL evidence, not implementation status"), the VERDICT ("concluded from BUILD status, not
OPERATIONAL status — the exact error the standard warns against"), §1 (PROVEN-on-real-prod-data vs assumed),
§3 (the honest implemented-but-not-operationally-proven list), and §5 (operational validation as the actual
next frontier). Companion canon: `../delivery-os/capabilities/V6-LANDED-DEFINITION.md`'s COMPLETENESS
PRINCIPLE ("a capability is NOT complete because it EXISTS … Build → Proved → Reachable → Continuable →
Founder-verifiable → Used successfully in a real workflow"). This KU is the retrievable distilled form; the
capability docs are preserved, not replaced.
