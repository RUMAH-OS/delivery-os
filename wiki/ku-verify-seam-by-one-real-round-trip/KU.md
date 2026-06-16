---
kuId: ku-verify-seam-by-one-real-round-trip
title: A cross-system seam is proven by ONE real round-trip, not by two isolated half-verifies that each pass
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A cross-system seam is proven ONLY by one real producer→drain→consumer handshake on real data; verifying each side in isolation (a green producer test plus a green consumer test) does NOT prove the seam, because a mismatch in the shared contract survives BOTH isolated verifies — each side passes against its own mirror of the contract while disagreeing with the other."
triggers:
  - "is this seam proven"
  - "how do I verify a cross-system seam"
  - "producer passed and consumer passed — are we good"
  - "two green verifies on each side of the seam"
  - "did the round trip actually happen"
  - "field-name mismatch across the seam"
  - "is the contract single-sourced or mirrored both sides"
  - "events drain into a void"
  - "verify integration end to end"
topics:
  - verify-seam-by-one-real-round-trip
  - producer-drain-consumer-handshake
  - isolated-half-verify-is-insufficient
  - single-sourced-contract
  - drain-into-a-void
  - cross-system-contract-binding
evidence-strength: runtime-evidenced
cited-quote: "class past two green VERIFYs"
source-provenance:
  earned-from: "Operational Readiness Assessment 2026-06-16 (pdfRef incident; read-seam never run prod→prod; invoice.credited drains into a void)"
  source-file: "../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md"
  anchor: "§4 (lines 57-62, the pdfRef detonation past two green VERIFYs); §3 items 5-7 (lines 45-51, read seam never prod→prod, contract single-sourced one side, invoice.credited drains into a void); Lessons propagated (lines 94-97)"
  signal-pattern: null
related:
  - ku-implemented-is-not-operationally-proven
  - ku-author-not-equal-verifier
  - ku-fail-closed-gates
tags: [seam, integration, round-trip, contract, producer-consumer, cross-system, verification]
---

# A seam is proven by ONE real round-trip — not by two isolated half-verifies that each pass

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A cross-system seam (an API contract, an event stream, a handoff between two systems)
is proven ONLY by **one real producer→drain→consumer handshake on real data** — the producer emits, it
traverses the actual transport, the consumer receives and acts, end to end. Verifying each side *in
isolation* — a green producer test plus a green consumer test — does **NOT** prove the seam. The source
records a real field-name-mismatch incident that survived two independent green verifications:

> class past two green VERIFYs

A contract mismatch survives BOTH isolated verifies, because each side passes against *its own mirror* of the
contract while silently disagreeing with the other side. Two greens on two halves is not one green on the
whole.

**Why (the non-obvious reason).** Isolated verification is seductive because it is *easy and it passes*: each
team tests against its own copy of the field names, its own fixture, its own Zod/schema mirror — and both go
green. But the seam's failure mode lives in the *gap between the two mirrors*, which neither isolated test can
see by construction: a producer that emits a field under one name and a consumer that reads it under a
different name (e.g. a field that encodes a reference, named one way on emit and another on receive) will each
verify perfectly against itself. The defect is a disagreement, and a disagreement is invisible to anyone
looking at only one side. The same class produces an even quieter failure: a producer emits a new event type
(for example a reverse/correction transition) that has **no consumer handler at all** — it drains into a
durable void, perfectly "delivered" and entirely unconsumed, and per-event validation on each side never flags
the missing inverse. The deeper trap is a contract that is *single-sourced on one side only*: the producer
vendors the executable contract, but the consumer re-mirrors it in fail-open prose/schema — so the two are
guaranteed to drift, and the drift is most dangerous in the write/command direction.

**How to apply (domain-stripped, reusable).**
1. **Prove the seam with one real round-trip on real data.** Point the consumer at the real producer (real
   URL, real tokens, real transport — not `localhost`, not a mock), emit one real item, watch it drain, and
   confirm the consumer *acted*. The drain loop clearing its stale-warning and the consumer rendering the
   real fact IS the proof; a green test on either half is not.
2. **Single-source the contract and bind it BOTH ways.** The executable contract lives in one canonical place
   (vendored, version-pinned). The consumer must VENDOR and CALL the same executable validator — not
   re-mirror it in prose/fail-open validation. Add a cross-repo hash so producer and consumer prove they hold
   the same bytes. A contract single-sourced on one side is a future drift, not a binding.
3. **Cover the inverse / new transitions explicitly.** Every event type (including reverse/correction
   transitions) must have a real consumer handler, or it drains into a void. Assert handler-coverage of the
   full transition set, not just the happy path — per-event validation cannot see a missing inverse.
4. **Never stack a write seam on a read seam that has never run prod→prod.** Building the more dangerous
   (write/command) direction on a read substrate that was only half-verified compounds the class: a
   prose-synced contract detonating in the write direction is the same field-name-mismatch failure with worse
   blast radius.

**The test for any "the seam is verified" claim.** Ask: *"show me the ONE run where a real item went
producer→drain→consumer on real data and the consumer acted — not the producer test and the consumer test
that each passed separately."* If the only evidence is two isolated greens, the seam is unproven and a
contract mismatch can be sitting between the two mirrors right now. Two half-verifies passing is the failure
mode this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** In the 2026-06-16 Operational Readiness Assessment,
the read seam had **never run prod→prod** (the consumer's env pointed `ADMIN_*_URL` at `http://localhost`; the
drain loop reported `idle (drained=0)` and the monitor `handoff stalled ~594m`) — yet each side had passed its
own verification. The contract was **single-sourced on the producer side only** (the consumer had no vendored
contract, used fail-open Zod mirrored by prose). A newer event (`invoice.credited`) was in the contract +
fixtures but had **no consumer handler → drained into a durable void**, invisible to per-event validation. And
the prior pdfRef incident had already "detonated this class past two green VERIFYs." The assessment's verdict:
do not open the write/command seam on this substrate; prove the read seam prod→prod and bind the contract both
ways first.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the Operational Readiness
Assessment, which STAYS as the detailed source:
`../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md` — §4 (the pdfRef detonation past
two green VERIFYs; the write-on-read-substrate stacking risk), §3 items 5–7 (read seam never prod→prod;
contract single-sourced one side; `invoice.credited` drains into a void), and the "Lessons propagated?"
closing (the round-trip-handshake lesson surfaced but not yet enforced cross-repo). This KU is the retrievable
distilled form; the capability doc is preserved, not replaced.
