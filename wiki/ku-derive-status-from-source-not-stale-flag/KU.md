---
kuId: ku-derive-status-from-source-not-stale-flag
title: A derived/displayed status must be computed from the system of record, never read from a denormalized or operator-maintained flag, which goes stale
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A derived or displayed status (available, occupied, vacant, active, in-stock, online…) MUST be computed from the system of record at read time, never read from a denormalized or operator-maintained flag. A flag that something else is supposed to keep in sync is stale by default: it diverges silently the moment a real-world state changes and nobody flips it, and every consumer then trusts a value that no longer reflects reality. The single source-of-truth derivation must be the only path; a cached/denormalized copy is allowed only when it is a projection of that derivation, kept honest by an invariant gate, never an independent operator-set field."
triggers:
  - "is this unit available"
  - "is this item in stock"
  - "should I read the isAvailable flag"
  - "trust the cached status or recompute it"
  - "the dashboard shows vacant but it is occupied"
  - "availability"
  - "occupancy"
  - "denormalized status flag"
  - "operator-maintained flag"
  - "stale cached flag"
  - "projection shows the wrong status"
  - "derive status from contracts"
  - "where does available come from"
topics:
  - derive-status-from-source-of-truth
  - never-read-stale-denormalized-flag
  - operator-maintained-flag-goes-stale
  - availability-occupancy-from-contracts
  - projection-must-derive-not-cache
  - cached-status-needs-invariant-gate
evidence-strength: runtime-evidenced
cited-quote: "occupied ⇒ never vacant"
source-provenance:
  earned-from: "Live occupancy incident 2026-06-18 (Rumah Admin) — Bug A: the /v1/inventory/* read projections trusted the stale operator flag unit.isAvailable (NOT NULL DEFAULT true) instead of deriving occupancy from active rental contracts, so an occupied unit was shown Vacant"
  source-file: "rumah-admin/src/occupancy.ts"
  anchor: "Module header (lines 1-25 — 'derived from ACTIVE RENTAL CONTRACTS (never from the operator-maintained unit.isAvailable flag alone)'; 'occupied ⇒ never vacant holds BY CONSTRUCTION in every read path'); activeRentalPropertyIds (lines 44-52)"
  git-sha: "d97373e"
  signal-pattern: null
  ratification-note: "DRAFT — author≠verifier. Distilled by the knowledge-engineer from a runtime incident; held at runtime-evidenced, NOT founder-ratified. A verifier must re-find the cited quote in rumah-admin/src/occupancy.ts before this counts as adopted; founder ratifies the DOS-REVIEW that promotes it."
related:
  - ku-record-only-state-the-action-achieved
  - ku-lifecycle-predicate-must-cover-every-state
  - ku-fail-closed-gates
  - ku-founder-discovered-failures-become-monitored-health-checks
tags: [integrity, status, derivation, source-of-truth, denormalization, stale-flag, availability, occupancy]
---

# A derived/displayed status must be computed from the source of record — never a denormalized or operator-maintained flag

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** Any status that *describes* whether something is in a state — available, occupied,
vacant, active, in-stock, online, assigned — is a **derivation**, and it MUST be computed from the system of
record at read time. It must **never** be read from a *denormalized* or *operator-maintained* flag that some
other action is supposed to keep in sync. The fix made the derived truth reusable so the invariant

> occupied ⇒ never vacant

holds **by construction** in every read path. A flag that defaults to a value and that a human (or an
unrelated code path) is meant to flip is **stale by default**: the moment the real-world state changes and
nobody flips it, the flag lies, and every downstream consumer inherits the lie.

**Why (the non-obvious reason).** A boolean column like `isAvailable` *feels* authoritative — it is right there
on the row, it is cheap to read, it reads like a fact. But it is not a fact; it is a **cache of a fact whose
real owner lives elsewhere** (the active contracts, the order lines, the session table). A cache with no
write-through and no reconciliation diverges silently: nothing errors when the lease starts and the flag stays
`true` — the system keeps serving the stale value happily. The trap is sharpest for **operator-maintained**
flags (`NOT NULL DEFAULT true`): the default itself is a claim ("available") that is true only until the first
state change, after which it is wrong until someone remembers to fix it — and nobody re-checks a green flag.
Worse, the *same* stale flag usually feeds many surfaces (a list endpoint, a detail page, a downstream
consumer's matching logic), so one un-flipped boolean corrupts every projection at once. This is distinct from
`ku-record-only-state-the-action-achieved` (which is about a status that lies because an *action* silently
failed): here no action failed — the flag simply was never the source of truth in the first place.

**How to apply (domain-stripped, reusable).**
1. **Name the source of truth, then derive from it.** For any "is it X right now" status, identify the records
   that actually determine X (the active contracts for occupancy, the open order lines for stock, the live
   sessions for online) and compute the status from them at read time. The derivation is the only sanctioned
   path.
2. **Treat any denormalized/operator-set flag as untrusted until proven.** A flag that something else is
   supposed to keep in sync is stale by default. Do not read it as truth in a projection; at most use it as a
   projection *of* the derivation.
3. **If you must cache, make the cache a projection and gate it.** A denormalized copy is acceptable only when
   it is written from the derivation and an **invariant gate** asserts `cached == derived` (see
   `ku-derive-status-from-source-not-stale-flag`'s companion pattern, the source-of-truth invariant gate, and
   `ku-fail-closed-gates`). A cache nobody reconciles is a future incident.
4. **Make the good invariant hold by construction.** Shape the read path so the impossible state cannot be
   projected (occupied ⇒ never vacant), not so it is merely "checked later".

**The test.** Ask: *"this status I am about to return — did I COMPUTE it from the records that actually
determine it, or did I READ a flag that something else was supposed to keep current?"* If a real-world state
change could leave the flag wrong with nothing erroring, you are displaying a stale denormalized value, and
that silent divergence is the failure mode this unit exists to prevent.

**Cross-product reach (why this is not a Rumah quirk).** Any system with a denormalized or operator-maintained
status flag is exposed: **PLOS** lead `status`/`isActive` columns that an event is supposed to advance;
**Rumah Website** showing availability from a cached value instead of Admin's contract-derived inventory; any
product with an `in_stock` / `is_online` / `assigned` boolean kept in sync by a side path. The reference fix
is Admin's `occupancy.ts` deriving from active rental contracts; the same shape applies everywhere.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the live occupancy incident of
2026-06-18 (commit `d97373e`). The on-disk source STAYS: `rumah-admin/src/occupancy.ts` — its module header
("derived from ACTIVE RENTAL CONTRACTS (never from the operator-maintained `unit.isAvailable` flag alone)";
"`occupied ⇒ never vacant` holds BY CONSTRUCTION in every read path") and `activeRentalPropertyIds`. Companion
units: `ku-record-only-state-the-action-achieved` (status that lies because an action failed — the sibling
failure mode), `ku-lifecycle-predicate-must-cover-every-state` (the money-bug sibling from the same incident),
and `ku-fail-closed-gates` (how the projection is kept honest). This KU is the retrievable distilled form; the
source file is preserved, not replaced.
