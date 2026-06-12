---
name: cross-system-reality-audit
version: 1.0.0
stability: stable
description: >
  Read-only audit of a peer repo's ACTUAL shipped state (code, migrations, contracts, VERIFY artifacts,
  routes) producing an audit-citation line every cross-repo plan must carry. MANDATORY before any plan that
  gates on a sibling — the trigger rides the session-start sibling probe and the DoD row, never consent.
  Invoke via /audit-peer, when the sibling probe reports UNKNOWN/STALE, or before planning against any peer claim.
decision_class: integration
inputs:  [the peer repo path (read-only), the claimed gate/blocker, the peer's manifest.json if present]
outputs: [an audit citation (date + what was read) + a delta report vs the registry/router claims]
earned_from: "Incident 5 (THE BIG ONE): days of planning behind an 'infra gate' while the peer's complete API sat shipped and verified on its disk. The skill built to prevent it had a consent-based 'on change' trigger that structurally cannot fire when the change is what you don't know. Same-day read-only audits subsequently fired >=4 times, each correcting a stale claim."
mechanical_spine: "SessionStart sibling-probe hook (prints peer manifest deltas without consent); DoD row 8 (a cross-system slice without an audit citation is not done); /audit-peer command"
---
# Cross-System Reality Audit

## Overview
"What is currently true about a peer system" has no owner in a hand-maintained registry — it is a stale cache
with no TTL. This skill makes the peer's DISK the source, and makes consulting it mandatory rather than polite.

## When to use (and NOT)
- Use when: any plan, slice, or gate references a sibling repo's state; the sibling probe prints UNKNOWN or STALE.
- **NOT** for: designing the seam itself (→ `executable-contracts`); ownership questions (→ `ecosystem-alignment-review`).

## Process
1. **Read-only, same-day**: open the peer repo and read what is actually there — migrations applied, routes
   registered, contracts + fixtures present, latest VERIFY artifacts and their verdicts, last commits.
   Prefer its generated `manifest.json`; trust the disk over every prose layer above it.
2. **Emit the audit citation**: one line — date, repo, commit, what was read — that the consuming plan/slice
   carries verbatim (DoD row 8).
3. **Delta report**: every disagreement between the disk and the claims (registry rows, router sections,
   relayed messages) is listed and filed — the stale claim is a defect with an owner, not ambient weather.
4. **Never write** anything in the peer repo; defects flow to its owners.

## Red flags
- A plan whose blocker cites a registry/router/Slack claim with no audit line (the incident-5 shape).
- "Their repo isn't ready" spoken from memory.
- An audit older than the plan that cites it (same-day or re-run).

## Verification (of this skill's own output)
- The citation names a commit hash a third party can check out and confirm.
- Each delta row points at a file/line on the peer's disk.

## Changelog
- 1.0.0 — promoted from consumer P's harvested skill (#76 §8.1), trigger re-based from consent to the sibling probe + DoD row (the C3-proof artifact for the v4 retrieval model).
