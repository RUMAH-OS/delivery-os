---
kuId: ku-lifecycle-predicate-must-cover-every-state
title: A lifecycle/status predicate must handle EVERY lifecycle state — a missed state silently corrupts every downstream consumer, including MONEY
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A predicate that classifies or filters by lifecycle state (is-active, is-ended, in-period, is-eligible…) MUST handle EVERY state the lifecycle can be in — especially the open-ended / indefinite / rolling / auto-renewing ones that have no fixed terminal date. A predicate that silently assumes a closed-form lifecycle (e.g. 'ended := endDate < today') misclassifies the omitted states, and because a shared truth function feeds MANY consumers, that one missed branch corrupts all of them at once — not just a display, but billing, fees, revenue, eligibility. A missed lifecycle state is therefore a money-grade defect, not a cosmetic one."
triggers:
  - "compute active status"
  - "is this contract still active"
  - "is the lease ended"
  - "rolling contract"
  - "indefinite or open-ended lease"
  - "lifecycle predicate"
  - "status predicate"
  - "did we handle every state"
  - "is-active filter for billing"
  - "endDate past today means ended"
  - "auto-renewing subscription state"
  - "should this be billed this month"
  - "state machine missing a branch"
topics:
  - lifecycle-predicate-covers-every-state
  - open-ended-indefinite-rolling-state
  - shared-truth-function-fans-out
  - missed-state-corrupts-money-not-just-display
  - closed-form-lifecycle-assumption-is-a-trap
  - billing-eligibility-derives-from-lifecycle
evidence-strength: runtime-evidenced
cited-quote: "if (ct.endDate < date && !ct.rollingContract) return false; // past end and NOT rolling ⇒ ended"
source-provenance:
  earned-from: "Live occupancy incident 2026-06-18 (Rumah Admin) — Bug B (the money bug): contractStatus, the SHARED truth function behind portfolio AND invoicing, ignored the rollingContract lifecycle field, so a rolling lease past its written endDate was classed 'ended' → portfolio showed it vacant AND the still-occupying tenant was SILENTLY UN-BILLED every month past endDate"
  source-file: "rumah-admin/src/invoicing.ts"
  anchor: "activeInRange/contractStatus/activeInMonth (lines 214-269 — the BUG-B fix threading rollingContract; line 229 'past end and NOT rolling ⇒ ended'; line 244 'fixed-term past its end ⇒ ended; rolling-past-end falls through and is classified active'; line 269 'rolling never lapses')"
  git-sha: "d97373e"
  signal-pattern: null
  ratification-note: "DRAFT — author≠verifier. Distilled by the knowledge-engineer from a runtime money-incident; held at runtime-evidenced, NOT founder-ratified. A verifier must re-find the cited quote in rumah-admin/src/invoicing.ts before this counts as adopted; founder ratifies the DOS-REVIEW that promotes it."
related:
  - ku-derive-status-from-source-not-stale-flag
  - ku-record-only-state-the-action-achieved
  - ku-fail-closed-gates
  - ku-sensitive-changes-require-security-review
tags: [integrity, lifecycle, state-machine, predicate, billing, money, rolling-contract, open-ended-state, shared-truth-function]
---

# A lifecycle/status predicate must cover EVERY state — a missed state silently corrupts money

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A predicate that classifies or filters by lifecycle state — *is-active*, *is-ended*,
*in-period*, *is-eligible-to-bill* — MUST account for **every** state the lifecycle can be in. The dangerous
gap is the **open-ended / indefinite / rolling / auto-renewing** state: a lifecycle that has no fixed terminal
date but a predicate that assumes one. The detonation in the source:

> if (ct.endDate < date && !ct.rollingContract) return false; // past end and NOT rolling ⇒ ended

The pre-incident code lacked the `&& !ct.rollingContract` guard: it classified *any* contract past its written
`endDate` as ended, ignoring that a **rolling** lease continues until explicitly terminated. Because that
predicate was the **shared truth function** behind both the portfolio/availability view and the monthly
invoice run, one missed branch made the rolling tenant show **vacant** AND get **silently un-billed every
month** past `endDate`.

**Why (the non-obvious reason).** A closed-form lifecycle assumption (`ended := endDate < today`) is seductive
because it is correct for the *common* case (fixed-term leases) and the omitted case is rare, so it passes
every test that only exercises the common path. The non-obvious damage is the **fan-out**: a status predicate
is rarely consumed in one place — it is the function everything else asks "is this active?", so a single missed
state does not produce one wrong screen, it produces a *consistent* wrong answer across availability, billing,
fee bases, revenue, and worklists simultaneously. And the worst consumer is **money**: a display bug is
embarrassing, but a billing predicate that drops a lifecycle state means real invoices are never generated and
no error fires — the failure is *absence* (a missing invoice), which is invisible until a reconciliation or an
angry tenant. A missed lifecycle state is therefore a financial-integrity defect, which is why a change to a
shared lifecycle predicate falls under `ku-sensitive-changes-require-security-review`.

**How to apply (domain-stripped, reusable).**
1. **Enumerate the full state set before writing the predicate.** List every lifecycle state the entity can
   occupy — including open-ended/indefinite/rolling/auto-renew/suspended — and confirm the predicate has an
   explicit branch (or a deliberate, commented exclusion) for each. A predicate written from the happy path
   is a predicate missing states.
2. **Make the open-ended state explicit, never the implicit complement of a date check.** "Past `endDate`" must
   not be allowed to *mean* "ended" by default; the rolling/indefinite case must be a first-class branch
   (`rolling-past-end ⇒ active until terminated`).
3. **Audit every consumer of a shared truth function when you touch it.** Because the predicate fans out, fix
   it in the one shared function (so status, occupancy, billing, fees, matching all inherit the correction) and
   verify each downstream consumer with the omitted state present. Prove the common case is byte-identical so
   the fix is additive.
4. **Cover lifecycle invariants with tests, and gate the money path.** Add a test fixture for each lifecycle
   state (especially the open-ended one) against the shared function, and consider an invariant gate on the
   downstream financial effect (e.g. an occupied/active entity must appear in the billing run). See
   `ku-fail-closed-gates`.

**The test.** Ask: *"can this entity be in a lifecycle state my predicate does not explicitly handle — an
indefinite, rolling, or auto-renewing one — and if so, which consumer (especially billing) silently gets the
wrong answer?"* If an open-ended state collapses into "ended" because a date passed, and a downstream consumer
spends money (or fails to) based on that, this is the failure mode this unit exists to prevent.

**Cross-product reach (why this is not a Rumah quirk).** Any product with a lifecycle predicate that omits a
state is exposed: **PLOS** lead/deal "active" or "open" predicates that miss a paused/recycled/indefinite
status; any SaaS **auto-renewing subscription** classed "expired" at term-end and dropped from the renewal
charge; any inventory **back-order**/pre-order state a stock predicate ignores. Wherever a status predicate
feeds money or eligibility, a missed lifecycle state is a silent financial defect.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the live occupancy/billing
incident of 2026-06-18 (commit `d97373e`), Bug B. The on-disk source STAYS: `rumah-admin/src/invoicing.ts` —
`contractStatus` / `activeInRange` / `activeInMonth` threading `rollingContract` (line 229 "past end and NOT
rolling ⇒ ended"; line 244 "rolling-past-end falls through and is classified active"; line 269 "rolling never
lapses"). Companion units: `ku-derive-status-from-source-not-stale-flag` (Bug A from the same incident — the
display/derivation sibling), `ku-record-only-state-the-action-achieved` (status integrity), and
`ku-sensitive-changes-require-security-review` (why a shared money predicate needs independent review). This KU
is the retrievable distilled form; the source file is preserved, not replaced.
