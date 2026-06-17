---
kuId: ku-first-real-use-surfaces-invisible-gaps
title: First real use surfaces missing capability and missing data that were invisible at design time
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A capability is not proven until it is USED, and the FIRST real use predictably surfaces gaps that no amount of design or build could see — missing capability (the right thing to do does not exist) and missing data (the inputs needed to act are absent), both invisible at design time because design reasons over the intended path while real use exercises the actual one. Therefore: schedule a first real-use run early and treat the gaps it exposes as expected discoveries, not as a sign the work was wrong."
triggers:
  - "is this capability proven without using it"
  - "why did first use break / surface so much"
  - "what does first real use tell us"
  - "missing capability vs missing data"
  - "gaps invisible at design time"
  - "should we run it for real before declaring done"
  - "first time a workflow ran on real intents"
topics:
  - first-real-use-surfaces-gaps
  - missing-capability-and-missing-data
  - design-time-blind-spots
  - use-before-proven
  - first-run-as-discovery
evidence-strength: runtime-evidenced
cited-quote: "pain (re-send the 2 in-flight signings) has no first-class capability to consume"
source-provenance:
  earned-from: "First real-intent consumption run, 2026-06-17 — 'send the June overdue invoices' / 're-send the two in-flight signings' exposed a wrong-cap selection, a missing signing-resend capability, and a recipient-resolution data gap"
  source-file: "../rumah-admin/docs/verify/VERIFY-consumption-real-intents-2026-06-17.md"
  anchor: "Trace 1 (#1-pain invoice send mis-selects a generic mailer), Trace 2 ('no first-class capability to consume' — line 103), GAP-1/GAP-2/GAP-3 in the Honest-gaps section; 'Used: NO … this is the first real-intent exercise' (line 182)"
  signal-pattern: null
related:
  - ku-real-usage-gaps-outrank-design-assumptions
  - ku-implemented-is-not-operationally-proven
  - ku-founder-discovered-failures-become-monitored-health-checks
tags: [first-use, real-usage, missing-capability, missing-data, design-blind-spot, founder-os]
---

# First real use surfaces missing capability and missing data invisible at design time

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A capability is **not proven until it is USED**, and the **first real use** predictably
exposes two classes of gap that design and build could not see:
- **missing capability** — the right action to take *does not exist* in the catalog/system; and
- **missing data** — the inputs needed to act (e.g. who the recipient is) are *absent or unresolved*.

A real first-use run, e.g. on the founder's own intent, surfaced exactly this:

> pain (re-send the 2 in-flight signings) has no first-class capability to consume

**Why (the non-obvious reason).** Design reasons over the *intended* path — the happy route someone imagined —
while real use exercises the *actual* path a real intent takes through real data. The two diverge precisely
where assumptions were silent: design assumes "there's a send capability" and never asks "is there a *signing-
resend* capability?"; design assumes "we have the recipient" and never asks "is the recipient *resolvable* from
the data we actually hold?". These are not bugs in the build — they are blind spots that are *only* visible once
a concrete real intent forces the system to find a capability and the data to run it. That is why "built and
verified" can read as done while the very first real use immediately hits "there is nothing here that does
this" or "I don't have what I need to do it." First use is a discovery instrument, not a victory lap.

**How to apply (reusable).**
1. **Treat USED as a distinct rung from built/verified.** Do not report a capability as proven on build or
   test evidence; require a real first-use run on a real intent. (Pairs with the enablement ladder's *trusted*
   rung and the completeness ladder's *Used* stage.)
2. **Schedule a first real-use run early and cheaply.** Run the workflow once on a genuine intent as soon as
   possible — describe-only / dry-run is fine — specifically to flush out missing-capability and missing-data
   gaps before they are load-bearing.
3. **Expect, classify, and capture the two gap types.** When first use exposes a gap, label it *missing
   capability* (build/route the missing thing) or *missing data* (resolve the absent input / add the
   resolution step), and promote it — do not treat the gaps as evidence the work was wrong.
4. **Don't stack the next frontier on an un-used substrate.** If a capability has never had a first real use,
   anything built on top of it inherits its undiscovered gaps.

**The test.** Ask: *"has a real intent actually been RUN through this capability, and did that run flush the
missing-capability and missing-data gaps — or am I calling it proven on build/test evidence with no first
use?"* Reporting proven without a real first-use run violates the rule.

**Runtime evidence anchor (the load-bearing instance — Rumah Admin).** The first real-intent consumption run
(2026-06-17, describe-only) on the founder's queue exposed, on the very first contact: a **wrong-capability
selection** ("send the June overdue invoices" mis-selected a generic mailer over the purpose-built invoice
send — DEFECT-CONSUME-1), a **missing capability** ("re-send the two in-flight signings" maps to nothing
first-class — "has no first-class capability to consume", line 103 / GAP-2), and a **data gap** (recipient
resolution — empty/unresolved tenant email, the duplicate-billing cluster's "empty tenantEmail, never
deliverable"). The verify's own completeness row records **Used: NO … this is the first real-intent exercise.**
None of these were visible in design or build; all three were visible on first real use.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the first real-intent run in
`../docs/verify/VERIFY-consumption-real-intents-2026-06-17.md` (Traces 1–2, the Honest-gaps GAP-1/2/3, and the
completeness "Used: NO" row), which STAYS as the detailed source. Sibling: `ku-real-usage-gaps-outrank-design-
assumptions` (the same run as an evidence-ranking rule). This KU is the retrievable distilled form; the verify
report is preserved, not replaced.
