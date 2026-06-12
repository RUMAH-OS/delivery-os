---
event: "review (retroactive — capstone OS retrospective, property-lead-os #76 'OS Retrospective & v2')"
date: "2026-06-12"
triaged_by: "v4.0 consolidation (founder-commissioned; per property-lead-os/docs/reviews/consolidated-inheritance-recommendation.md #85 §C1.1)"
---

# OS Feedback Triage — property-lead-os #76 retrospective (retroactive)

> **Why retroactive:** PLOS ran the seven-blind-lens capstone retrospective
> (`property-lead-os/docs/reviews/os-retrospective-and-v2.md`, merged as #76) and produced the richest
> incident ledger and harvest list in the portfolio — then left the harvest as prose. No OS-FEEDBACK triage
> was filed; `delivery-os/docs/feedback/` ended at v3.8. This artifact is the triage #76 owed. The promotions
> land via the consolidated v4.0 packet (F2).

## 1. Were any framework-level lessons discovered this cycle?

Yes. The capstone verdict: *"the OS was never wrong about how to verify work; it was wrong about how to remember
state and how to ration its own ceremony."* Every mechanical fail-closed link held with zero violations; every
prose/hand-maintained link produced a named incident (the 10-incident ledger, #76 §0 — now
`delivery-os/case-studies/2026-06-incident-ledger.md`). Headlines:
- Merge had no mechanical gate (incident 1, PR #54 merged on red) → `scripts/merge-pr.mjs` built and in use since #82.
- Hand-maintained peer state is a stale cache with no TTL (incident 5, THE BIG ONE: days planned behind a gate that was already open).
- Ceremony needs an evidence governor (incident 7: ~75 lens-runs : 8 founder replies; 13 blind lenses falsified by one founder morning).
- The verifier's adversarial stack (mutation probes, sha256-identical restore, machine-guard preamble, run-unique tokens,
  reversal rehearsal, render-level evidence) was re-derived each session — encoded nowhere reusable.
- The loop doc overstated its own enforcement ("computed from evidence" — the hook checks existence/freshness/string-inequality).
- "Capture everything" shipped; "verify the instruments" was missing from the loop until the founder improvised it (mis-stamps, dormant capture 296/298, destroyed bodies, 47% unscored).
- Self-inflicted data destruction is the most expensive defect class (N13: timestamp clobbering, draft destruction at send, CASCADE paths under append-only doctrine — all permanent).
- Unenforced DoD rows train DoD-skimming (STATUS/project-log: required, nonexistent, unnoticed).
- The wiki layer: zero pages, two projects, 57+ slices — a dead layer by the citation-survival test.

## 2. Are there any OS Candidates?

Yes — #76 §8.1 names ten harvested skills and §8.0 sixteen recommendations; #84 re-adjudicated two
(merge-gate is a program, not a skill; slice-contract is a template, not a skill). All carried forward into #85 §A.3.

## 3. Routing — for each lesson, where does it belong?

| Lesson | Layer | Why | Destination (v4.0) |
|---|---|---|---|
| Mechanical merge gate (no override flag; checks API, never piped output) | Delivery OS | incident 1; in use since #82 | `templates/tools/merge-pr.mjs` + DoD row 9 (B4) |
| qa-adversarial-verification technique stack | Delivery OS | S37: 57 green author tests missed silent data loss; ~10 mutation-probe uses | merged `skills/verification/` (S1 union) |
| Derived state over hand-maintained state; delete the "hand-maintained" header; os_version from the pin | Delivery OS | incident 5 + both routers stale identically; false again within 48h post-#76 | `templates/CLAUDE.md.template` + `templates/tools/check-os-drift.mjs` (K3/K4/B5/B7) |
| Capability manifests + session-start sibling probes; audit-before-assume | Delivery OS | incident 5 fired between repos; the fix was a founder improvisation | `templates/manifest.schema.json` + `templates/hooks/sibling-probe.mjs` + DoD/loop rows (B8/B9) |
| Panel economics + invariants-and-reversals-only | Delivery OS | incident 7; Morning Band + answers-first falsifications | `core/GOVERNANCE.md` §11 (B10/B11) |
| Evidence governor (capture-before-gate, build-ahead cap 1, live counters, reconsideration dates) | Delivery OS | incident 10 vs the correct S29/S30 captures | GOVERNANCE §15 + `templates/gates.md.template` (B13) |
| Instruments-audit as a SCHEDULED loop beat + skill | Delivery OS | N16: the missing loop half | `core/OPERATING-LOOP.md` + `skills/instruments-audit/` (S8) |
| friction-triage + day-1 friction log | Delivery OS | the only mechanism with a zero-wrong-answer record | `skills/friction-triage/` + `templates/friction-log.md.template` (S6/T4) |
| Write-scoping (the hook exempts `tests/` — exactly where the boundary lives) | Delivery OS | incident 8 | `templates/hooks/verify-gate.mjs` + GOVERNANCE §12 (B2) |
| Honest verify-gate wording + machine-readable probe re-execution | Delivery OS | the OS's self-description drifted | `core/OPERATING-LOOP.md` + hook + `templates/VERIFY.md.template` (B3/T3) |
| §14 trigger fix (review-artifact detector + N-merges backstop) | Delivery OS | the release-tag trigger has NEVER fired in the field — zero triages, zero tags, both consumers | GOVERNANCE §14 + verify-gate/pre-push (B15, dial = F7 hard-block) |
| Write-back-gate; unenforced-DoD-row deletion | Delivery OS | #76's own P0s undischarged while #84 was drawn | DoD rows + `skills/write-back-gate/` (B19/B24/X4) |
| Durability-as-Phase-0, non-waivable | Delivery OS | raw-forever doctrine on an unbacked-up local Postgres (D3/F5 — still the named exhibit) | DoD row + `templates/release-readiness.md` (B14) |
| Machine-guard preamble + run-unique tokens; self-inflicted-destruction audit | Delivery OS | third occurrence of the shared-resource race; N13 | `processes/qa-and-testing.md` + S1 (B25/K10) |
| One-DDL-truth + three-schema-truths evidence; env hygiene (worktrees, CRLF, PATH-stripped smoke); harvest litmus; trigger hierarchy + slash commands; three-tier memory + doctrine seed; cheapest-reversible + pre-registered reversal; gates-by-signature | Delivery OS | each row cites its incident in #85 §A.3 | B26 / B20 / B30 / B33 / B17+K5 / K18 / K11 targets |
| Wiki layer | Delivery OS (retire) | citation-survival test failed twice | removed from scaffold (F6) + `case-studies/2026-06-wiki-citation-survival.md` (X1) |
| AttentionItem grammar, ask-routes, 16-table pin, prereg freeze, LinkedIn channel law, race specifics, conformance→INVARIANTS consolidation | Project | project nouns / pre-registration freeze never moves | PLOS project memory (M1–M12); X5–X7 archive dispositions execute PLOS-side |

## 4. Promotions proposed (each runs a scaled Principle-11 panel before it lands)

All "Delivery OS" rows above travel in the **consolidated v4.0 release packet** (F2 — one consolidated
ratification; per-promotion earning evidence in `CHANGELOG-v4.md`; the #85 §A.3 table is the translation ledger
and an unmapped row blocks the v4.0 merge). `check-no-backflow.mjs` green is a merge condition.
