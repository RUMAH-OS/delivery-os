---
kuId: ku-enable-capabilities-on-trust-not-existence
title: Enable a capability on earned trust, not on the fact that it technically exists
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A capability must NOT be enabled for autonomous use merely because it technically exists or was built; it is enabled only when it has passed the required validation ladder AND has accrued sufficient operational trust. The governing question is never 'can we build it?' but 'under what conditions is it trustworthy enough to enable?' — so 'it exists / it's built / the slice passed' is never a sufficient reason to turn a capability on."
triggers:
  - "should we enable this capability"
  - "it's built — can we turn it on"
  - "can we let the platform actually execute this"
  - "the slice passed so can we enable autonomous use"
  - "is this capability trustworthy enough to enable"
  - "under what conditions can this be enabled"
  - "can we widen the allow-list"
  - "move from describe-only to live execution"
  - "it technically works, why not enable it"
topics:
  - enable-on-trust-not-existence
  - capability-enablement-gate
  - operational-trust-precondition
  - exists-is-not-enabled
  - autonomy-enablement-question
evidence-strength: runtime-evidenced
cited-quote: "a capability must NOT be enabled because it technically exists; it is enabled only when it has passed the required validation ladder AND has sufficient operational trust"
source-provenance:
  earned-from: "Founder directive 2026-06-17 (capability governance / controlled-execution review): the headline enablement principle"
  source-file: "../delivery-os/capabilities/CAPABILITY-GOVERNANCE-LADDER.md"
  anchor: "'Founder directive 2026-06-17 — verbatim source quotes' (the headline 'enable on trust, not existence' line). Occasioning evidence: ../../rumah-admin/docs/DECISION-REVIEW-2026-06-17-controlled-execution.md — CONSOLIDATED VERDICT NOT-YET, convergence point 3 ('It is PREMATURE … not yet used on a real intent')"
  signal-pattern: null
  ratification-note: "Canon source CAPABILITY-GOVERNANCE-LADDER.md is Status: ratified-pending (DRAFT until ratified; founder holds the merge gate) — so this KU is held at runtime-evidenced, NOT founder-ratified. Promote to founder-ratified when the founder ratifies CAPABILITY-GOVERNANCE-LADDER."
related:
  - ku-capability-governance-ladder
  - ku-implemented-is-not-operationally-proven
tags: [governance, enablement, operational-trust, autonomy, capability-gate, founder-os]
---

# Enable a capability on earned trust, not on the fact that it technically exists

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A capability must **not** be enabled for autonomous use merely because it *exists* or was
*built*. The founder's headline principle is exact:

> a capability must NOT be enabled because it technically exists; it is enabled only when it has passed the required validation ladder AND has sufficient operational trust

Enablement is a privilege earned on **two** things — a passed validation ladder **and** accrued operational
trust — not a property a capability inherits by being implemented. The governing question is therefore never
*"can we build it?"* but *"under what conditions is it trustworthy enough to enable?"*

**Why (the non-obvious reason).** "It exists" and "it is safe to turn on" feel like the same fact from inside
the build: the code path runs, the test is green, the slice passed — so it reads as ready. But existence proves
only *shape*, never *trust*. Trust is a separate, later, evidence-bearing property: has this run on real data,
is its outcome observable, are its safeguards (verified approver, audit, idempotency, reversibility) actually
enforced rather than declared? Enabling on existence quietly substitutes *capability* for *trustworthiness* and
opens the most common failure class in autonomous systems — a built-but-unproven capability turned loose
because nothing forced the trust question. The danger is structural: every "just widen the allow-list, it's
still gated" regression starts by treating enablement as a build-state flag instead of an earned rung.

**How to apply (domain-stripped, reusable).**
1. **Make enablement a deliberate, gated act — never a default of existence.** A capability ships *disabled for
   autonomy* and is enabled only by an explicit decision that cites the evidence. "It's built" is recorded in
   the Built column; "enabled" is a separate, later column.
2. **Ask the right question.** For any capability proposed for autonomous use, ask "under what conditions is it
   trustworthy enough to enable?" — and answer with named conditions, not "it works." If the conditions are
   unmet, the answer is NOT-YET, and the conditions become the backlog.
3. **Require BOTH a passed validation ladder AND operational trust.** A green ladder without operational trust
   (no real-data run, no observability, no enforced safeguards) is not enough; operational trust without a
   passed ladder is not enough either. Enablement needs both.
4. **Keep the smallest live class until trust is earned.** When in doubt, hold the capability at its narrowest
   safe class (e.g. describe-only, or read-only-internal) and earn outward/write/cross-system enablement one
   evidenced step at a time. The cost of waiting is usually near-zero; the cost of a wrong enable is not.

**The test for any "can we enable this?" claim.** Ask: *"what passed validation ladder AND what operational
trust justify turning this on — and if I can't name both, why is the answer not NOT-YET?"* If the only
justification is that the capability exists, is built, or passed a slice, the principle has been violated.

**Runtime evidence anchor (the load-bearing instance).** The 2026-06-17 controlled-execution §11 review asked
"move the platform from describe-only to controlled (live) execution?" and returned a unanimous **NOT-YET** —
explicitly because the substrate *existed* (a working invoke path, a green consumption loop) but had **not**
earned trust: the `--approve` token was presence-only (no verified approver, no audit), sideEffect-honesty was
declared not enforced, foundations were DRAFT/unratified, and the describe-only loop was "one iteration old,
not yet used on a real intent." Existence was real; trust was not — so enablement was correctly withheld.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** The cited headline is recorded verbatim in
the Founder-OS canon `../capabilities/CAPABILITY-GOVERNANCE-LADDER.md` ("Founder directive 2026-06-17 — verbatim
source quotes"), the on-disk home of the founder's 2026-06-17 capability-governance directive. The §11 review
it governs, `../../rumah-admin/docs/DECISION-REVIEW-2026-06-17-controlled-execution.md`, STAYS as the occasioning
evidence (the NOT-YET verdict, the presence-only-approve defect, the "premature / not yet used on a real intent"
convergence, and the ranked conditions a first live write must meet). See the companion
`ku-capability-governance-ladder` for the standard rung sequence enablement gates on. This KU is the retrievable
distilled form; the canon doc and the review are preserved, not replaced.
