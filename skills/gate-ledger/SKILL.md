---
name: gate-ledger
version: 1.0.0
stability: stable
description: >
  Register and maintain pre-committed evidence gates queryably: ID, threshold, LIVE counter on the operating
  surface, owner, signature-only amendment, reconsideration date. Invoke when a thesis/gate is registered,
  when a panel is commissioned (mandatory pre-read), or when a gate's counter or date needs honest review.
decision_class: governance
inputs:  [the gate definition (threshold + what fires), a counter query, an owner, a reconsideration date]
outputs: [a docs/gates.md row + a live counter surfaced where the operator works]
earned_from: "Consumer P: a pre-registered gate held against three separate temptations to over-read N=3 data (the discipline works) — while a sibling infra gate was quietly REINTERPRETED rather than re-signed, and turned out wrong with no honest way to say so; and both learning gates sat unfired with NO live counters while consumption machinery compounded ahead of them (incident 10)."
mechanical_spine: "docs/gates.md is a scaffolder-instantiated registry; Governance §11 refusal rule makes it a mandatory panel pre-read; the evidence governor (§15) caps build-ahead at one step"
---
# Gate Ledger

## Overview
Gates ration building by evidence — but an unbuilt counter makes a gate fail silently by never firing, and an
unowned gate gets reinterpreted instead of amended. This skill keeps gates honest in both directions.

## When to use (and NOT)
- Use when: registering any pre-committed threshold; commissioning a panel (pre-read); reviewing why a gate
  has not fired by its reconsideration date.
- **NOT** for: slice acceptance criteria (the slice doc) or invariants (INVARIANTS.md — always-true, not thresholds).

## Process
1. **Register**: ID · threshold + what fires · the counter query · owner · signature + date · reconsideration date.
2. **Build the live counter in the same change** — N/threshold, surfaced where the operator actually works.
   A gate whose counter requires archaeology does not exist operationally.
3. **Enforce the evidence governor**: capture-before-gate; consumers at gate-fire; build-ahead capped at one
   step. A panel recommending machinery for an unfired gate gets the refusal rule (§11).
4. **Amend by signature only** — a new row with the old threshold kept; reinterpretation is a defect.
5. **At the reconsideration date**: fire, amend, or honestly retire — never silently extend.

## Red flags
- Machinery being built "for when the gate fires" two steps ahead (incident 10's shape).
- A gate discussed in past tense that the ledger says is unfired.
- "We basically decided that gate doesn't apply" — that is reinterpretation; get the signature.

## Verification (of this skill's own output)
- Each row's counter query runs and returns the surfaced number.
- Every amendment row has a signature + date; no threshold ever silently changed (git history is the check).

## Changelog
- 1.0.0 — promoted from consumer P's harvested skill (#76 §8.1) + the evidence-governor doctrine (B13); gates.md template ships at scaffold (T4).
