---
kuId: ku-record-only-state-the-action-achieved
title: Never persist or display a state the action did not actually achieve — status must reflect reality
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A system must never persist or display a status the underlying action did not actually achieve (e.g. marking an item 'sent' when no message left the system); a status field is a claim about reality and must be set only on confirmed success of the real side-effect, with honest not-done / failed / no-op states surfaced rather than papered over with an optimistic label."
triggers:
  - "should I mark this sent"
  - "the status says sent but did it actually send"
  - "set status before or after the side effect"
  - "optimistic status update"
  - "marked done when it wasn't"
  - "the action no-oped but we recorded success"
  - "surface a failed or not-done state"
  - "does this status reflect reality"
  - "is the state a lie"
topics:
  - record-only-state-the-action-achieved
  - status-must-reflect-reality
  - no-optimistic-success-marking
  - confirm-side-effect-before-status
  - surface-honest-not-done-states
  - silent-no-op-detection
evidence-strength: runtime-evidenced
cited-quote: "Email delivery — RESEND_API_KEY not set in prod → sendMail no-ops → nothing reaches a tenant."
source-provenance:
  earned-from: "Operational Readiness Assessment 2026-06-16 (the 'send=no-op' / 'marked sent' lie — email never left the system)"
  source-file: "../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md"
  anchor: "§2 capability table (line 31, Invoices 'send=no-op'); §3 item 2 (lines 41-42, sendMail no-ops → nothing reaches a tenant); §1 NOT PROVEN (line 22)"
  signal-pattern: null
related:
  - ku-implemented-is-not-operationally-proven
  - ku-issued-artifact-immutability
  - ku-sensitive-audit-append-only-at-the-db
tags: [integrity, status, honest-state, no-op, side-effect, truth-over-convenience]
---

# Never record a state the action did not achieve — status must reflect reality

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A status field is a *claim about reality*: "sent," "paid," "delivered," "done." The
system must therefore set it **only on confirmed success of the real side-effect** — and must never persist or
display a state the action did not actually achieve. The detonation pattern:

> Email delivery — RESEND_API_KEY not set in prod → sendMail no-ops → nothing reaches a tenant.

When the side-effect silently no-ops but the record says "sent," the status is a *lie that propagates*. Honest
not-done / failed / queued / no-op states must be surfaced, never papered over with an optimistic label.

**Why (the non-obvious reason).** Optimistic status-marking feels like the natural shape of the code: call the
send, set status = "sent," move on. But it conflates "I attempted the action" with "the action succeeded,"
and those diverge exactly when the side-effect quietly fails — an unset secret, a no-op stub, a swallowed
error, a downstream service that accepts-then-drops. The status then asserts a reality that never happened,
and because nobody re-checks a green status, the lie is *load-bearing*: the operator believes the message
went out, the recipient never received it, and the gap surfaces only in a dispute or an angry "I never got
this." A false "done" is worse than a visible "failed," because the visible failure invites a retry while the
false success suppresses one. The trap is sharpest for actions that cross the system boundary (email, payment,
signature) where the only proof of success is an external acknowledgement the code must actually wait for.

**How to apply (domain-stripped, reusable).**
1. **Set status from the confirmed result, not the attempt.** Update the record to "sent/done/delivered" only
   after the real side-effect returns success (a real provider acceptance id, a 2xx with a message id, an
   external receipt) — never before the call, never on a swallowed error, never on a no-op path.
2. **Make a no-op loud.** If a dependency is unconfigured or stubbed (secret unset, provider disabled), the
   action must FAIL or record an explicit "not-sent (no transport)" state — never silently succeed. A no-op
   that reports success is the worst case; treat unconfigured-dependency as fail-closed.
3. **Model honest intermediate states.** "queued," "attempting," "failed," "bounced," "not-sent" are
   first-class — the schema should be able to say *what really happened*, not collapse everything into
   sent/not-sent. Surface failed/not-done to the operator so it can be retried.
4. **Reconcile against the external truth where one exists.** Where the external system can confirm delivery
   (a webhook, a delivery receipt), reconcile the local status to it rather than trusting the local optimistic
   write — the external acknowledgement is the truth, the local field is a cache of it.

**The test for any status write.** Ask: *"if this field says 'sent/done,' did the real side-effect actually
happen — and can I prove it from a confirmation, not from the fact that we called the function?"* If the
status can read "done" while nothing left the system, it is recording a state the action did not achieve.
That silent lie is the failure mode this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** In the 2026-06-16 Operational Readiness Assessment,
invoice "send" was a **no-op** in production: `RESEND_API_KEY` was not set, so `sendMail` no-oped and *nothing
reached a tenant* — yet the workflow would mark the invoice as acted-upon. The founder's #1 pain (invoicing
that actually arrives) was therefore "NOT proven end-to-end": the system could report success while the
real-world action never occurred. The fix is operational (set the secret, prove one real delivery) AND
structural (status must reflect the confirmed result, with an honest not-sent state when there is no transport).

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the Operational Readiness
Assessment, which STAYS as the detailed source:
`../delivery-os/capabilities/OPERATIONAL-READINESS-ASSESSMENT-2026-06-16.md` — §2's capability table
(Invoices "gen=manual, **send=no-op**"), §3 item 2 ("`sendMail` no-ops → **nothing reaches a tenant**"), and
§1's NOT-PROVEN scope ("every action that touches the outside world"). Companion principle:
`../delivery-os/capabilities/V6-LANDED-DEFINITION.md`'s completeness chain ("Used successfully in a real
workflow"). This KU is the retrievable distilled form; the capability doc is preserved, not replaced.
