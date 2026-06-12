---
event: "review (retroactive — phase-end retrospective, rumah-admin rebuild/migration/cutover)"
date: "2026-06-12"
triaged_by: "v4.0 consolidation (founder-commissioned; per property-lead-os/docs/reviews/consolidated-inheritance-recommendation.md #85 §C1.1)"
---

# OS Feedback Triage — rumah-admin RETROSPECTIVE-2026-06-12 (retroactive)

> **Why retroactive:** rumah-admin completed its phase-end retrospective (`rumah-admin/docs/RETROSPECTIVE-2026-06-12.md`)
> and shipped 7 earned skills + a router update in the same commit series (`43fcd53`) **without filing this triage** —
> the §14 bypass named by #84/#85 (finding C1). The skills were stranded in the Admin overlay and the router
> unilaterally minted the version label `v4.0-skills-first`. This artifact is the triage that commit owed.
> Filed now so the inheritance loop's record is complete; the promotions below land via the consolidated v4.0 packet (F2).

## 1. Were any framework-level lessons discovered this cycle?

Yes — the heaviest single-phase harvest the OS has had from one consumer. Headlines (full classification: #85 §A.3):
- Independent slice verification as a reusable playbook (6 uses incl. one FAIL→fix→re-verify that stopped a broken production root route).
- ETV migration discipline (extract → transform-plan → validate → refusal-gated load; 3 full runs, reconciliation exact across €11,311 at zero deltas).
- Cutover execution (drift sentinels, same-day rehearsal with identical tooling, one-transaction load, independent hand-derivation; "the production run must be boring").
- Decision ratification (pre-framed evidence + safe defaults + mechanical `--ack`; 17 decisions cleared in two founder messages; the NL13/NL33 lookalike-IBAN money bug caught only because both values were printed verbatim side by side).
- Platform foot-gun knowledge needs a standard home (Vercel+Supabase: 3 deploy cycles lost to documented platform behavior).
- Cross-system state must travel as contracts + verifiable probes, never relayed prose (every relayed-prose claim contained a false statement; every contract+token request worked first time — the other side of incident 5).
- PS-5.1 byte/secret rule (BOM-broken deploy; all-zeros password); two-doc rule for migration report families (~40% overlap across 5 docs); half-day slice batching under launch pressure.
- `earned_from` provenance on skills — the one element no other model had.

## 2. Are there any OS Candidates?

Yes — the retro itself flagged six skill candidates plus the smoke-battery / `.env`-NEVER-COMMIT / programmatic-source-access standards (retro §4–§5). None carried an `os_candidate` flag because the triage step was skipped; recorded here.

## 3. Routing — for each lesson, where does it belong?

| Lesson | Layer | Why | Destination (v4.0) |
|---|---|---|---|
| verification-playbook techniques | Delivery OS | no-noun; convergent twin of the sibling consumer's QA stack (the OS's own evidence bar: independent derivation) | merged `skills/verification/` (S1 union) |
| legacy-migration-etv | Delivery OS | no-noun; 3 earned runs; stable artifact shape | `skills/legacy-migration-etv/` (S11, migration pack) |
| cutover-execution (+ deploy-empty-first N4, decommission-is-separate N6) | Delivery OS | no-noun; 2 earned runs | `skills/cutover-execution/` (S12, migration pack) |
| decision-ratification (+ rehearsal-only acks N5, never-pad-the-list N8) | Delivery OS | no-noun; 2 packages; founder-workload mechanism | `skills/decision-ratification/` (S10, core pack) |
| learning-review | Delivery OS | no-noun — **but as written its step 6 ("implement in the same series… kernel/router updated") codifies the §14 bypass for OS-level lessons** | `skills/learning-review/` (S9) **with the mandatory blast-radius fork (C1/F8)** |
| deploy-vercel-supabase | Delivery OS (ecosystem platform pack) | re-adjudicated by #85 C4: the foot-guns are plane-wide, not project-wide | `skills/platform/deploy-vercel-supabase/` (S15, pull-on-need) |
| ops-truth-integration | Project | Admin-seam nouns; meta-doctrines already extracted (K16, K28, K30, N7) | stays Admin overlay; catalog-indexed |
| contracts+probes-never-prose; PS-5.1 rule; rehearsal-then-production; cross-derive-one-number; refusal gates; decision-surfacing; recoverable-direction; platform-conventions-first; verify-environment-before-DDL; named-cutover; one-derivation-many-consumers | Delivery OS | no-noun doctrine, each with a recorded earning incident | `core/GOVERNANCE.md` §15 + `templates/memory/doctrine-seed.md` (K13–K31 rows) |
| migration/schema defaults (forward-only+applies-clean, RLS-same-migration, passwords out-of-band, integer cents, provenance markers, no-outbox-from-imports, .env NEVER-COMMIT) | Delivery OS | held 8+ times incl. production | `processes/database-migrations.md` + `scripts/new-project.sh` (B27) |
| smoke battery + login-path production smoke | Delivery OS | UI shipped with no working login, caught at deploy | `templates/release-readiness.md` (B28) + S15 |
| two-doc rule (READINESS + EXECUTED) | Delivery OS | Admin's own ceremony-rent finding | `checklists/migration.md` (T9) |
| half-day slice batching | Delivery OS | three same-day deploy verifies; "the gate is right; the slicing was too fine" | `core/OPERATING-LOOP.md` guidance (B38) |
| `earned_from` provenance, lean skill bodies | Delivery OS | the founder's "lessons are the asset" made machine-visible | `templates/SKILL.md.template` + `skills/README.md` (B31, C3) |
| `v4.0-skills-first` version label | **Defect, not lesson** | overlays never mint OS versions (F1); the label is superseded by the real v4.0 cut | GOVERNANCE §14 version-namespace rule; CHANGELOG-v4 |
| invoicing/ops seam specifics | Project | Admin nouns | `rumah-admin` project memory (M13/M14) |

## 4. Promotions proposed (each runs a scaled Principle-11 panel before it lands)

All "Delivery OS" rows above, carried in the **consolidated v4.0 release packet** under the founder's F2 ruling
(one consolidated ratification over the packet, per-promotion earning evidence attached in `CHANGELOG-v4.md`;
the independent verification of the v4.0 branch is that check). `check-no-backflow.mjs` green is a merge condition.
