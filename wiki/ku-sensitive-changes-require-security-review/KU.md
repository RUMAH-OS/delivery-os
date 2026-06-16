---
kuId: ku-sensitive-changes-require-security-review
title: Changes to money, legally-binding artifacts, PII, or data-integrity invariants require an independent security review before ship
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "Any change touching money, legally-binding artifacts, PII, or a data-integrity invariant (including immutability/no-data-loss) must pass an INDEPENDENT security-compliance review before it ships; this must be a routing/review CHECKPOINT triggered by the nature of the change — not a remember-to — because the failure mode is silent (a destructive or financial path ships without anyone whose job is to attack it ever looking)."
triggers:
  - "is this change sensitive"
  - "does this need a security review"
  - "touching money or invoices or payments"
  - "deleting a legally-binding record"
  - "changing an immutability invariant"
  - "PII or personal data change"
  - "who reviews a destructive action"
  - "data-integrity invariant change"
  - "should security-compliance look at this"
topics:
  - sensitive-changes-require-security-review
  - security-review-as-routing-checkpoint
  - money-legal-pii-integrity-triggers
  - independent-review-not-remember-to
  - destructive-action-review
  - data-integrity-invariant-change
evidence-strength: runtime-evidenced
cited-quote: "Condition A (append-only audit RLS) applied by software-engineer + independently re-attested by qa-test; security condition RESOLVED"
source-provenance:
  earned-from: "wave4 legacy-invoice-delete + credit-notes (destructive/financial actions gated by a security condition) 2026-06-16"
  source-file: "../rumah-admin/docs/verify/VERIFY-wave4-legacy-invoice-delete.md"
  anchor: "hardening_reattested (line 7); Condition A re-attestation §(lines 19-46); verifier≠author attestation (lines 49-51)"
  signal-pattern: null
related:
  - ku-sensitive-audit-append-only-at-the-db
  - ku-author-not-equal-verifier
  - ku-issued-artifact-immutability
  - ku-record-only-state-the-action-achieved
tags: [security, compliance, sensitive-change, money, legal-artifact, pii, data-integrity, review-checkpoint, routing]
---

# Sensitive changes require an independent security review — a routing checkpoint, not a remember-to

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** Any change that touches **money, a legally-binding artifact, PII, or a data-integrity
invariant** (immutability, no-data-loss, an append-only ledger) must pass an **independent
security-compliance review before it ships**. The review is triggered by the *nature of the change*, as a
routing/review CHECKPOINT — not left to the author's memory:

> Condition A (append-only audit RLS) applied by software-engineer + independently re-attested by qa-test; security condition RESOLVED

A sensitive change is RATIFY-WITH-CONDITIONS until an independent reviewer (whose job is to attack it) signs
off; "the builder thought about security" is not a review.

**Why (the non-obvious reason).** Sensitive code paths are exactly the ones whose failures are *silent and
expensive*: a destructive delete that quietly removes a legally-required record, a financial reversal that
corrupts a balance, a PII change that leaks or fails an erasure obligation, an immutability invariant
loosened so issued artifacts can be rewritten. None of these throws at build time — the slice passes, the
tests are green — so the defect only surfaces in an audit, a dispute, or a regulator's request, when it is
far too late and the harm is real-world. Leaving the review to a "remember to get security to look at this"
guarantees it is skipped under delivery pressure precisely on the changes that most need it, because the
author — who is confident the change is fine — has no structural prompt to escalate. The non-obvious move is
to make the *category of the change* (money/legal/PII/integrity globs) automatically ROUTE the review, so the
checkpoint fires by construction, and to make it INDEPENDENT (author ≠ reviewer) because the builder cannot
see the attack surface they just built.

**How to apply (domain-stripped, reusable).**
1. **Define the sensitive categories explicitly.** Money/financial, legally-binding artifacts (contracts,
   invoices, signatures), PII/personal data, and data-integrity invariants (immutability, no-data-loss,
   audit/ledger). These are the triggers.
2. **Make the review a routing checkpoint, not a memory item.** Detect the category by the changed paths
   (migrations, the money/PII modules, anything that relaxes an invariant) and auto-route a security-compliance
   review owner — so the checkpoint is structural, never "if someone remembers."
3. **Require independent sign-off before ship (author ≠ reviewer).** The reviewer is a different owner who
   attacks the change (tamper attempts, deny-matrix, erasure/round-trip), and the change ships only after that
   sign-off — ratify-with-conditions until the condition is independently re-attested.
4. **Re-attest the condition, don't self-close it.** When the builder applies the security hardening, an
   independent reviewer re-runs the adversarial proof and records RESOLVED. The builder marking its own
   security condition done is not a review.

**The test for any sensitive change.** Ask: *"does this touch money, a legally-binding artifact, PII, or a
data-integrity invariant — and if so, did an INDEPENDENT security reviewer attack it and sign off before
ship?"* If the change is in a sensitive category and the only assurance is the author's confidence, the
checkpoint was skipped. A destructive/financial/PII/integrity path shipping un-reviewed is the silent failure
mode this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** The wave4 legacy-invoice-delete slice (a *hard
delete* of a legally-binding financial artifact) and the credit-notes slice (a financial reversal) were
gated by a SECURITY CONDITION rather than shipped on build-pass: **Condition A — append-only audit RLS** was
applied by the builder and then **independently re-attested by qa-test** (a distinct invocation; the verifier
asserted it did NOT author the production code under test). The independent re-attestation ran the adversarial
proof — tamper attempts denied, deny-is-RLS-not-missing-grant, migration round-trip clean — and only then
recorded "security condition RESOLVED." A remember-to would have shipped a destructive financial path with no
attacker ever looking. Companion: ADR-007 (GDPR/immutable-ledger) makes PII + immutability a pre-migration
security-review gate (run through `principle-11-review`).

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the wave4 destructive/financial
slices + their independent security re-attestation, which STAY as the detailed source:
`../rumah-admin/docs/verify/VERIFY-wave4-legacy-invoice-delete.md` (the Condition A append-only-audit-RLS
security gate, independently re-attested by a non-author reviewer) and ADR-007
`../rumah-admin/docs/adr/ADR-007-gdpr-retention-and-immutable-ledger.md` (PII + immutable-ledger gated before
sensitive-data migration, via `principle-11-review`). This KU is the retrievable distilled form; the
verify/ADR docs are preserved, not replaced.
