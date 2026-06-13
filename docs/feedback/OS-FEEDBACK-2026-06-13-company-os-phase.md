# OS-FEEDBACK — Company-OS phase (§14 triage)

> Fired by: review-artifact detector (this push adds a learning-review case-study + a v5 adoption plan +
> CHANGELOG-class intent). §14 requires the triage to EXIST and be ANSWERED — insight is the §11 panel's job.
> Provenance: `case-studies/2026-06-13-company-os-phase.md` (N17–N22 + Ruflo negative control).

## The three questions (§14)
**1. Were any framework-level lessons discovered?** Yes — 6 noun-free promotion candidates (P-A4, P-A2, P-A1,
P-A3, P-A6, P-BOUNDARY) + P-REPRO; full evidence + per-change cards in `docs/DELIVERY-OS-V5-ADOPTION-PLAN.md`.

**2. Any OS Candidates (`os_candidate: true`)?** Yes — all of the above are flagged OS-candidate. Each is earned
by an **observed failure** (N17–N22), satisfying the promotion bar (§14: observed failure OR a second consumer
pulling). Ruflo contributes *ideas* (deterministic tier, parallel batch, cost tracking, named handoffs) + a
*negative control*; **the Ruflo framework/core/federation/consensus/witness-verify/uncurated-vector-memory are
REJECTED and recorded** so they are never re-litigated.

**3. Route each lesson to its layer:**
| Lesson | Layer | Destination |
|---|---|---|
| P-A4 read-canonical-first (N18) | **Delivery OS** (noun-free, every project) | `core/OPERATING-LOOP` + `§15` + `skills/contract-grounding` + DoD line |
| P-A2 risk-scaled+parallel verification (N20) | **Delivery OS** | `core/DEFINITION-OF-DONE` rubric + `verification-playbook` |
| P-A1 deterministic/direct tier (N20) | **Delivery OS** | `core/OPERATING-LOOP` doctrine line |
| P-A3 token/cost instrument (N20) | **Delivery OS** | light tool/template + `instruments-audit` note |
| P-A6 test-fixture hygiene + clean frontmatter (N21) | **Delivery OS** | `checklists/test-hygiene` + VERIFY template + gate parser rule |
| P-BOUNDARY boundary-first (N22) | **Delivery OS** | `core/GOVERNANCE` doctrine + `skills/contract-grounding` |
| P-REPRO runtime-repro + guard (N17) | **Delivery OS** (skills) | `skills/deploy-vercel-supabase`, `skills/cutover-execution`, `§1` |
| Session-pooler / smoke-guard specifics | **Project (Admin)** (carries platform nouns) | Admin deploy runbook + `RETROSPECTIVE-2026-06-13` |
| Admin=facts / The Room=ranking boundary | **Project + Ecosystem** | Admin memory `admin-truth-source-boundary`; noun-free form → P-BOUNDARY |

## Promotion bar + gate
Each promotion cites a recorded failure artifact (N17–N22) — confirming evidence, not imagined counterfactual.
**Default would be close/wait; here the bar is met.** Per §14, **a promotion is a consequential decision** → this
batch must pass **one consolidated F2 §11 ratification** (per-promotion evidence in the changelog; the adoption
plan's translation ledger maps every lesson; an unmapped lesson blocks the merge) **before any base file changes**,
then the base mints the v5 version (F1) and consumers adopt by pin.

## Status
Triage **answered**. Batch **staged, not landed.** Next: the F2 §11 ratification (independent, blind lenses) →
founder merge-gate sign-off → implement promotions + `CHANGELOG-v5` + version tag. No base mechanism is weakened by
any candidate (self-checks in the adoption plan; the one risky candidate, A2, keeps independence non-negotiable for
load-bearing classes).
