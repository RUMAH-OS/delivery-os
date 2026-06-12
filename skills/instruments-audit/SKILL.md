---
name: instruments-audit
version: 1.0.0
stability: stable
description: >
  Cadenced READ-ONLY audit of live data against the system's measurement/capture claims: dormant captures,
  mis-stamped provenance, destroyed rows, doctrine-vs-rows drift. Runs on a SCHEDULE (per milestone — a
  standing loop beat), never at discretion. Invoke at each scheduled cadence point or immediately after new
  instrumentation ships (prove it records before relying on it).
decision_class: data
inputs:  [read-only access to the live store, the capture/measurement claims in specs and doctrine]
outputs: [a dated evidence-audit report; defects filed via friction-triage]
earned_from: "Consumer P: a version column mis-stamped on ALL AI rows, a capture surface dormant at 296/298 pending, 5 destroyed message bodies, and 47% of sends unscored — every one invisible to QA, the verify-gate, and ~10 panels, found only by ONE founder-improvised read-only audit. 'Capture everything' had shipped; 'verify the instruments' was the missing half of the loop (N16)."
mechanical_spine: "a SCHEDULED Operating-Loop standing beat (cadence, never discretion); DoD telemetry row 10 (new instrumentation proven recording); findings route through /friction"
---
# Instruments Audit

## Overview
The most instrumented part of a system can be the least verified: capture pipelines fail silently because
nothing downstream consumes them yet. This audit reads the live rows against every measurement claim, on a
clock, because discretion is exactly what failed.

## When to use (and NOT)
- Use when: the scheduled cadence point arrives (per milestone); new capture/measurement instrumentation
  ships; a learning review is about to trust the instruments' numbers.
- **NOT** for: verifying a slice (→ `verification`) or auditing a peer repo (→ `cross-system-reality-audit`).

## Process
1. **Enumerate the claims**: every "we capture/stamp/score/version X" in specs, doctrine, and slice docs.
2. **Read the live rows, read-only**: for each claim — does a recent row exist? is the stamp the value the
   spec says? are counts moving? (a pending-counter stuck at ~100% is a dormant capture).
3. **Sweep the destruction paths (K10)**: under any append-only doctrine, audit UPDATE-clobber and CASCADE
   chains explicitly — self-inflicted destruction is the most expensive defect class and leaves no error.
4. **Doctrine-vs-rows drift**: where the rows contradict the doctrine, the finding names which one is wrong.
5. **Report, dated; file defects via `friction-triage`** — instrument defects get the same root-causing as
   founder reports. Never fix during the audit (read-only).

## Red flags
- "We'll audit when something looks off" — the recorded failures looked like nothing.
- An audit that writes fixes as it goes (it just destroyed its own evidence).
- New instrumentation trusted before one live row proved it records (DoD row 10).

## Verification (of this skill's own output)
- The report cites row counts/values a re-run reproduces.
- Every defect found has a friction-log entry with lineage.

## Changelog
- 1.0.0 — promoted from consumer P's post-incident audit method (#76 §8.1), made a scheduled loop beat (S8/N16).
