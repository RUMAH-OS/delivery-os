# Delivery OS Review — Occupancy/Billing Incident (2026-06-18)

> Author: **knowledge-engineer** (Knowledge Layer owner). **DRAFT — author≠verifier.** I distil the reusable
> knowledge; I do NOT certify it. A verifier must re-find the cited quotes in the source; the founder ratifies
> this review (and the promotion of its KUs). Additive only — knowledge artifacts, no domain-code change.
>
> Structure (founder-requested): **Problem → Root Cause → Validation Rule → Delivery OS Lesson → Future Reuse.**
> Incident memory: `rumah-admin/.../memory/occupancy-truth-and-rolling-billing.md`. Fix commit: `d97373e`.

---

## Problem
A real, occupied unit was displayed **Vacant** on an inventory read in production. Investigation found the
display bug was the *visible* tip of a second, costlier defect: a **rolling lease past its written end date was
being silently un-billed every month.** One incident, two independent root causes — one cosmetic, one financial.

## Root Cause (both — founder question 1)

**Bug A — display: a derived status read from a stale denormalized flag.**
The `/v1/inventory/*` read projections computed availability from `unit.isAvailable` — an operator-maintained
column, `NOT NULL DEFAULT true`, that nobody flipped when the lease started. The portfolio view
(`portfolio.ts`) already derived occupancy from contracts and was correct; the inventory projections were not.
- Fix (`rumah-admin/src/occupancy.ts`): availability is **derived from active rental contracts**; the read
  paths make `occupied ⇒ never vacant` hold **by construction**.

**Bug B — money: a lifecycle predicate that omitted a state.**
`contractStatus` (in `rumah-admin/src/invoicing.ts`) — the **shared** truth function behind BOTH portfolio and
the monthly invoice run — classified `endDate < today` as `"ended"` and **ignored the `rollingContract`
lifecycle field**. A rolling/indefinite lease past its written `endDate` was therefore classed "ended" → (a)
portfolio/availability showed it **vacant**, and (b) the monthly invoice run **skipped it** ("not active
today"), so the still-occupying tenant was **silently un-billed every month past `endDate`**, understating
owner-fee + revenue bases too.
- Fix: `contractStatus` / `activeInRange` / `activeInMonth` honor `rollingContract`
  (`rolling-past-end ⇒ active/occupied/billed until terminated`); fixed-term behaviour is byte-identical;
  rolling is excluded from expiring/renewal worklists. The shared function is fixed once so every consumer
  inherits the correction.

## The assumption that failed (founder question 2)
Two false assumptions, one per bug:
- **Bug A:** *"a status flag on the row is the source of truth."* It is not — `isAvailable` is a **cache of a
  fact whose real owner is the contract table.** A flag something else must keep in sync is **stale by
  default**: it diverges the instant a real-world state changes and nobody flips it, and nothing errors.
- **Bug B:** *"a contract past its end date is ended"* — i.e. the lifecycle has a **closed form** (`ended :=
  endDate < today`). This silently dropped the **open-ended / rolling** state. The assumption was correct for
  the common case (fixed-term leases) so it passed every test that never exercised the rolling path — and
  because the predicate **fans out** to many consumers, the one missed branch corrupted all of them at once,
  including **money**.

## Validation Rule added (founder question 3 — permanent prevention)
The fix is enforced at **three layers**, fail-closed:
1. **App / read-path (by construction):** `src/occupancy.ts` derives occupancy from active rental contracts and
   reuses the canonical `contractStatus`/`isRental`, so the projection and the portfolio/invoicing views can
   never diverge; `occupied ⇒ never vacant` holds structurally.
2. **CI / runtime gate (enforcing):** `npm run occupancy:gate`
   (`scripts/occupancy-invariant-gate.ts`) **exits non-zero** if any unit is `isAvailable=true` while its
   property has an active rental covering today — *"an occupied unit is NEVER flagged available."* No-DB CI
   proves it via `tests/occupancy-incident.test.ts`; UNMEASURED exits 2 (could-not-run), never a silent pass.
3. **Database trigger (migration `0035_occupancy_invariant_guard`):** a `BEFORE INSERT OR UPDATE` trigger on
   `unit` **RAISES** if `is_available` is set true while the property has an active rental — integrity enforced
   in the DB, not by code discipline. Additive + reversible.
   *(Bug B is additionally covered by 32 QA tests over the rolling lifecycle; a downstream billing-coverage
   invariant — "an active/occupied entity must appear in the billing run" — is the recommended next gate.)*

## Delivery OS Lesson (founder questions 4 & 5)

### Could the same failure occur in another product? (Q4 — yes, concretely)
Both root causes are **product-agnostic shapes**, not Rumah quirks:
- **Bug A class — denormalized/operator-maintained status flag** that goes stale:
  - **PLOS:** a lead/deal `status` or `isActive` column an event is *supposed* to advance — read directly, it
    goes stale the moment the advancing event is missed.
  - **Rumah Website:** showing availability from a cached value rather than Admin's contract-derived inventory.
  - **Any product** with an `in_stock` / `is_online` / `assigned` boolean kept in sync by a side path.
- **Bug B class — a lifecycle predicate that omits a state** (especially open-ended/indefinite/rolling):
  - **PLOS:** lead/deal "active"/"open" predicates that miss a paused/recycled/indefinite status.
  - **Any SaaS:** an auto-renewing subscription classed "expired" at term-end and dropped from the renewal
    charge — the same silent-un-billing money bug.
  - **Any product** whose billing/eligibility filter derives from a lifecycle with an un-handled state.

### Does the lesson belong in a reusable DOS capability/skill? (Q5 — yes)
Yes, on two grounds. **(1) Both lessons are validated, cross-product principles** → they detach from the
discovering workflow and become canonical KUs (`ku-learn-once-promote-system-wide`): see the two KUs below.
**(2) The prevention has a repeatable, mechanical shape** — a fail-closed gate asserting *derived == source* at
app+CI+DB layers — which is bigger than two rules: it is a **reusable pattern any future product instantiates**.
That pattern is documented as a DOS standard in §"Reusable Prevention Pattern" below. (A standalone *skill* is
**proposed, not earned**: a skill needs a repeatable procedure proven across ≥2 tasks; one reference instance
is not yet enough. Proposed name: `source-of-truth-invariant-gate` — earning stays gated by author≠verifier.)

### Promoted KUs (canonical, routable — `delivery-os/wiki/`, mirrored into `rumah-admin/wiki/`)
| KU | Covers | Status |
|---|---|---|
| `ku-derive-status-from-source-not-stale-flag` | Bug A class — derive status from the system of record, never a stale denormalized/operator flag | DRAFT / runtime-evidenced |
| `ku-lifecycle-predicate-must-cover-every-state` | Bug B class — a lifecycle predicate must handle every state; a missed state corrupts money, not just display | DRAFT / runtime-evidenced |

Both carry `source-provenance` (incident + file + commit `d97373e`) and a **verbatim** cited quote re-findable
in the source. Both are **DRAFT — not self-certified**: a verifier must re-find the citation before adopted.

---

## Future Reuse — the REUSABLE PREVENTION PATTERN (founder's "most important" ask)

### The "Source-of-Truth Invariant Gate" pattern (DOS standard — reference instance #1 = Admin occupancy)
**Definition.** For any state that is *derived* but also *displayed/denormalized*, a **fail-closed gate**
asserts that the denormalized/displayed value **equals its source-of-truth derivation**, enforced at as many of
**app · CI · DB** layers as the stack allows, run **report → enforce**. The good invariant holds *by
construction* in the read path; the gate catches the *underlying bad state* so it can never silently recur.

**Why it generalises.** Bug A and Bug B are both instances of one disease: *a value that is supposed to track a
source of truth has drifted from it, and nothing notices.* The cure is always the same shape — name the
(source-of-truth derivation, denormalized/displayed value) pair and gate their equality fail-closed. This is a
specialisation of `ku-fail-closed-gates` applied to derived-state integrity.

**Reference instance #1 (Admin, occupancy).**
- *Source-of-truth derivation:* `activeRentalPropertyIds(contracts, today)` (occupancy from active contracts).
- *Denormalized/displayed value:* `unit.isAvailable`.
- *Invariant:* `isAvailable=true ⇒ property has NO active rental` (occupied ⇒ never vacant).
- *Layers:* app (read derives by construction) · CI/runtime (`occupancy:gate`, exit 1) · DB (migration 0035
  trigger, RAISE). Report→enforce: the prior `inventory-units-staleness-check.ts` flagged (exit 0); the new
  gate enforces (exit 1).

### How a FUTURE product instantiates it (the recipe)
1. **Name the pair.** Identify the `(source-of-truth derivation, denormalized/displayed flag)` for the state
   in question — e.g. `(open order lines, product.in_stock)`.
2. **State the invariant** as an equality/implication the gate can assert — `in_stock=true ⇒ derive_stock() > 0`.
3. **Make the read derive by construction** — the projection computes from the source, so the impossible state
   cannot be served (the structural half).
4. **Write the gate from the template** (`scripts/occupancy-invariant-gate.ts` is the shape): load both sides,
   compute violations = rows where denormalized ≠ derived, exit non-zero on any violation; **UNMEASURED fails
   closed** (exit "could-not-run", never a silent pass).
5. **Wire it report → enforce.** Land it report-only first (observe the real divergence/blast radius), then
   flip to enforcing (CI step / pre-deploy / ops cron). Where the store supports it, add the **DB trigger**
   layer so integrity survives any code path.
6. **Make discovered violations monitored** (`ku-founder-discovered-failures-become-monitored-health-checks`):
   the gate doubles as a standing health check.

### Two mapped future instances
| Product | Source-of-truth derivation | Denormalized/displayed value | Invariant the gate asserts | Layers |
|---|---|---|---|---|
| **PLOS** | lead/deal status derived from the source **events** (the event log is the SoT) | `lead.status` / `lead.isActive` column | stored status == event-derived status (and `isActive` matches the derived lifecycle state, incl. paused/indefinite) | app projection · CI gate (`lead-status-invariant`) · DB trigger if feasible |
| **Rumah Website** | availability from **Admin's contract-derived inventory** (the `/v1/inventory` seam — the SoT) | the Website's locally cached/displayed availability | displayed availability == Admin inventory availability (no independent flag) | consumer cache reconciliation · CI/contract gate against the seam (cf. `ku-verify-seam-by-one-real-round-trip`) |

---

## The REUSE MECHANISM (founder's 4th ask — concrete propagation, proven)
The propagation path uses only **proven** mechanisms:

```
KU authored in delivery-os/wiki (CANONICAL, single-authored)
  → vendored byte-identical into each product's wiki (os-inherit, the established mirror pattern)
  → routable via knowledge-route.mjs (deterministic ranker; triggers[]/topics[])
  → a future product's dispatch INJECTS the top-ranked KU's marker [knowledge:<kuId>#<proofId>] into the
    spawned agent's prompt when a relevant task appears (K2 injection, provable in the transcript)
  → the agent applies the rule / instantiates the pattern; citation@hash = adoption evidence (knowledge-health)
```

**Routability PROVEN** (read-only `knowledge-route.mjs` against `rumah-admin/wiki`, real output):

```
$ node .claude/os/tools/knowledge-route.mjs "is this unit available"
   16.0  ku-derive-status-from-source-not-stale-flag  (trigger~"is this unit available", trig:unit/available)
    6.0  cap-ref-inventory-units-v1  (trig:unit/available)

$ node .claude/os/tools/knowledge-route.mjs "compute active status from rolling lifecycle"
   26.5  ku-lifecycle-predicate-must-cover-every-state  (trigger~"compute active status", trig:compute/active/status/rolling/lifecycle, topic:from)
    7.0  ku-derive-status-from-source-not-stale-flag  (trig:status/from)

$ node .claude/os/tools/knowledge-route.mjs "should I read the isAvailable flag or derive occupancy from contracts"
   42.5  ku-derive-status-from-source-not-stale-flag  (trigger~"should I read the isAvailable flag", trigger~"occupancy", ...)

$ node .claude/os/tools/knowledge-route.mjs "is this contract still active rolling indefinite lease should it be billed this month"
   34.0  ku-lifecycle-predicate-must-cover-every-state  (trigger~"is this contract still active", ...)
```

**Baseline (before promotion, honest):** "is this unit available" routed only to `cap-ref-inventory-units-v1`
(6.0); "compute active status…" routed to the generic `ku-learn-once-promote-system-wide` (6.0). Neither
principle was retrievable. After promotion both new KUs are the **decisive top route** for their intents.

**What is proven vs not (honest):** routing (K1) is proven here. **Injection (K2) and citation (K3/adoption)
are NOT yet demonstrated** — they occur when a real future task in a product dispatches with the marker
embedded and an agent cites it. Per `ku-injection-is-not-adoption`, retrieval ≠ adoption; these KUs are
`built/routable`, not yet `adopted`. PLOS still consumes this corpus only after its own os-inherit + a real
relevant task.

---

## Status (Built ≠ Adopted)
- **Built:** DOS review (this doc) · 2 canonical KUs · prevention-pattern standard · routability proof.
- **NOT done by me (author≠verifier):** verifier re-finds the two cited quotes in source; founder ratifies this
  review + the KU promotions; a real downstream task proves injection+citation (adoption). Until then the KUs
  are `runtime-evidenced`, not `founder-ratified`.

## Artifacts
- This review: `delivery-os/capabilities/DOS-REVIEW-occupancy-incident-2026-06-18.md`
- KU: `delivery-os/wiki/ku-derive-status-from-source-not-stale-flag/KU.md` (mirror: `rumah-admin/wiki/...`)
- KU: `delivery-os/wiki/ku-lifecycle-predicate-must-cover-every-state/KU.md` (mirror: `rumah-admin/wiki/...`)
- Source (preserved): `rumah-admin/src/occupancy.ts` · `rumah-admin/src/invoicing.ts` ·
  `rumah-admin/scripts/occupancy-invariant-gate.ts` · `rumah-admin/migrations/0035_occupancy_invariant_guard.sql`
