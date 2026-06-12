---
name: decision-ratification
version: 2.0.0
stability: stable
description: >
  Burn down founder-controlled decisions in one short session: every decision pre-framed with evidence +
  a recommended safe default + a checkbox verdict, then MECHANICALLY enforced (executing tools refuse until
  acknowledged). Invoke whenever 2+ decisions block execution, BEFORE asking the founder anything, or via /ratify.
decision_class: governance
inputs:  [the surfaced decision list (pipeline issues, DECISIONS.md OPEN rows), evidence per decision]
outputs: [one ratification doc the founder clears in ~20 minutes; DECISIONS.md rows updated; enforcement state]
earned_from: "Consumer A, 2026-06: 17 surfaced decisions cleared in two founder messages; the ratification step caught a real future-money bug — a near-identical lookalike IBAN — only because both verbatim values were printed side by side. Second witness [P]: pre-framed decision packages independently named the single most effective founder-workload reduction."
mechanical_spine: "/ratify command; executing tools refuse via an explicit --ack flag until ratification is recorded; DECISIONS.md status grammar gates execution"
---
# Decision Ratification (v2.0)

## Overview
Founder bandwidth is the scarcest resource in the system. This skill converts "a week of threads" into one
pre-framed session, and converts "did we agree on this?" from memory into a refusal gate.

## When to use (and NOT)
- Use when: 2+ decisions block execution; a migration/pipeline emits `decision`-severity issues; OPEN rows accumulate in `DECISIONS.md`.
- **NOT** for: questions a specialist should default (decide-don't-overask — only genuine tradeoffs escalate);
  consequential *design* decisions needing independent lenses (→ `principle-11-review` first; ratify its verdict after).

## Process
1. **Collect mechanically**: decisions come from pipelines/reviews/the ledger as structured issues, never from memory.
2. **Pre-frame each**: the question · the evidence (**verbatim values, not summaries** — the lookalike-IBAN bug
   was caught only because both values were printed side by side) · a recommended default · the cost if wrong ·
   a checkbox verdict line.
3. **Choose SAFE defaults**: prefer the recoverable direction (keep-separate over merge; preserve over
   normalize; import-with-marker over rewrite). A safe default lets the founder ratify everything with one
   word and override exceptions only.
4. **Isolate what genuinely needs founder knowledge** (identity, money identity, business policy) from what is
   technically derivable — **never pad the list (N8)**: every fake decision costs founder trust.
5. **Enforce**: the executing tool REFUSES while decisions are unacknowledged (an explicit `--ack` flag whose
   use asserts ratification happened). **Rehearsal acks are labeled rehearsal-only (N5)** — an ack used in a
   rehearsal must never silently satisfy production.
6. **Record verdicts in the ledger and the doc itself** (RATIFIED + date + verbatim verdict), keeping the
   original framing for the record. Implement verdict-dependent changes as normal verified slices.

## Red flags
- Asking decisions one at a time across days (batch them).
- A "decision" with no evidence or no default (that's research, not ratification).
- Treating "assume ratified" as covering NEW decisions surfaced later — re-gate.
- Money/identity defaults picked from memory rather than verified documents.
- A rehearsal `--ack` reused for the production run (N5).

## Verification (of this skill's own output)
- Every ratified row shows: verbatim evidence, the default offered, the founder's verbatim verdict, a date.
- The executing tool demonstrably refuses without the ack (run it once unacked; expect refusal BEFORE side effects).

## Changelog
- 2.0.0 — v4 promotion of consumer A's earned skill + N5 (rehearsal-only acks) + N8 (never pad) + DECISIONS.md ledger wiring (F3).
